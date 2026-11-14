"use client";
/* eslint-disable @next/next/no-img-element -- prévia local da logo escolhida (data URL). */
import { useState } from "react";
import { Check, ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ACCENT_KEYS, ACCENTS, DEFAULT_ACCENT, isAccent, type AccentKey } from "@/lib/accent";
import { useResolvedTheme } from "@/lib/app-theme";
import type { DashboardData } from "@/lib/expansion-types";
import { tenantFetch } from "@/lib/tenant-request";

export const logoUrl = (organizationId: number, version: string | null | undefined) =>
  version ? `/api/organization-logo?org=${organizationId}&v=${encodeURIComponent(version)}` : null;

/** Nome e logo da empresa (Gestão → Empresa → Identidade). A logo aparece na barra lateral e no mapa impresso. */
export function IdentityPanel({ data, onSaved }: { data: DashboardData; onSaved: () => Promise<void> }) {
  const current = logoUrl(data.access.organizationId, data.logoVersion);
  const [name, setName] = useState(data.access.organizationName);
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const [official, setOfficial] = useState(false);
  const savedAccent: AccentKey = isAccent(data.accent) ? data.accent : DEFAULT_ACCENT;
  const [accent, setAccent] = useState<AccentKey>(savedAccent);
  const theme = useResolvedTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = logo === undefined ? current : logo;

  function pick(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Use PNG, JPEG ou WebP. SVG não é aceito."); return; }
    if (file.size > 150000) { setError("A logo deve ter até 150 KB. Reduza a imagem e tente de novo."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.onerror = () => setError("Não foi possível ler o arquivo. Tente outro.");
    reader.readAsDataURL(file);
  }

  async function save(remove = false) {
    setBusy(true); setError("");
    try {
      const response = await tenantFetch("/api/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "identity", data: { name, accent, ...(remove ? { logo: null } : logo !== undefined ? { logo } : {}), official } }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
      toast.success(remove ? "Logo retirada." : accent !== savedAccent ? "Identidade salva. A nova cor já vale para toda a equipe." : "Identidade da empresa salva.");
      setLogo(undefined); setOfficial(false);
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar. Confira a conexão e tente de novo."); }
    finally { setBusy(false); }
  }

  return <article className="elite-card grid gap-6 p-6 lg:grid-cols-[16rem_1fr]">
    <div className="grid content-start justify-items-center gap-3">
      <div className="grid size-40 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">{preview ? <img src={preview} alt={`Logo da ${name}`} className="max-h-36 max-w-36 object-contain" /> : <span className="px-4 text-center text-sm text-subtle">Sem logo. A barra lateral mostra o nome da empresa.</span>}</div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"><ImageUp className="size-4" /> Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
      {current && logo === undefined && <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(true)} className="text-red-300 hover:text-red-200"><Trash2 /> Retirar logo</Button>}
    </div>
    <form className="grid content-start gap-4 text-sm" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div><p className="section-kicker">Identidade</p><h3 className="text-xl font-semibold text-white">Nome e logo da empresa</h3><p className="mt-1 text-subtle">Aparecem para toda a equipe na barra lateral e no mapa impresso. PNG, JPEG ou WebP, até 150 KB; de preferência com fundo transparente.</p></div>
      <label className="grid gap-1 text-zinc-300">Nome da empresa<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="commercial-input" /></label>
      {logo && <label className="flex items-start gap-2 text-zinc-300"><input type="checkbox" required checked={official} onChange={(e) => setOfficial(e.target.checked)} className="mt-1" />Confirmo que esta é a logo oficial da empresa e que temos autorização para usá-la.</label>}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-zinc-300">Cor da empresa <span className="text-subtle">— nos botões, destaques e abas ativas, para toda a equipe</span></legend>
        <div className="flex flex-wrap gap-2">{ACCENT_KEYS.map((key) => {
          const tones = ACCENTS[key][theme];
          return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 ${accent === key ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/5"}`}>
            <input type="radio" name="accent" value={key} checked={accent === key} onChange={() => setAccent(key)} className="sr-only" />
            <span aria-hidden className="grid size-6 place-items-center rounded-full" style={{ background: tones.gold, color: theme === "light" ? "#fff" : "#000" }}>{accent === key && <Check className="size-3.5" />}</span>
            <span className="text-sm text-white">{ACCENTS[key].label}</span>
          </label>;
        })}</div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <span className="text-xs text-subtle">Prévia:</span>
          <span className="section-kicker !mb-0" style={{ color: ACCENTS[accent][theme].light }}>Resultados</span>
          <span className="pointer-events-none inline-flex h-8 items-center rounded-md bg-gold px-3 text-sm font-medium" style={{ backgroundImage: `linear-gradient(180deg, ${ACCENTS[accent][theme].light}, ${ACCENTS[accent][theme].gold} 55%, ${ACCENTS[accent][theme].deep})`, color: theme === "light" ? "#fff" : "#0a0a09" }}>Salvar</span>
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">{error}</p>}
      <div><Button type="submit" disabled={busy} className="bg-gold text-black">{busy && <LoaderCircle className="animate-spin" />} Salvar identidade</Button></div>
    </form>
  </article>;
}
