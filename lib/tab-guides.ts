import type { UserRole } from "@/lib/expansion-types";
import { GUIDE_CONTENT } from "@/lib/tab-guides-content";
import type { GuideKey } from "@/lib/tab-guide-keys";

/**
 * Guias "Como usar": um por tela e um por portal. Arquivo só de dados, carregado
 * sob demanda (import()) quando a tela ainda não foi vista ou o botão "Como usar"
 * é tocado. Nada daqui é gravado no banco: o exemplo é texto fixo, com nomes fictícios.
 */

/** "Fazer agora": "novo:<id>" (ação do + Novo), "aba:<area>/<view>", "mapear" ou "portal:<id>". */
export type GuideAction = string;

export type GuideText = {
  /** 1 frase, até 120 caracteres. */
  paraQueServe: string;
  /** Exatamente 3, até 100 caracteres cada. */
  passos: readonly [string, string, string];
  /** Até 280 caracteres, sempre com o selo "Exemplo" na tela. */
  exemplo: string;
  /** Só quando há LGPD ou permissão: até 2 frases. */
  cuidado?: string;
  acao?: GuideAction;
};

export type TabGuide = GuideText & {
  /** "Como usar: <aba>", até 40 caracteres. */
  titulo: string;
  /** Funções que veem esta tela (a cobertura é conferida em tests/tab-guides.test.mjs). */
  funcoes: readonly UserRole[];
  /** Só o que muda para uma função (o Comercial, por exemplo). */
  porFuncao?: Partial<Record<UserRole, Partial<GuideText>>>;
};

export type ResolvedGuide = {
  key: GuideKey; titulo: string; paraQueServe: string; passos: readonly string[]; exemplo: string; cuidado?: string; acao?: GuideAction;
};

/**
 * `cartao`: "para que serve" + " 1º passo: " + 1º passo, para caber em 3 linhas no cartão a 390 px.
 * Medido no próprio app (Inter 13 px numa coluna de 328 px): de 145 caracteres em diante já pode
 * passar de 3 linhas; o limite de 135 deixa folga e vale com um nome de empresa longo.
 */
export const GUIDE_LIMITS = { titulo: 40, paraQueServe: 120, passo: 100, exemplo: 280, cuidado: 240, palavras: 130, cartao: 135 } as const;

export const TAB_GUIDES: Record<GuideKey, TabGuide> = GUIDE_CONTENT;

/** O guia como a função vê: a variação dela por cima do texto geral e {empresa} trocado pelo nome. */
export function resolveGuide(key: GuideKey, role: UserRole, organizationName: string): ResolvedGuide {
  const base = TAB_GUIDES[key];
  const variant = base.porFuncao?.[role] ?? {};
  const fill = (text: string) => text.replaceAll("{empresa}", organizationName);
  const cuidado = variant.cuidado ?? base.cuidado;
  const acao = variant.acao ?? base.acao;
  return {
    key,
    titulo: base.titulo,
    paraQueServe: fill(variant.paraQueServe ?? base.paraQueServe),
    passos: (variant.passos ?? base.passos).map(fill),
    exemplo: fill(variant.exemplo ?? base.exemplo),
    ...(cuidado ? { cuidado: fill(cuidado) } : {}),
    ...(acao ? { acao } : {}),
  };
}

/** Todo o texto do guia, para o Ctrl+K achar "Ajuda: Agenda" quando se digita "retorno". */
export const guideSearchText = (guide: ResolvedGuide) => [guide.titulo, guide.paraQueServe, ...guide.passos, guide.exemplo].join(" ");
