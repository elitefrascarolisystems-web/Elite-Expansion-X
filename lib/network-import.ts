import { nameKey } from "@/lib/places";

/**
 * Importação da rede por planilha: uma linha por pessoa, com quem indicou, contato e venda.
 * Tudo aqui é puro (sem banco) para a prévia no navegador e para os testes.
 */

export const NETWORK_COLUMNS = [
  ["name", "Nome", ["nome", "pessoa", "nome completo"]],
  ["city", "Cidade", ["cidade", "municipio"]],
  ["whatsapp", "WhatsApp", ["whatsapp", "telefone", "celular", "fone", "zap"]],
  ["email", "E-mail", ["e mail", "email"]],
  ["referrer", "Quem indicou", ["quem indicou", "indicado por", "indicador", "indicacao", "indicou"]],
  ["role", "Papel", ["papel", "tipo", "funcao"]],
  ["place", "Local", ["local", "empresa", "estabelecimento"]],
  ["link", "Vínculo", ["vinculo", "vinculo com o local"]],
  ["product", "Produto", ["produto", "mentoria", "programa", "plano"]],
  ["amount", "Valor", ["valor", "valor pago", "valor da venda", "preco", "r"]],
  ["paidAt", "Data do pagamento", ["data do pagamento", "pagamento", "data", "pago em", "data da venda"]],
  ["saleStatus", "Situação da venda", ["situacao da venda", "situacao", "status", "status da venda"]],
] as const;
export type NetworkColumn = (typeof NETWORK_COLUMNS)[number][0];

export const NETWORK_TEMPLATE =
  "﻿Nome;Cidade;WhatsApp;E-mail;Quem indicou;Papel;Produto;Valor;Data do pagamento;Situação da venda\r\n" +
  "Ana Souza;Esmeraldas;31 99999-0001;ana@exemplo.com;;Mentorado;Mentoria Elite;1.500,00;10/03/2026;Pagamento confirmado\r\n" +
  "Bruno Lima;Esmeraldas;31 99999-0002;;Ana Souza;Mentorado;Mentoria Elite;1.500,00;22/04/2026;Pagamento confirmado\r\n" +
  "Carla Dias;Esmeraldas;31 99999-0003;;Bruno Lima;;;;;\r\n";

