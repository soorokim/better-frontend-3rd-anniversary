import { auditEvents } from '@/db/schema';
import { db } from '@/lib/db/client';
import type { Transaction } from '@/lib/db/transaction';

export type AuditInput = {
  eventId: string;
  adminId?: string;
  action: 'admin_login' | 'pin_reset_issued' | 'pin_reset_completed';
  targetParticipantId?: string;
  outcome: 'success' | 'failure';
};

export async function createAuditEvent(input: AuditInput, executor: Transaction | typeof db = db) {
  await executor.insert(auditEvents).values(input);
}
