import Image from "next/image";
import { Compass, Network, Repeat2, Target, TrendingUp } from "lucide-react";

/** A cadeia que a plataforma acompanha, do território ao resultado. */
export const STRATEGY_CHAIN = ["Cidade", "Líder", "Embaixador", "Lead", "Gancho", "Conversa", "Diagnóstico", "Oferta", "Venda", "Resultado"];
const PILLARS = [
  { icon: Compass, label: "Expansão territorial" },
  { icon: Network, label: "Rede de embaixadores" },
  { icon: Target, label: "Funil comercial" },
  { icon: Repeat2, label: "Follow-up inteligente" },
  { icon: TrendingUp, label: "Performance" },
];

/** Cidades em órbita: [raio, ângulo inicial, tamanho]. */
const ORBITS: { r: number; speed: string; reverse?: boolean; cities: [number, number][] }[] = [
  { r: 228, speed: "elite-orbit-slow", cities: [[20, 3.5], [148, 2.5], [262, 3]] },
  { r: 300, speed: "elite-orbit-mid", reverse: true, cities: [[70, 2.5], [200, 4], [320, 2.5]] },
  { r: 372, speed: "elite-orbit-fast", cities: [[110, 3], [235, 2.5]] },
];

const point = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: 400 + r * Math.cos(a), y: 400 + r * Math.sin(a) };
};

/** Emblema oficial (versão sem fundo) no centro de um sistema de órbitas: cidades se acendendo ao redor da marca. */
export function OrbitalEmblem({ size = "lg" }: { size?: "sm" | "lg" }) {
  // Ids próprios por tamanho: a versão escondida (celular/computador) não pode emprestar o gradiente para a outra.
  const core = `elite-core-${size}`, ring = `elite-ring-${size}`;
  return (
    <div className={`elite-orbital ${size === "lg" ? "elite-orbital-lg" : "elite-orbital-sm"}`} aria-hidden={size === "sm"}>
      <svg viewBox="0 0 800 800" className="elite-orbital-svg" aria-hidden>
        <defs>
          <radialGradient id={core} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d6a645" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#c9a227" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3d27a" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#c9a227" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#f3d27a" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx="400" cy="400" r="400" fill={`url(#${core})`} className="elite-breathe" />
        {/* Malha de globo: meridianos e paralelos bem discretos. */}
        <g className="elite-globe" fill="none" stroke="#c9a227" strokeOpacity="0.09" strokeWidth="1">
          <circle cx="400" cy="400" r="176" />
          {[60, 112, 150].map((rx) => <ellipse key={rx} cx="400" cy="400" rx={rx} ry="176" />)}
          {[-110, -55, 0, 55, 110].map((dy) => { const half = Math.sqrt(176 * 176 - dy * dy); return <line key={dy} x1={400 - half} x2={400 + half} y1={400 + dy} y2={400 + dy} />; })}
        </g>
        {ORBITS.map((orbit) => (
          <g key={orbit.r} className={`elite-orbit ${orbit.speed}${orbit.reverse ? " elite-orbit-reverse" : ""}`}>
            <circle cx="400" cy="400" r={orbit.r} fill="none" stroke={`url(#${ring})`} strokeWidth="1" strokeDasharray={orbit.r === 300 ? "2 7" : undefined} />
            {orbit.cities.map(([deg, dot]) => { const p = point(orbit.r, deg); return (
              <g key={deg}>
                <circle cx={p.x} cy={p.y} r={dot * 3.2} fill="#f3d27a" opacity="0.12" className="elite-pulse" />
                <circle cx={p.x} cy={p.y} r={dot} fill="#f6dc8c" />
              </g>
            ); })}
          </g>
        ))}
      </svg>
      <Image src="/elite-emblem.png" alt="Elite Frascaroli Academy" width={541} height={541} priority className="elite-orbital-emblem" />
    </div>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "text-center" : ""}>
      <p className={`elite-wordmark ${compact ? "text-2xl" : "text-[1.6rem] xl:text-[2rem] 2xl:text-[2.5rem]"}`}>ELITE EXPANSION <span className="elite-wordmark-x">X</span></p>
      <p className={`mt-1 text-[11px] font-medium uppercase tracking-[0.42em] text-subtle ${compact ? "" : "pl-1"}`}>Elite Frascaroli Academy</p>
    </div>
  );
}

/** Lado da marca na tela de entrada: emblema em órbita, proposta, pilares e a cadeia da estratégia. */
export function BrandHero() {
  return (
    <section className="elite-hero relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-gold/10 px-12 py-12 lg:flex xl:px-16">
      <div className="elite-stars" aria-hidden />
      <div className="relative z-10"><Wordmark /></div>

      <OrbitalEmblem />
      <div className="relative z-10">
        <div className="max-w-[31rem] 2xl:max-w-[36rem]">
          <p className="section-kicker">Plataforma de expansão estratégica</p>
          <h2 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] text-white xl:text-[3.3rem] 2xl:text-[4rem]">
            Expansão com estratégia.<br /><span className="elite-gold-text">Cidade por cidade.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">Território, rede de embaixadores, funil comercial e follow-up com o Método F.E.C.H.A. A operação inteira da sua expansão, num só lugar, do primeiro contato ao resultado.</p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {PILLARS.map(({ icon: Icon, label }) => <li key={label} className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300"><Icon className="size-3.5 text-gold-soft" aria-hidden />{label}</li>)}
          </ul>
        </div>
      </div>

      <div className="relative z-10 space-y-5">
        <div className="elite-chain" aria-label={`Cadeia da estratégia: ${STRATEGY_CHAIN.join(", ")}`}>
          <div className="elite-chain-track" aria-hidden>
            {[0, 1].map((copy) => <div key={copy} className="flex shrink-0 items-center">{STRATEGY_CHAIN.map((step, index) => <span key={step} className="flex items-center"><span className={`elite-chain-step ${index === STRATEGY_CHAIN.length - 1 ? "elite-chain-final" : ""}`}>{step}</span><span className="elite-chain-link" /></span>)}</div>)}
          </div>
        </div>
        <div className="flex items-end justify-between gap-6 text-xs">
          <p className="font-medium uppercase tracking-[0.28em] text-gold/80">Mais visão · Mais estratégia · Mais impacto</p>
          <p className="text-subtle">Novos territórios, mesmo propósito.</p>
        </div>
      </div>
    </section>
  );
}
