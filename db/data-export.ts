/**
 * Cópia completa dos dados da empresa: um ZIP com uma planilha (CSV) por tabela, a logo e um LEIA-ME.
 * Só o administrador da própria empresa baixa (a assessoria não). Senhas, sessões, links de senha,
 * chaves da verificação em duas etapas e registros internos da plataforma nunca entram.
 * Não depende do plano: os dados são da empresa.
 */
import { strToU8, zipSync } from "fflate";
import { audit, brazilTimestamp, database } from "@/db/runtime";
import { getLogo } from "@/db/identity";
import type { AccessView } from "@/lib/expansion-types";

export class ExportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const ORG = "organization_id=?";
const CITY = "city_id IN (SELECT id FROM cities WHERE organization_id=?)";

export type ExportPart = { file: string; about: string; table: string; where: string; omit?: string[] };

/** Cada planilha do ZIP: tabela, filtro da empresa (um único "?") e colunas que nunca saem. */
export const EXPORT_PARTS: ExportPart[] = [
  { file: "empresa.csv", about: "Dados da empresa e regras de acesso (verificação em duas etapas, assessoria)", table: "organizations", where: "id=?", omit: ["request_id"] },
  { file: "perfil-da-empresa.csv", about: "Objetivo e primeiros passos (a logo vai à parte)", table: "organization_profiles", where: ORG, omit: ["logo"] },
  { file: "configuracoes.csv", about: "Configurações: mínimos para decidir, atribuição e origem", table: "settings", where: ORG },
  { file: "equipe.csv", about: "Pessoas da equipe, funções e mentorados", table: "app_users", where: ORG, omit: ["guides_seen"] },
  { file: "convites.csv", about: "Convites enviados para a equipe", table: "organization_invites", where: ORG, omit: ["token_hash"] },
  { file: "cidades.csv", about: "Cidades e praças", table: "cities", where: ORG },
  { file: "numeros-das-cidades.csv", about: "Números de cada cidade por período", table: "city_updates", where: CITY },
  { file: "decisoes-das-cidades.csv", about: "Decisões sobre cada cidade e os motivos", table: "city_decisions", where: ORG },
  { file: "regioes.csv", about: "Regiões e bairros", table: "territory_regions", where: CITY },
  { file: "locais.csv", about: "Locais do mapa (empresas, pontos de venda, parceiros)", table: "businesses", where: ORG },
  { file: "pontos-no-mapa.csv", about: "Coordenadas dos locais (nunca de pessoas)", table: "territory_locations", where: CITY },
  { file: "pessoas.csv", about: "Pessoas da rede (sem endereço residencial)", table: "territory_people", where: CITY },
  { file: "papeis-das-pessoas.csv", about: "Papel de cada pessoa na rede", table: "territory_roles", where: CITY },
  { file: "pessoas-nos-locais.csv", about: "Vínculos autorizados entre pessoas e locais", table: "person_places", where: ORG },
  { file: "acoes-no-territorio.csv", about: "Ações combinadas no território", table: "territory_actions", where: CITY },
  { file: "parceiros.csv", about: "Parceiros (cadastro antigo)", table: "partners", where: CITY },
  { file: "eventos.csv", about: "Eventos", table: "events", where: CITY },
  { file: "embaixadores.csv", about: "Embaixadores", table: "ambassadors", where: CITY },
  { file: "numeros-dos-embaixadores.csv", about: "Números de cada embaixador por período", table: "ambassador_updates", where: `ambassador_id IN (SELECT id FROM ambassadors WHERE ${CITY})` },
  { file: "conteudos.csv", about: "Conteúdos e materiais", table: "contents", where: ORG },
  { file: "contatos.csv", about: "Contatos (leads) e consentimentos", table: "leads", where: CITY, omit: ["normalized_email", "normalized_whatsapp"] },
  { file: "atendimentos.csv", about: "Atendimentos (oportunidades) e etapas", table: "opportunities", where: ORG },
  { file: "mudancas-de-etapa.csv", about: "Cada mudança de etapa dos atendimentos", table: "opportunity_stage_events", where: ORG },
  { file: "atividades-comerciais.csv", about: "Ligações, visitas e mensagens registradas", table: "commercial_activities", where: ORG },
  { file: "acompanhamentos.csv", about: "Acompanhamento dos atendimentos parados", table: "followup_events", where: ORG },
  { file: "vendas.csv", about: "Vendas e pagamentos", table: "sales", where: CITY },
  { file: "custos.csv", about: "Custos por cidade, canal e período", table: "costs", where: CITY },
  { file: "metas.csv", about: "Metas da empresa, das cidades e das pessoas", table: "goals", where: ORG },
  { file: "metas-do-dia.csv", about: "Metas diárias dos vendedores", table: "seller_goals", where: ORG },
  { file: "relatorios-do-dia.csv", about: "Relatórios diários dos vendedores", table: "seller_reports", where: ORG },
  { file: "tarefas.csv", about: "Tarefas", table: "tasks", where: ORG },
  { file: "ganchos-de-prospeccao.csv", about: "Ganchos de prospecção", table: "prospect_hooks", where: ORG },
  { file: "jornada-passos.csv", about: "Passos da jornada dos mentorados", table: "portal_steps", where: ORG },
  { file: "jornada-progresso.csv", about: "Passos concluídos por cada mentorado", table: "portal_progress", where: "user_id IN (SELECT id FROM app_users WHERE organization_id=?)" },
  { file: "pedidos-de-privacidade.csv", about: "Pedidos de titulares (LGPD) e respostas", table: "privacy_requests", where: ORG },
  { file: "avisos-preferencias.csv", about: "Quem recebe os avisos por e-mail", table: "notification_prefs", where: ORG, omit: ["token"] },
  { file: "avisos-enviados.csv", about: "Avisos por e-mail enviados", table: "notification_log", where: ORG },
  { file: "historico.csv", about: "Histórico de alterações (quem fez o quê e quando)", table: "audit_logs", where: ORG },
];

