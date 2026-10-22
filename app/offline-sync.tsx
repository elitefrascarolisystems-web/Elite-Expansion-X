"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloudOff, CloudUpload, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AccessView } from "@/lib/expansion-types";
import { confirmDuplicate, discard, flushQueue, itemsFor, offlineError, parseQueue, QUEUE_KEY, waitingPlace, type Post, type QueueItem } from "@/lib/offline-queue";
import { ORGANIZATION_HEADER } from "@/lib/tenant-request";

// Fila guardada neste aparelho (localStorage), lida pelas telas com useSyncExternalStore.
const EMPTY: QueueItem[] = [];
const listeners = new Set<() => void>();
let snapshot: { raw: string | null; items: QueueItem[] } = { raw: null, items: EMPTY };
function readQueue() {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(QUEUE_KEY); } catch { /* sem armazenamento */ }
  if (raw !== snapshot.raw) snapshot = { raw, items: parseQueue(raw) };
  return snapshot.items;
}
function writeQueue(items: QueueItem[]) {
  try {
    if (items.length) window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    else window.localStorage.removeItem(QUEUE_KEY);
  } catch { throw new Error("Não foi possível guardar neste aparelho. Libere espaço no celular e tente de novo."); }
  listeners.forEach((listener) => listener());
}
function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}

export function useOfflineQueue() { return useSyncExternalStore(subscribeQueue, readQueue, () => EMPTY); }

const FLUSH_EVENT = "elite-offline-flush";
/** Guarda um cadastro feito sem internet e tenta enviar assim que der. */
export function enqueue(item: QueueItem) {
  writeQueue([...readQueue(), item]);
  window.dispatchEvent(new Event(FLUSH_EVENT));
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener); window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
export function useOnline() { return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true); }

const post: Post = async (url, body, organizationId) => {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", [ORGANIZATION_HEADER]: String(organizationId) }, body: JSON.stringify(body), cache: "no-store" }).catch(() => { throw offlineError(); });
  const result = await response.json().catch(() => null);
  // Resposta que não é da API (ex.: tela de entrada depois de a sessão expirar): tenta de novo depois.
  if (!result) throw Object.assign(new Error("Entre de novo na plataforma para enviar."), { status: 503 });
  if (!response.ok || result.ok === false) throw Object.assign(new Error(result.error || "Não foi possível enviar."), { duplicate: Boolean(result.duplicate), status: response.status });
  return result;
};

