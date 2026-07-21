import type { RepositoryFactory } from "@/lib/server/repositories/factory/repositoryFactory";
import { repositoryFactory } from "@/lib/server/repositories/factory/repositoryFactory";
import type { AuditLogger } from "@/lib/server/audit/types";
import { auditLogger } from "@/lib/server/audit/FirestoreAuditLogger";
import { getHcadEnvironment } from "@/lib/environment";
import type { AuthenticatedPartner } from "@/lib/server/partners/types";

export type ServiceContext = {
  repositories: RepositoryFactory;
  requestId: string;
  environment: string;
  requestTimestamp: Date;
  partner?: AuthenticatedPartner;
  partnerScopes: string[];
  auditLogger: AuditLogger;
  actorId?: string;
};

export function createServiceContext(
  overrides: Partial<ServiceContext> & { requestId: string }
): ServiceContext {
  return {
    repositories: repositoryFactory,
    requestId: overrides.requestId,
    environment: getHcadEnvironment(),
    requestTimestamp: new Date(),
    partnerScopes: overrides.partner?.scopes || [],
    auditLogger,
    partner: overrides.partner,
    actorId: overrides.actorId,
    ...(overrides.repositories ? { repositories: overrides.repositories } : {}),
    ...(overrides.environment ? { environment: overrides.environment } : {}),
    ...(overrides.requestTimestamp
      ? { requestTimestamp: overrides.requestTimestamp }
      : {}),
    ...(overrides.partnerScopes
      ? { partnerScopes: overrides.partnerScopes }
      : {}),
    ...(overrides.auditLogger ? { auditLogger: overrides.auditLogger } : {}),
  };
}
