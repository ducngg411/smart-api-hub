import { db } from '../db/knex';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export function logAudit(
    userId: number | undefined,
    action: AuditAction,
    resourceName: string,
    recordId: number
): void {
    setImmediate(() => {
        db('audit_logs')
            .insert({
                user_id: userId ?? null,
                action,
                resource_name: resourceName,
                record_id: recordId,
                timestamp: new Date(),
            })
            .catch((err) => {
                console.error('[AuditLog] Ghi thất bại:', err);
            });
    });
}
