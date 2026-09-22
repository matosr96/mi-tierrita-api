export type AuditRow = {
  id: number;
  userId: number;
  method: string;
  resource: string;
  createdAt: Date;
};

export type NewAudit = {
  userId: number;
  method: string;
  resource: string;
};
