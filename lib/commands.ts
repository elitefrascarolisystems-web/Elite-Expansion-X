import type { NavArea, NavLocation } from "@/lib/navigation";

/** Texto sem acento e em minúsculas, para "agenda" achar "Agenda" e "metodo" achar "Método". */
export const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Cada palavra digitada aparece no texto (em qualquer ordem). */
export function matches(term: string, text: string) {
  const words = normalize(term).split(/\s+/).filter(Boolean);
  const haystack = normalize(text);
  return words.every((word) => haystack.includes(word));
}

export type GoCommand = { id: string; group: "Nesta área" | "Ir para"; title: string; detail: string; location: NavLocation };

/**
 * Destinos da central de comandos. Busca vazia: as outras abas da área atual.
 * Com texto: as telas (área → aba) cujo nome ou descrição combina, menos a tela atual.
 * Só aparecem áreas e abas que esta função já vê no menu.
 */
export function goCommands(term: string, areas: NavArea[], current: NavLocation, limit = 8): GoCommand[] {
  if (!normalize(term)) {
    const area = areas.find((item) => item.id === current.area);
    if (!area) return [];
    return area.views.filter((view) => view.id !== current.view)
      .map((view) => ({ id: `go:${area.id}/${view.id}`, group: "Nesta área", title: view.label, detail: area.label, location: { area: area.id, view: view.id } }));
  }
  const screens = areas.flatMap((area) => area.views.length
    ? area.views.map((view) => ({ area, view: view as { id: string; label: string } | null }))
    : [{ area, view: null }]);
  return screens
    .filter(({ area, view }) => !(area.id === current.area && (view?.id ?? "") === current.view))
    .filter(({ area, view }) => matches(term, `${area.label} ${view?.label ?? ""} ${area.description}`))
    .slice(0, limit)
    .map(({ area, view }) => ({
      id: `go:${area.id}/${view?.id ?? ""}`, group: "Ir para",
      title: view ? `${area.label} → ${view.label}` : area.label, detail: area.description,
      location: { area: area.id, view: view?.id ?? "" },
    }));
}