export const SALE_STATUSES = ["Em negociação", "Venda confirmada", "Pagamento confirmado", "Cancelada", "Reembolsada"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/** Linha já interpretada, pronta para o servidor. */
export type NetworkRow = {
  line: number;
  cityId: number;
  name: string;
  whatsapp: string;
  email: string;
  referrer: string;
  role: string;
  place: string;
  link: string;
  product: string;
  amountCents: number;
  paidAt: string;
  saleStatus: SaleStatus | "";
};

export type RowProblem = { line: number; ok: false; status: string };

/** Localiza cada coluna pelo cabeçalho, aceitando apelidos ("Telefone" vale como WhatsApp). */
export function mapColumns(header: string[]): Partial<Record<NetworkColumn, number>> {
  const keys = header.map((cell) => nameKey(cell));
  const found: Partial<Record<NetworkColumn, number>> = {};
  for (const [column, label, aliases] of NETWORK_COLUMNS) {
    const candidates = [nameKey(label), ...aliases];
    const index = keys.findIndex((key, i) => key && candidates.includes(key) && !Object.values(found).includes(i));
    if (index >= 0) found[column] = index;
  }
  return found;
}

/** "1.500,00", "R$ 1500", "1500.50" e "1 500" viram centavos; vazio ou inválido vira null. */
export function parseAmountCents(value: string): number | null {
  const raw = value.replace(/r\$/i, "").replace(/\s/g, "").trim();
  if (!raw) return 0;
  if (!/^[\d.,]+$/.test(raw)) return null;
  let normalized = raw;
  const lastComma = raw.lastIndexOf(","), lastDot = raw.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) normalized = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (lastComma >= 0) normalized = raw.split(",").length === 2 && raw.length - lastComma - 1 <= 2 ? raw.replace(",", ".") : raw.replace(/,/g, "");
  else if (lastDot >= 0) normalized = raw.split(".").length === 2 && raw.length - lastDot - 1 <= 2 ? raw : raw.replace(/\./g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
}

/** Datas "10/03/2026", "10-03-2026", "2026-03-10" e número de série do Excel viram AAAA-MM-DD. */
export function parseDateBR(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  let year: number, month: number, day: number;
  let match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s.*)?$/);
  if (match) { day = Number(match[1]); month = Number(match[2]); year = Number(match[3]); if (year < 100) year += 2000; }
  else if ((match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/))) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
  else if (/^\d{4,6}$/.test(raw)) { const date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000); year = date.getUTCFullYear(); month = date.getUTCMonth() + 1; day = date.getUTCDate(); }
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 2000 || date.getTime() > Date.now() + 86400000) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "pago", "confirmado", "paga" → Pagamento confirmado; "pendente" → Venda confirmada; vazio decide pelo valor/data. */
export function parseSaleStatus(value: string, hasSale: boolean): SaleStatus | "" | null {
  const key = nameKey(value);
  if (!key) return hasSale ? "Pagamento confirmado" : "";
  const exact = SALE_STATUSES.find((status) => nameKey(status) === key);
  if (exact) return exact;
  if (/\b(pago|paga|confirmad|quitad|recebid)/.test(key)) return "Pagamento confirmado";
  if (/\b(pendente|aguardando|negoci|em aberto|fechad)/.test(key)) return "Venda confirmada";
  if (/\b(cancel|desist)/.test(key)) return "Cancelada";
  if (/\b(reembols|estorn|devolv)/.test(key)) return "Reembolsada";
  return null;
}

type CityLike = { id: number; name: string };

/** Interpreta a planilha inteira. Linhas com problema viram `problems`; as demais viram `rows` na ordem do arquivo. */
export function buildNetworkRows(grid: string[][], cities: CityLike[], defaultCityId: number | null): { rows: NetworkRow[]; problems: RowProblem[] } {
  const columns = mapColumns(grid[0] ?? []);
  const rows: NetworkRow[] = [], problems: RowProblem[] = [];
  const value = (cells: string[], column: NetworkColumn) => (columns[column] !== undefined ? cells[columns[column]!] ?? "" : "").trim();
  grid.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const fail = (status: string) => problems.push({ line, ok: false, status });
    const name = value(cells, "name");
    if (name.length < 2) return fail("Informe o nome da pessoa.");
    const cityText = value(cells, "city");
    const city = cityText ? cities.find((item) => nameKey(item.name) === nameKey(cityText)) : cities.find((item) => item.id === defaultCityId);
    if (!city) return fail(cityText ? `Cidade "${cityText}" não cadastrada ou fora do seu acesso.` : "Escolha a cidade.");
    const amountCents = parseAmountCents(value(cells, "amount"));
    if (amountCents === null) return fail(`Valor "${value(cells, "amount")}" não reconhecido. Use números, como 1.500,00.`);
    const paidAt = parseDateBR(value(cells, "paidAt"));
    if (paidAt === null) return fail(`Data "${value(cells, "paidAt")}" não reconhecida. Use dia/mês/ano, como 10/03/2026.`);
    const product = value(cells, "product");
    const hasSale = amountCents > 0 || Boolean(paidAt) || Boolean(product);
    const saleStatus = parseSaleStatus(value(cells, "saleStatus"), hasSale);
    if (saleStatus === null) return fail(`Situação da venda "${value(cells, "saleStatus")}" não reconhecida. Use: ${SALE_STATUSES.join(", ")}.`);
    if (saleStatus && ["Venda confirmada", "Pagamento confirmado"].includes(saleStatus) && amountCents <= 0) return fail("Informe o valor da venda.");
    const whatsapp = value(cells, "whatsapp"), email = value(cells, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(`E-mail "${email}" inválido.`);
    if (whatsapp && whatsapp.replace(/\D/g, "").length < 8) return fail(`WhatsApp "${whatsapp}" incompleto.`);
    if (saleStatus && !whatsapp && !email) return fail("Para registrar a venda, informe o WhatsApp ou o e-mail (o atendimento precisa de um contato autorizado).");
    const referrer = value(cells, "referrer");
    if (referrer && nameKey(referrer) === nameKey(name)) return fail("A pessoa não pode indicar a si mesma.");
    rows.push({ line, cityId: city.id, name, whatsapp, email, referrer, role: value(cells, "role"), place: value(cells, "place"), link: value(cells, "link"), product, amountCents, paidAt, saleStatus });
  });
  return { rows, problems };
}

