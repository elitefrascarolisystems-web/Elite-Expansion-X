import type { AccessView } from "@/lib/expansion-types";

/**
 * Navegação por áreas. Cada função vê só as áreas e sub-abas em que pode fazer
 * algo; as permissões continuam no servidor, aqui só se decide o que mostrar.
 */
export type AreaId = "hoje" | "territorio" | "vendas" | "rede" | "resultados" | "gestao" | "plataforma";
export type NavView = { id: string; label: string };
export type NavArea = { id: AreaId; label: string; description: string; views: NavView[] };
export type NavLocation = { area: AreaId; view: string };
export type NavOptions = { hasAdvisors: boolean };

const MANAGEMENT = ["Administrador", "Coordenação", "Líder"];

export const AREA_IDS: readonly AreaId[] = ["hoje", "territorio", "vendas", "rede", "resultados", "gestao", "plataforma"];

export function navigationFor(access: AccessView, { hasAdvisors }: NavOptions): NavArea[] {
  const manage = MANAGEMENT.includes(access.role);
  const admin = access.role === "Administrador";
  const only = (condition: boolean, view: NavView) => (condition ? [view] : []);
  const areas: NavArea[] = [
    { id: "hoje", label: "Hoje", description: "O que fazer agora: retornos do dia, próximos passos e alertas.", views: [] },
    {
      id: "territorio", label: "Território", description: "Onde e com quem atuamos: mapa, cidades e locais.",
      views: [{ id: "mapa", label: "Mapa" }, ...only(manage, { id: "cidades", label: "Cidades" }), { id: "locais", label: "Locais" }],
    },
    {
      id: "vendas", label: "Vendas", description: "Do primeiro contato ao pagamento, e o cuidado depois da venda.",
      views: [
        { id: "agenda", label: "Agenda" }, { id: "atendimentos", label: "Atendimentos" }, { id: "fecha", label: "Método F.E.C.H.A." },
        { id: "pagamentos", label: "Pagamentos" }, { id: "posvenda", label: "Pós-venda" },
      ],
    },
    {
      id: "rede", label: "Rede", description: "Quem multiplica a operação: embaixadores, indicações, mentorados e parceiros.",
      views: [
        ...only(manage, { id: "embaixadores", label: "Embaixadores" }), { id: "indicacoes", label: "Indicações" },
        ...only(admin, { id: "mentorados", label: "Mentorados" }), ...only(manage, { id: "parceiros", label: "Parceiros e eventos" }),
        ...only(manage, { id: "materiais", label: "Materiais" }),
      ],
    },
    {
      id: "resultados", label: "Resultados", description: "Como estamos indo: indicadores, metas, mapeamento e custos.",
      views: [
        ...only(manage, { id: "visao", label: "Visão geral" }), { id: "metas", label: "Metas e rotina" },
        ...only(manage, { id: "mapeamento", label: "Mapeamento" }), ...only(manage, { id: "custos", label: "Custos e canais" }),
      ],
    },
    {
      id: "gestao", label: "Gestão", description: "Equipe, regras, plano e histórico da empresa.",
      views: admin ? [
        { id: "time", label: "Time e acessos" }, { id: "regras", label: "Regras e cálculos" },
        ...only(access.organizationId !== 1, { id: "plano", label: "Plano" }), { id: "historico", label: "Histórico" },
        ...only(hasAdvisors, { id: "assessoria", label: "Assessoria Elite" }),
      ] : [],
    },
    {
      id: "plataforma", label: "Plataforma", description: "Empresas assinantes e a equipe de assessoria da Elite.",
      views: access.isPlatformOwner ? [{ id: "assinaturas", label: "Assinaturas" }, { id: "assessores", label: "Assessores" }] : [],
    },
  ];
  // "Hoje" não tem sub-abas; as outras áreas só aparecem se tiverem alguma.
  return areas.filter((area) => area.id === "hoje" || area.views.length > 0);
}

/** Onde cada função começa. */
export function defaultLocation(access: AccessView): NavLocation {
  if (access.role === "Comercial") return { area: "vendas", view: "agenda" };
  if (access.role === "Coordenação") return { area: "territorio", view: "mapa" };
  return { area: "hoje", view: "" };
}

/** Corrige um endereço (?area=&ver=) para algo que esta função pode ver. */
export function resolveLocation(areas: NavArea[], access: AccessView, area?: string | null, view?: string | null): NavLocation {
  const target = areas.find((item) => item.id === area);
  if (!target) return defaultLocation(access);
  if (!target.views.length) return { area: target.id, view: "" };
  return { area: target.id, view: target.views.some((item) => item.id === view) ? view! : target.views[0].id };
}

/** "vendas/agenda" ou "vendas" → local; "mapear" não é um local (abre o mapeamento guiado). */
export function parseTarget(target: string): { area: string; view: string | null } {
  const [area, view] = target.split("/");
  return { area, view: view ?? null };
}
