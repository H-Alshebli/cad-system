// Server-side minimum submission checks. Keep aligned with the report form.
export function submissionErrors(report: Record<string, any>): string[] {
  const missing: string[] = [];
  const p = report.patientInfo || {}, n = report.narrativeVitals || {}, o = report.outcome || {};
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const need = (ok: unknown, label: string) => { if (!ok) missing.push(label); };
  need(text(p.patientId) || p.patientIdUnavailable === true, "Patient ID / Iqama");
  if (p.patientIdUnavailable) need(text(p.patientIdUnavailableReason), "ID unavailable reason");
  if (p.patientIdUnavailableReason === "other") need(text(p.patientIdUnavailableOther), "Other ID reason");
  need(text(p.firstName), "First name"); need(text(p.lastName), "Last name");
  need(typeof p.age === "number" && Number.isFinite(p.age) && p.age > 0, "Age");
  need(text(p.triageColor), "Triage"); need(text(p.healthClassification), "Health classification");
  need(Array.isArray(p.chiefComplaints) && p.chiefComplaints.length, "Chief complaints");
  for (const complaint of Array.isArray(p.chiefComplaints) ? p.chiefComplaints : []) {
    need(Array.isArray(p.chiefComplaintDetails?.[complaint]) && p.chiefComplaintDetails[complaint].some(text), `Complaint details: ${complaint}`);
  }
  need(Array.isArray(p.signsAndSymptoms) && p.signsAndSymptoms.length, "Signs and symptoms");
  need(text(n.contactedMedicalDirector), "Contacted medical director"); need(text(n.narrative), "Narrative");
  need(Array.isArray(n.vitalsList) && n.vitalsList.length, "Vitals");
  for (const vital of Array.isArray(n.vitalsList) ? n.vitalsList : []) {
    need(text(vital?.hr) && text(vital?.bp) && text(vital?.spo2), "HR, BP and SpO2");
  }
  need(text(o.destination), "Destination");
  if (["No Transport and/or Treatment", "Won't Transfer or Treat"].includes(o.destination)) {
    need(text(o.noTransferReason), "No transport reason");
    if (o.noTransferReason === "Other") need(text(o.noTransferReasonOther), "Other no transport reason");
  }
  if (String(o.destination || "").toLowerCase().includes("hospital")) {
    need(text(o.hospitalName) && text(o.hospitalMember) && text(o.hospitalSignatureDataUrl), "Hospital handover and signature");
  }
  const members = report.transferTeam?.members;
  need(Array.isArray(members) && members.length > 0, "Transfer team");
  for (const member of Array.isArray(members) ? members : []) need(text(member?.name) && text(member?.signatureDataUrl), "Crew name and signature");
  need(text(report.time?.arrivalTime?.timeHHMM), "Arrival time");
  need(text(report.time?.movingTime?.timeHHMM), "Moving time");
  return missing;
}
