import type { LucideIcon } from "lucide-react";

/** Ilustração dos estados vazios: o ícone da tela no centro de órbitas em traço dourado. */
export function EmptyArt({ icon: Icon }: { icon: LucideIcon }) {
  return <span className="elite-empty-art" aria-hidden>
    <svg viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" className="elite-empty-orbit is-far" />
      <ellipse cx="60" cy="60" rx="50" ry="22" transform="rotate(-24 60 60)" className="elite-empty-orbit" />
      <ellipse cx="60" cy="60" rx="38" ry="15" transform="rotate(32 60 60)" className="elite-empty-orbit is-near" />
      <circle cx="104" cy="40" r="2.5" className="elite-empty-star" />
      <circle cx="20" cy="82" r="2" className="elite-empty-star" />
      <circle cx="84" cy="98" r="1.5" className="elite-empty-star" />
    </svg>
    <span className="elite-empty-core"><Icon className="size-6" /></span>
  </span>;
}
