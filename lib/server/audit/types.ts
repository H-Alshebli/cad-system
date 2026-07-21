export type PartnerAuditEvent = {
  requestId: string;
  partnerId?: string;
  partnerName?: string;
  endpoint: string;
  method: string;
  requiredScope?: string;
  result: "success" | "error";
  responseStatus: number;
  resourceId?: string;
  errorCode?: string;
  durationMs?: number;
  environment?: string;
  timestamp: string;
};

export type AuditLogger = {
  log(event: PartnerAuditEvent): Promise<void>;
};
