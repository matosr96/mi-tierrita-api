import { randomUUID } from "node:crypto";
import { ErrorCodes, domainError, isDomainError, type ErrorCode } from "../../common/index";

/**
 * Respuesta de Tita en dos pasos (brief de octubre de 2026, punto 1): con `asincrono: true` la API responde al
 * instante 202 con un `tareaId` y sigue trabajando; la app consulta `GET /ai/mensajes/:tareaId` cada 1,5 s hasta
 * que la respuesta esté lista. Así una conexión móvil lenta no corta una respuesta que tarda más de lo que aguanta
 * el navegador. Las tareas viven en memoria de esta instancia (la respuesta además queda guardada en la
 * conversación, así que nada se pierde si expira) y se olvidan a los 10 minutos.
 */
export type AssistantTask<T> =
  | { id: string; userId: number; createdAt: number; state: "pending" }
  | { id: string; userId: number; createdAt: number; state: "done"; result: T }
  | { id: string; userId: number; createdAt: number; state: "failed"; code: ErrorCode; details?: unknown };

export const TASK_TTL_MS = 10 * 60 * 1000;
/** Tareas en curso por persona: más de esto es un cliente reintentando a ciegas. */
export const MAX_PENDING_PER_USER = 3;

const tasks = new Map<string, AssistantTask<unknown>>();

const forget = (id: string) => {
  tasks.delete(id);
};

const pendingOf = (userId: number): number => {
  let n = 0;
  for (const t of tasks.values()) if (t.userId === userId && t.state === "pending") n += 1;
  return n;
};

/** Arranca el trabajo en segundo plano y devuelve el id con el que se consulta. Nunca deja una promesa sin atender. */
export const startAssistantTask = <T>(userId: number, job: () => Promise<T>): string => {
  if (pendingOf(userId) >= MAX_PENDING_PER_USER) throw domainError(ErrorCodes.TOO_MANY_ATTEMPTS);
  const id = randomUUID();
  const base = { id, userId, createdAt: Date.now() };
  tasks.set(id, { ...base, state: "pending" });
  const finish = (task: AssistantTask<T>) => {
    tasks.set(id, task);
    setTimeout(() => forget(id), TASK_TTL_MS).unref();
  };
  job()
    .then((result) => finish({ ...base, state: "done", result }))
    .catch((err: unknown) => {
      if (isDomainError(err)) finish({ ...base, state: "failed", code: err.code, details: err.details });
      else {
        console.error("Tarea de Tita falló:", err);
        finish({ ...base, state: "failed", code: ErrorCodes.INTERNAL });
      }
    });
  return id;
};

/** Estado de una tarea propia; una ajena o vencida no existe (662). */
export const getAssistantTask = <T>(userId: number, id: string): AssistantTask<T> => {
  const task = tasks.get(id) as AssistantTask<T> | undefined;
  if (task === undefined || task.userId !== userId) throw domainError(ErrorCodes.AI_TASK_NOT_FOUND);
  return task;
};

/** Solo para pruebas: vacía el registro. */
export const clearAssistantTasks = (): void => {
  tasks.clear();
};
