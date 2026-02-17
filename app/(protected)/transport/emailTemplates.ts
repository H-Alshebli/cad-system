// app/(protected)/transport/emailTemplates.ts

import type { TransportRequest } from "./types";

export type EmailBuildType =
  | "CREATED"
  | "OPS_AVAILABLE"
  | "OPS_REJECT"
  | "CLIENT_APPROVED"
  | "CLIENT_REJECT"
  | "ASSIGNED";

export type BuildEmailArgs = {
  type: EmailBuildType;
  req: Partial<TransportRequest> & Record<string, any>;
  id: string;
  note?: string;
};

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

function transportLink(id: string) {
  return `${appUrl()}/transport/${id}`;
}

function escapeHtml(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function row(label: string, value?: any) {
  const v = value === undefined || value === null || String(value).trim() === "" ? "—" : String(value);
  return `<tr>
    <td style="padding:8px 10px; width:190px; color:#666;"><b>${escapeHtml(label)}</b></td>
    <td style="padding:8px 10px;">${escapeHtml(v)}</td>
  </tr>`;
}

function baseHtml(title: string, rowsHtml: string, link: string) {
  return `
  <div style="font-family:Arial, sans-serif; line-height:1.6;">
    <h2 style="margin:0 0 10px;">${escapeHtml(title)}</h2>
    <p style="margin:0 0 14px;color:#444;">
      Please review the transport request in Lazem CAD.
    </p>

    <table style="border-collapse:collapse; width:100%; max-width:760px; border:1px solid #eee;">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(
        link
      )}" style="display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;border:1px solid #ddd;">
        Open Transport Request
      </a>
    </p>

    <p style="margin:14px 0 0;color:#888;font-size:12px;">
      Lazem CAD • Transport Module
    </p>
  </div>
  `.trim();
}

function commonRows(req: any) {
  // خليها مرنة لأن req عندك أحيانًا Partial وفيه حقول legacy
  const projectType = req.projectType ?? "—";
  const serviceType = req.serviceType ?? req.teamType ?? "—";
  const city = req.cityName ?? "—";
  const scope = req.cityScope === "outside" ? "Outside City" : req.cityScope === "inside" ? "Inside City" : "—";

  // times might exist as ISO strings
  const start = req.serviceStartTime ?? req.serviceTime ?? "—";
  const end = req.serviceEndTime ?? "—";

  return (
    row("Request ID", req.id || "—") +
    row("Project Type", projectType) +
    row("Service Type", serviceType) +
    row("Start", start) +
    row("End", end) +
    row("City Scope", scope) +
    row("City", city) +
    row("Requirements", req.requirements)
  );
}

export function buildEmail(args: BuildEmailArgs): EmailContent {
  const { type, req, id, note } = args;
  const link = transportLink(id);

  const baseRows = commonRows({ ...req, id });

  // Assigned fields
  const assignedRows =
    row("Assigned Team", req.assignedTeamName) +
    row("Assigned Ambulance", req.assignedAmbulanceId) +
    row("Assigned Crew", Array.isArray(req.assignedCrew) ? req.assignedCrew.join(", ") : req.assignedCrew);

  if (type === "CREATED") {
    const subject = `🚑 Transport Request Created (${id})`;
    const text =
      `A new transport request has been created.\n\n` +
      `Request ID: ${id}\n` +
      `Project Type: ${req.projectType ?? "—"}\n` +
      `Service Type: ${req.serviceType ?? req.teamType ?? "—"}\n` +
      `City: ${req.cityName ?? "—"}\n` +
      `\nOpen: ${link}\n`;

    const html = baseHtml("New Transport Request Created", baseRows, link);
    return { subject, text, html };
  }

  if (type === "OPS_AVAILABLE") {
    const subject = `✅ Operations: Available (${id})`;
    const text =
      `Operations marked the request as AVAILABLE.\n\n` +
      `Request ID: ${id}\n` +
      `\nOpen: ${link}\n`;

    const html = baseHtml("Operations Marked Available", baseRows + row("Decision", "Available"), link);
    return { subject, text, html };
  }

  if (type === "OPS_REJECT") {
    const subject = `❌ Operations: Rejected (${id})`;
    const reason = note ?? req.opsDecisionNote ?? "—";
    const text =
      `Operations REJECTED the request.\n\n` +
      `Request ID: ${id}\n` +
      `Reason: ${reason}\n` +
      `\nOpen: ${link}\n`;

    const html = baseHtml(
      "Operations Rejected Request",
      baseRows + row("Decision", "Rejected") + row("Reason", reason),
      link
    );
    return { subject, text, html };
  }

  if (type === "CLIENT_APPROVED") {
    const subject = `✅ Sales: Client Approved (${id})`;
    const text =
      `Sales marked the request as CLIENT APPROVED.\n\n` +
      `Request ID: ${id}\n` +
      `\nOpen: ${link}\n`;

    const html = baseHtml("Sales Approved Request", baseRows + row("Decision", "Client Approved"), link);
    return { subject, text, html };
  }

  if (type === "CLIENT_REJECT") {
    const subject = `❌ Sales: Client Rejected (${id})`;
    const reason = note ?? req.salesRejectNote ?? "—";
    const text =
      `Sales/Client REJECTED the request.\n\n` +
      `Request ID: ${id}\n` +
      `Reason: ${reason}\n` +
      `\nOpen: ${link}\n`;

    const html = baseHtml(
      "Sales/Client Rejected Request",
      baseRows + row("Decision", "Client Rejected") + row("Reason", reason),
      link
    );
    return { subject, text, html };
  }

  // ASSIGNED
  const subject = `🚑 Assigned Team (${id})`;
  const text =
    `Operations assigned a team to the request.\n\n` +
    `Request ID: ${id}\n` +
    `Team: ${req.assignedTeamName ?? "—"}\n` +
    `Ambulance: ${req.assignedAmbulanceId ?? "—"}\n` +
    `Crew: ${
      Array.isArray(req.assignedCrew) ? req.assignedCrew.join(", ") : req.assignedCrew ?? "—"
    }\n` +
    `\nOpen: ${link}\n`;

  const html = baseHtml("Team Assigned", baseRows + assignedRows, link);
  return { subject, text, html };
}
