import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import type { FinancialProjectRow } from "../../models/index";

export const PROJECT_COLUMNS = `
  p.id, p.name, p.user_id AS "userId", u.username, p.input,
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

export const PROJECT_FROM = `FROM financial_projects p JOIN users u ON u.id = p.user_id`;

export const findProjectById = async (id: number, q: Queryable = db): Promise<FinancialProjectRow | undefined> => {
  const { rows } = await q.query<FinancialProjectRow>(`SELECT ${PROJECT_COLUMNS} ${PROJECT_FROM} WHERE p.id = $1`, [id]);
  return rows[0];
};

export const requireProject = async (id: number, q: Queryable = db): Promise<FinancialProjectRow> => {
  const project = await findProjectById(id, q);
  if (project === undefined) throw domainError(ErrorCodes.FINANCIAL_PROJECT_NOT_FOUND);
  return project;
};

/** Solo el dueño sobrescribe o elimina su proyecto; los demás administradores lo abren y lo «Guardan como». */
export const assertProjectOwner = (project: FinancialProjectRow, userId: number): void => {
  if (project.userId !== userId) throw domainError(ErrorCodes.FINANCIAL_PROJECT_NOT_OWNER);
};