/** Tabelas que nunca entram na cópia (segredos de acesso e registros internos da plataforma). */
export const EXPORT_EXCLUDED = [
  "user_credentials", "user_sessions", "password_links", "user_mfa", "mfa_challenges", "login_throttle",
  "platform_advisors", "platform_audit", "organization_subscriptions", "organization_entitlements", "organization_plans",
  "subscription_requests", "notification_runs",
];

const PAGE = 1000;

/** Texto que começa com =, +, - ou @ vira fórmula na planilha: ganha um apóstrofo na frente. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(?:[.,]\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

async function tableCsv(organizationId: number, part: ExportPart): Promise<{ csv: string; rows: number }> {
  const db = database();
  const columns = (await db.prepare(`PRAGMA table_info(${part.table})`).all()).results
    .map((c) => String(c.name)).filter((name) => !part.omit?.includes(name));
  const lines = [columns.map(cell).join(";")];
  let rows = 0;
  for (let offset = 0; ; offset += PAGE) {
    const page = (await db.prepare(`SELECT ${columns.map((c) => `"${c}"`).join(",")} FROM ${part.table} WHERE ${part.where} ORDER BY rowid LIMIT ${PAGE} OFFSET ${offset}`)
      .bind(organizationId).all()).results;
    for (const row of page) lines.push(columns.map((c) => cell(row[c])).join(";"));
    rows += page.length;
    if (page.length < PAGE) break;
  }
  // BOM: o Excel em português abre com acentos certos; separador ";" como nos outros relatórios.
  return { csv: `﻿${lines.join("\r\n")}\r\n`, rows };
}

const slug = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "empresa";

/** Monta o ZIP. Fica no Histórico da empresa. */
export async function exportOrganization(access: AccessView): Promise<{ filename: string; bytes: Uint8Array }> {
  if (!access.active || access.role !== "Administrador" || access.isAdvisory) throw new ExportError("Só o administrador da empresa baixa a cópia completa dos dados.", 403);
  const org = access.organizationId;
  const db = database();
  const name = String((await db.prepare("SELECT name FROM organizations WHERE id=?").bind(org).all()).results[0]?.name ?? "empresa");
  const now = brazilTimestamp(), day = now.slice(0, 10);
  const files: Record<string, Uint8Array> = {};
  const index: string[] = [];
  for (const part of EXPORT_PARTS) {
    const { csv, rows } = await tableCsv(org, part);
    files[part.file] = strToU8(csv);
    index.push(`${part.file.padEnd(34)} ${String(rows).padStart(7)} linha${rows === 1 ? " " : "s"}  ${part.about}`);
  }
  const logo = org === 1 ? null : await getLogo(org);
  if (logo) files[`logo.${logo.type.split("/")[1].replace("jpeg", "jpg")}`] = logo.bytes;
  files["LEIA-ME.txt"] = strToU8([
    `Elite Expansion X — cópia completa dos dados`,
    `Empresa: ${name}`,
    `Gerada em ${day.split("-").reverse().join("/")} às ${now.slice(11, 16)} (horário de Brasília) por ${access.email}.`,
    ``,
    `Cada planilha (.csv) abre no Excel, no Google Planilhas ou no LibreOffice. Separador: ponto e vírgula.`,
    `Os nomes das colunas são os do sistema, para a cópia servir também de backup.`,
    `Textos que começam com =, +, - ou @ ganham um apóstrofo na frente para não virar fórmula.`,
    ``,
    `Não entram na cópia: senhas, sessões, links de senha, chaves da verificação em duas etapas`,
    `e registros internos da plataforma (assinatura, limites do plano e equipe da assessoria).`,
    `Pessoas nunca têm endereço residencial nem coordenada; as coordenadas são só dos locais.`,
    ``,
    `Esta cópia tem dados pessoais (equipe, contatos, pessoas da rede). Guarde em lugar seguro,`,
    `compartilhe só com quem precisa e apague quando não precisar mais (LGPD).`,
    ``,
    `Arquivos:`,
    ...index,
    ...(logo ? [`logo                               Logo da empresa`] : []),
    ``,
  ].join("\r\n"));
  const bytes = zipSync(files, { level: 6, mtime: new Date() });
  await audit(db, org, access.email, "data_export", "organization", org, "Cópia completa dos dados baixada (planilhas em ZIP).");
  return { filename: `elite-x-${slug(name)}-${day}.zip`, bytes };
}
