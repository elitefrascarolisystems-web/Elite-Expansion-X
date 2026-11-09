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

// `hasAdvisors` ficou para compatibilidade: a Assessoria Elite agora é um bloco de Gestão → Equipe.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function navigationFor(access: AccessView, _options: NavOptions): NavArea[] {
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
        { id: "agenda", label: "Agenda" }, { id: "atendimentos", label: "Atendimentos" },
      ],
    },
    {
      id: "rede", label: "Rede", description: "Quem multiplica a operação: embaixadores, indicações, mentorados e parceiros.",
      views: [
        ...only(manage, { id: "embaixadores", label: "Embaixadores" }), { id: "indicacoes", label: "Indicações" },
        ...only(admin, { id: "mentorados", label: "Mentorados" }), ...only(manage, { id: "parceiros", label: "Parceiros e eventos" }),
        ...only(manage, { id: "materiais", label: "Materiais e ganchos" }),
      ],
    },
    {
      id: "resultados", label: "Resultados", description: "Como estamos indo: indicadores, metas, mapeamento e custos.",
      views: [
        ...only(manage, { id: "visao", label: "Visão geral" }), ...only(manage, { id: "calculadora", label: "Calculadora" }), { id: "metas", label: "Metas e rotina" },
        ...only(manage, { id: "mapeamento", label: "Mapeamento" }),
      ],
    },
    {
      id: "gestao", label: "Gestão", description: "Equipe, dados e regras da empresa, privacidade (LGPD) e histórico.",
      // Simplificação, parte 4: 4 abas. Equipe = Time e acessos (+ Assessoria Elite); Empresa = Identidade, Plano,
      // Regras e cálculos e Avisos por e-mail, em blocos na mesma página.
      views: admin ? [
        { id: "equipe", label: "Equipe" }, { id: "empresa", label: "Empresa" },
        { id: "privacidade", label: "Privacidade (LGPD)" }, { id: "historico", label: "Histórico" },
      ] : [],
    },
    {
      id: "plataforma", label: "Plataforma", description: "Empresas assinantes, pedidos vindos da página pública e a equipe de assessoria da Elite.",
      // O servidor só marca como dona da plataforma a função Administrador (db/access.ts); aqui vale a mesma regra.
      views: admin && access.isPlatformOwner ? [{ id: "assinaturas", label: "Assinaturas" }, { id: "pedidos", label: "Pedidos de assinatura" }, { id: "assessores", label: "Assessores" }] : [],
    },
  ];
  // "Hoje" não tem sub-abas; as outras áreas só aparecem se tiverem alguma.
  // A frase de cada área cita só o que esta função vê (o Comercial não vê alertas, cidades, embaixadores nem custos).
  const text: Partial<Record<AreaId, string>> = !manage ? {
    hoje: "O que fazer agora: retornos do dia e próximos passos.",
    territorio: "Onde e com quem atuamos: mapa e locais.",
    rede: "Quem indicou quem: a sua rede de indicações.",
    resultados: "Sua rotina do dia e as atividades registradas.",
  } : !admin ? { rede: "Quem multiplica a operação: embaixadores, indicações e parceiros." } : {};
  return areas.filter((area) => area.id === "hoje" || area.views.length > 0).map((area) => (text[area.id] ? { ...area, description: text[area.id]! } : area));
}

/** Onde cada função começa. */
export function defaultLocation(access: AccessView): NavLocation {
  if (access.role === "Comercial") return { area: "vendas", view: "agenda" };
  if (access.role === "Coordenação") return { area: "territorio", view: "mapa" };
  return { area: "hoje", view: "" };
}

/** Vendas → Pagamentos virou o filtro "Com pagamento" de Atendimentos; F.E.C.H.A. e Pós-venda, filtros da Agenda. */
export const OLD_VIEWS: Record<string, string> = { pagamentos: "atendimentos", fecha: "agenda", posvenda: "agenda" };
/** Abas que viraram blocos de outra aba (parte 4): os endereços antigos continuam abrindo o lugar certo. */
export const OLD_AREA_VIEWS: Record<string, Record<string, string>> = {
  vendas: OLD_VIEWS,
  resultados: { custos: "visao" },
  gestao: { time: "equipe", assessoria: "equipe", regras: "empresa", identidade: "empresa", plano: "empresa", avisos: "empresa" },
};
/** Filtro rápido que o endereço antigo abre já marcado. */
export const OLD_VIEW_QUICK: Record<string, string> = { pagamentos: "paid", fecha: "fecha", posvenda: "aftercare" };

/** Corrige um endereço (?area=&ver=) para algo que esta função pode ver. */
export function resolveLocation(areas: NavArea[], access: AccessView, area?: string | null, view?: string | null): NavLocation {
  // Abas que viraram filtros (simplificação, parte 2): os endereços antigos continuam abrindo o lugar certo.
  if (area && view && OLD_AREA_VIEWS[area]?.[view]) view = OLD_AREA_VIEWS[area][view];
  // Ganchos foi para Rede → Materiais e ganchos (parte 3); quem não vê Rede → Materiais volta para a Agenda.
  if (area === "vendas" && view === "ganchos") {
    const library = areas.find((item) => item.id === "rede")?.views.some((item) => item.id === "materiais");
    return library ? { area: "rede", view: "materiais" } : { area: "vendas", view: "agenda" };
  }
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