let running = false;
async function flush(email: string) {
  if (running || !navigator.onLine) return 0;
  const before = readQueue();
  if (!before.some((item) => item.email.toLowerCase() === email.toLowerCase() && item.status === "pendente")) return 0;
  running = true;
  try {
    const result = await flushQueue(before, email, post);
    // Mescla com o que mudou durante o envio (novos cadastros, descartes).
    const sentIds = new Set(before.map((item) => item.id)), next = new Map(result.items.map((item) => [item.id, item]));
    writeQueue(readQueue().filter((item) => !sentIds.has(item.id) || next.has(item.id)).map((item) => next.get(item.id) ?? item));
    return result.sent;
  } finally { running = false; }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Aviso de conexão e envio automático da fila: ao abrir, quando o sinal volta,
 * depois de cada novo cadastro e, havendo pendências, a cada 45 segundos.
 */
export function OfflineSync({ access, cities, onSynced }: { access: AccessView; cities: { id: number; name: string }[]; onSynced: () => Promise<void> }) {
  const online = useOnline();
  const all = useOfflineQueue();
  const mine = itemsFor(all, access.organizationId, access.email);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  // O painel recria a função de atualizar a cada render; o envio automático não deve reiniciar por isso.
  const synced = useRef(onSynced);
  useEffect(() => { synced.current = onSynced; }, [onSynced]);
  const pending = mine.filter((item) => item.status === "pendente").length, review = mine.length - pending;

  const run = useCallback(async (manual = false) => {
    if (manual) setSending(true);
    try {
      const sent = await flush(access.email);
      if (sent) {
        toast.success(`${plural(sent, "cadastro feito sem internet foi enviado", "cadastros feitos sem internet foram enviados")}.`);
        await synced.current().catch(() => undefined);
      } else if (manual && !navigator.onLine) toast.info("Ainda sem internet. Os cadastros continuam guardados neste aparelho.");
    } finally { if (manual) setSending(false); }
  }, [access.email]);

  useEffect(() => {
    const auto = () => { void run(); };
    auto();
    window.addEventListener("online", auto); window.addEventListener(FLUSH_EVENT, auto);
    const timer = window.setInterval(auto, 45_000);
    return () => { window.removeEventListener("online", auto); window.removeEventListener(FLUSH_EVENT, auto); window.clearInterval(timer); };
  }, [run]);

  if (online && !mine.length) return null;
  const city = (id: number) => cities.find((item) => item.id === id)?.name ?? "Cidade";
  const remove = (item: QueueItem) => {
    const people = item.kind === "place" ? mine.filter((other) => other.kind === "person" && other.placeId === item.id).length : 0;
    if (!window.confirm(people ? `Descartar ${item.label} e ${plural(people, "pessoa ligada", "pessoas ligadas")} a ele? Nada disso será enviado.` : `Descartar ${item.label}? Este cadastro não será enviado.`)) return;
    writeQueue(discard(readQueue(), item.id));
  };

  return <>
    <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm ${online ? "border-gold/20 bg-gold/[0.07] text-zinc-200" : "border-amber-300/25 bg-amber-300/10 text-amber-50"}`}>
      {online ? <CloudUpload className="size-4 shrink-0 text-gold-soft" aria-hidden /> : <CloudOff className="size-4 shrink-0 text-amber-200" aria-hidden />}
      <p className="min-w-0 flex-1">
        {online ? <>{pending > 0 && <>{plural(pending, "cadastro aguardando envio", "cadastros aguardando envio")}. </>}{review > 0 && <strong>{plural(review, "precisa", "precisam")} da sua revisão.</strong>}</>
          : <>Sem internet. Pode continuar mapeando: os cadastros ficam guardados neste aparelho e são enviados quando o sinal voltar.{mine.length > 0 && <> <strong>{plural(mine.length, "guardado", "guardados")}.</strong></>}</>}
      </p>
      <div className="flex gap-1">
        {online && pending > 0 && <Button size="sm" disabled={sending} onClick={() => run(true)} className="bg-gold text-black hover:bg-gold-hover">{sending ? <LoaderCircle className="animate-spin" /> : <CloudUpload />} Enviar agora</Button>}
        {mine.length > 0 && <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="text-gold-soft hover:bg-white/5">Ver</Button>}
      </div>
    </div>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto border-white/10 bg-surface pb-8 text-white">
        <SheetHeader><SheetTitle className="text-white">Cadastros guardados neste aparelho</SheetTitle><SheetDescription className="text-zinc-400">Feitos sem internet. Saem daqui assim que chegam à plataforma.</SheetDescription></SheetHeader>
        <ul className="grid gap-2 px-4" aria-label="Cadastros guardados">{mine.map((item) => {
          const waiting = waitingPlace(item, mine);
          return <li key={item.id} className={`grid gap-2 rounded-xl border p-3 text-sm ${item.status === "revisar" ? "border-amber-300/30 bg-amber-300/[0.06]" : "border-white/8 bg-white/[0.03]"}`}>
            <div className="flex flex-wrap items-baseline gap-x-2"><strong className="text-white">{item.label}</strong><span className="text-xs text-subtle">{item.kind === "place" ? "Local" : "Pessoa"} · {city(item.cityId)} · {new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div>
            <p className={item.status === "revisar" ? "flex items-start gap-1.5 text-amber-100" : "text-zinc-400"}>{item.status === "revisar" && <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}{item.status === "revisar" ? item.message : waiting ? `Aguardando o envio de ${waiting.label}.` : item.message ? `Ainda não enviado: ${item.message}` : "Aguardando envio."}</p>
            <div className="flex flex-wrap gap-2">
              {item.status === "revisar" && item.kind === "person" && item.duplicate && <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => enqueueRetry(item.id)}>É outra pessoa: enviar mesmo assim</Button>}
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:bg-white/5 hover:text-white" onClick={() => remove(item)}>Descartar</Button>
            </div>
          </li>;
        })}</ul>
      </SheetContent>
    </Sheet>
  </>;
}

function enqueueRetry(id: string) {
  writeQueue(confirmDuplicate(readQueue(), id));
  window.dispatchEvent(new Event(FLUSH_EVENT));
}
