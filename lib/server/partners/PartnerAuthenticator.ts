import type { AuthenticatedPartner } from "@/lib/server/partners/types";

export type PartnerAuthenticationResult =
  | {
      ok: true;
      partner: AuthenticatedPartner;
    }
  | {
      ok: false;
      reason: "missing_api_key" | "invalid_api_key" | "partner_disabled";
    };

export type PartnerAuthenticator = {
  authenticate(req: Request): Promise<PartnerAuthenticationResult>;
};
