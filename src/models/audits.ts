export type AuditRow = { id: number; userId: number; username: string; method: string; resource: string; createdAt: Date };

export type AuditResponse = Omit<AuditRow, "createdAt"> & { createdAt: string };

export const toAuditResponse = (row: AuditRow): AuditResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type NewAudit = { userId: number; method: string; resource: string };

export type AuditListFilter = { userId?: number | undefined; resource?: string | undefined; from?: string | undefined; to?: string | undefined };
