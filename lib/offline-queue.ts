/**
 * Cadastros feitos em campo sem internet.
 *
 * O mapeamento guiado guarda o local e as pessoas neste aparelho e envia quando
 * o sinal volta. Os envios são idempotentes no servidor (o local leva o próprio
 * id e a pessoa leva requestId), então reenviar depois de uma queda não duplica.
 * A fila é de quem cadastrou: outra pessoa entrando no mesmo aparelho não envia
 * nem vê os cadastros dela. Só ficam aqui nome, cidade e vínculo — os mesmos
 * dados que o formulário já pede, nunca endereço de residência.
 */
export type QueueStatus = "pendente" | "revisar";

type QueueBase = {
  id: string; organizationId: number; email: string; cityId: number; label: string; createdAt: string;
  status: QueueStatus; message?: string;
  /** O servidor achou alguém parecido na cidade: a pessoa decide se é outra. */
  duplicate?: boolean;
};
export type QueuedPlace = QueueBase & { kind: "place"; placeType: string; data: Record<string, unknown> };
export type QueuedPerson = QueueBase & {
  kind: "person"; placeId: string | null; data: Record<string, unknown>;
  role: string; responsible: string; confirmDuplicate?: boolean;
};
export type QueueItem = QueuedPlace | QueuedPerson;

/** Resultado de um envio: o servidor respondeu (ok ou não) ou não houve conexão. */
export type SendError = Error & { offline?: boolean; duplicate?: boolean; status?: number };
export type Post = (url: string, body: unknown, organizationId: number) => Promise<{ result?: { id?: string } } & Record<string, unknown>>;

export const QUEUE_KEY = "elite-offline-queue";

export function offlineError(): SendError {
  return Object.assign(new Error("Sem internet agora."), { offline: true });
}

/** Itens desta pessoa nesta organização, na ordem em que foram feitos. */
export function itemsFor(items: QueueItem[], organizationId: number, email: string) {
  return items.filter((item) => item.organizationId === organizationId && item.email.toLowerCase() === email.toLowerCase());
}

/** Uma pessoa ligada a um local que ainda não chegou ao servidor espera o local. */
export function waitingPlace(item: QueueItem, items: QueueItem[]) {
  return item.kind === "person" && item.placeId ? items.find((other) => other.kind === "place" && other.id === item.placeId) ?? null : null;
}

async function send(item: QueueItem, post: Post) {
  if (item.kind === "place") {
    await post("/api/commercial", { action: "business", data: item.data }, item.organizationId);
    return;
  }
  const saved = await post("/api/territory", { action: "person", data: { ...item.data, confirmDuplicate: Boolean(item.confirmDuplicate) } }, item.organizationId);
  const id = String(saved.result?.id ?? "");
  if (item.role && id) await post("/api/territory", { action: "role", data: { personId: id, role: item.role, status: "Ativo", responsible: item.responsible, source: "Mapeamento guiado", authorized: true } }, item.organizationId);
}

/**
 * Envia, em ordem, o que é desta pessoa. Para na primeira falta de conexão.
 * Recusas do servidor (duplicado, dado inválido) ficam para revisar; falhas
 * do servidor (5xx) continuam pendentes e voltam na próxima tentativa.
 */
export async function flushQueue(items: QueueItem[], email: string, post: Post) {
  let queue = [...items], sent = 0, offline = false;
  for (const item of items) {
    if (item.email.toLowerCase() !== email.toLowerCase() || item.status === "revisar") continue;
    if (waitingPlace(item, queue)) continue;
    try {
      await send(item, post);
      queue = queue.filter((other) => other.id !== item.id);
      sent += 1;
    } catch (e) {
      const error = e as SendError;
      if (error.offline) { offline = true; break; }
      const review = error.duplicate || (error.status !== undefined && error.status < 500);
      queue = queue.map((other) => other.id === item.id ? { ...other, status: review ? "revisar" : "pendente", message: error.message, duplicate: Boolean(error.duplicate) } : other);
    }
  }
  return { items: queue, sent, offline };
}

/** Descartar um local leva junto as pessoas que só existiriam ligadas a ele. */
export function discard(items: QueueItem[], id: string) {
  return items.filter((item) => item.id !== id && !(item.kind === "person" && item.placeId === id));
}

/** "É outra pessoa": manda de novo, agora confirmando que não é a mesma. */
export function confirmDuplicate(items: QueueItem[], id: string) {
  return items.map((item) => item.id === id && item.kind === "person" ? { ...item, confirmDuplicate: true, duplicate: false, status: "pendente" as const, message: undefined } : item);
}

export function parseQueue(raw: string | null): QueueItem[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item) => item && (item.kind === "place" || item.kind === "person") && typeof item.id === "string") : [];
  } catch { return []; }
}
