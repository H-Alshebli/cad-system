import type { AuditLogger, PartnerAuditEvent } from "@/lib/server/audit/types";
import type { BaseEntity } from "@/lib/server/models/entity";
import { repositoryFactory } from "@/lib/server/repositories/factory/repositoryFactory";

type PartnerAuditEntity = BaseEntity & PartnerAuditEvent;

export class FirestoreAuditLogger implements AuditLogger {
  private readonly repository =
    repositoryFactory.forCollection<PartnerAuditEntity>("partnerApiAuditLogs");

  async log(event: PartnerAuditEvent): Promise<void> {
    await this.repository.create(event);
  }
}

export const auditLogger = new FirestoreAuditLogger();
