import * as XLSX from "xlsx";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { exportColumns, exportValue, ExportMode, ExportRow } from "./submissionsExport";

// The existing SheetJS CE writer preserves data, but not custom cell alignment
// or frozen panes. Apply those to our own generated workbook only, never imports.
function stylesXml() {
  const xf = (fill: number, numFmtId = 0) => `<xf numFmtId="${numFmtId}" fontId="0" fillId="${fill}" borderId="0" xfId="0" applyAlignment="1" applyFill="1" applyNumberFormat="1"><alignment vertical="top" wrapText="1"/></xf>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF274C5A"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF274C5A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">${xf(0)}<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>${[0,3].map(fill => [0,0,164,165].map(fmt => xf(fill, fmt)).join("")).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

export function buildSubmissionsWorkbook(rows: ExportRow[], mode: ExportMode): Uint8Array {
  if (!rows.length) throw new Error("No matching results to export.");
  if (rows.length > 1048575) throw new Error("Too many rows for Excel. Narrow the filters.");
  const columns = exportColumns(mode);
  const values = rows.map(row => columns.map(col => exportValue(col.get(row), col.kind)));
  const sheet = XLSX.utils.aoa_to_sheet([columns.map(col => col.title), ...values]);
  sheet["!cols"] = columns.map(col => ({ wch: col.width }));
  sheet["!rows"] = [{ hpt: 36 }, ...rows.map(() => ({ hpt: 30 }))];
  sheet["!autofilter"] = { ref: sheet["!ref"]! };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, mode === "full" ? "Full Details" : "Basic Details");
  const files = unzipSync(new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx", bookSST: false })));
  let xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const views = `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/></sheetView></sheetViews>`;
  if (!/<sheetViews>/.test(xml)) throw new Error("Unexpected workbook format; export stopped.");
  xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, views);
  xml = xml.replace(/<c\b([^>]*?)>/g, (tag, attrs: string) => {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) return tag;
    const row = +ref[2];
    const col = XLSX.utils.decode_col(ref[1]);
    const val = values[row - 2]?.[col];
    const kind = columns[col]?.kind;
    const style = row === 1 ? 1 : (row % 2 === 0 ? 2 : 6) + (typeof val !== "number" ? 0 : kind === "date" ? 2 : kind === "time" ? 3 : 1);
    return `<c${attrs.replace(/\s+s="[^"]*"/, "")} s="${style}">`;
  });
  files["xl/worksheets/sheet1.xml"] = strToU8(xml);
  files["xl/styles.xml"] = strToU8(stylesXml());
  return zipSync(files, { level: 1 });
}

export async function downloadSubmissions(rows: ExportRow[], mode: ExportMode) {
  const bytes = buildSubmissionsWorkbook(rows, mode);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = `HCAD-${mode}-details-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
