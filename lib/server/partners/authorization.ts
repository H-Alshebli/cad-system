import type { AuthenticatedPartner, PartnerScope } from "@/lib/server/partners/types";

export function partnerHasScope(
  partner: AuthenticatedPartner,
  requiredScope: PartnerScope
) {
  return partner.scopes.includes(requiredScope);
}
