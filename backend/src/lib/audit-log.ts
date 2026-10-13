import { Prisma } from '@prisma/client';

type AuditClient = Prisma.TransactionClient;

export interface AuditActor {
  id: string;
  role: string;
}

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

const sanitizeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return null;
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/password|token|secret|paymentDetails/i.test(key))
  );
  return JSON.stringify(safe);
};

/** Writes the audit record in the caller's transaction, so it cannot drift from the mutation. */
export const writeAdminAudit = (tx: AuditClient, event: AuditEvent) =>
  tx.adminAuditLog.create({
    data: {
      actorId: event.actor.id,
      actorRole: event.actor.role,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata: sanitizeMetadata(event.metadata),
    },
  });

