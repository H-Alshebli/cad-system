"use client";

type StatsTableProps = {
  title: string;
  data: Record<string, number>;
  colorMap?: Record<string, string>;
};

export function StatsTable({ title, data, colorMap = {} }: StatsTableProps) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 text-sm font-semibold text-[#7F7F7F] shadow-sm shadow-[#274C5A]/5">
        {title} – No data
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#86A7B2]/25 bg-white shadow-sm shadow-[#274C5A]/5">
      <div className="border-b border-[#86A7B2]/25 bg-[#f8fbfc] px-4 py-3 font-black text-[#274C5A]">
        {title}
      </div>

      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, count]) => {
            const color =
              colorMap[key] || "bg-[#86A7B2]/20 text-[#274C5A]";

            return (
              <tr key={key} className="border-t border-[#86A7B2]/20 hover:bg-[#f8fbfc]">
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${color}`}
                  >
                    {key}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-black text-[#274C5A]">
                  {count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
