export type PartnerStatus = "active" | "disabled";

export type PartnerScope =
  | "bookings:create"
  | "bookings:read"
  | "bookings:status:read"
  | "webhooks:test";

export type AuthenticatedPartner = {
  partnerId: string;
  name: string;
  status: PartnerStatus;
  scopes: PartnerScope[];
  rateLimit?: {
    limit: number;
    windowSeconds: number;
  };
};
