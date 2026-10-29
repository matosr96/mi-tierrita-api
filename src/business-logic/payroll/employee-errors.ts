import { ErrorCodes, domainError } from "../../common/index";
import { isForeignKeyViolation, isUniqueViolation } from "../../data-sources/index";

/** Documento o cuenta ya usados por otro empleado → 630; cuenta de usuario inexistente → 603. */
export const translateEmployeeError = (err: unknown): unknown => {
  if (isUniqueViolation(err)) return domainError(ErrorCodes.DUPLICATE_RESOURCE);
  if (isForeignKeyViolation(err)) return domainError(ErrorCodes.USER_NOT_FOUND);
  return err;
};