/**
 * Quem indica vem antes de quem foi indicado, para que o indicador já exista quando a linha indicada for gravada.
 * Linhas em ciclo (A indica B, B indica A) ficam no fim, com a ordem do arquivo; o servidor recusa o ciclo.
 */
export function orderByReferrer(rows: NetworkRow[]): NetworkRow[] {
  const byKey = new Map<string, NetworkRow>();
  for (const row of rows) byKey.set(row.cityId + "|" + nameKey(row.name), row);
  const depth = new Map<NetworkRow, number>();
  const compute = (row: NetworkRow, trail: Set<NetworkRow>): number => {
    const known = depth.get(row);
    if (known !== undefined) return known;
    if (trail.has(row)) return rows.length;
    trail.add(row);
    const parent = row.referrer ? byKey.get(row.cityId + "|" + nameKey(row.referrer)) : undefined;
    const result = parent && parent !== row ? Math.min(rows.length, compute(parent, trail) + 1) : 0;
    depth.set(row, result);
    return result;
  };
  for (const row of rows) compute(row, new Set());
  return rows.toSorted((a, b) => depth.get(a)! - depth.get(b)! || a.line - b.line);
}

export const NETWORK_BATCH = 50;

/** Lotes de 50 na ordem já resolvida (o servidor grava um lote por vez). */
export function batches<T>(rows: T[], size = NETWORK_BATCH): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}

export type NetworkOutcome = {
  line: number;
  ok: boolean;
  status: string;
  /** O que a linha faz (prévia) ou fez (gravação). */
  person?: "nova" | "existente";
  referrer?: "ok" | "planilha" | "mantido";
  lead?: boolean;
  sale?: boolean;
};

/** Resumo para a tela: quantas pessoas novas, já no mapa, indicações, atendimentos e vendas. */
export function summarize(outcomes: NetworkOutcome[]) {
  const ok = outcomes.filter((o) => o.ok);
  return {
    ok: ok.length,
    failed: outcomes.length - ok.length,
    newPeople: ok.filter((o) => o.person === "nova").length,
    existing: ok.filter((o) => o.person === "existente").length,
    referrals: ok.filter((o) => o.referrer === "ok" || o.referrer === "planilha").length,
    leads: ok.filter((o) => o.lead).length,
    sales: ok.filter((o) => o.sale).length,
  };
}

/** Frase curta do que acontece com a linha, para a prévia em tabela. */
export function describeRow(row: NetworkRow, outcome?: NetworkOutcome) {
  const parts: string[] = [];
  parts.push(outcome?.person === "existente" ? "Já no mapa" : "Nova no mapa");
  if (row.role) parts.push(row.role);
  if (row.referrer) parts.push(outcome?.referrer === "mantido" ? `Indicador já registrado (mantido)` : `Indicada por ${row.referrer}`);
  if (row.whatsapp || row.email) parts.push("Atendimento");
  if (row.saleStatus) parts.push(`${row.saleStatus === "Pagamento confirmado" ? "Venda paga" : row.saleStatus}${row.amountCents ? ` R$ ${(row.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}${row.paidAt ? ` em ${row.paidAt.slice(8, 10)}/${row.paidAt.slice(5, 7)}/${row.paidAt.slice(0, 4)}` : ""}`);
  return parts.join(" · ");
}
