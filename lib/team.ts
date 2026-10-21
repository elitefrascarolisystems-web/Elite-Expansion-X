import type { UserRole } from "@/lib/expansion-types";

/**
 * Equipe: leitura da lista colada no convite em lote e textos de convite.
 * Uma pessoa por linha: nome; e-mail; função; cidade; cargo; mentoria
 * (só nome, e-mail e função são obrigatórios; separador ";" ou tabulação, como sai de planilha).
 */
export const TEAM_LINE_FORMAT = "nome; e-mail; função; cidade; cargo; ciclo de mentoria";
export const MAX_TEAM_ROWS = 30;

export type TeamRow = {
  line: number;
  name: string;
  email: string;
  role: UserRole | null;
  cityId: number | null;
  cityName: string;
  title: string;
  mentorshipCycle: number;
  error?: string;
};

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Aceita o nome da função ou o jeito como o time fala dela. */
const ROLE_WORDS: [RegExp, UserRole][] = [
  [/^(administrador|administradora|admin)$/, "Administrador"],
  [/^(coordenacao|coordenador|coordenadora)$/, "Coordenação"],
  [/^(lider|lider local)$/, "Líder"],
  [/^(embaixador|embaixadora)$/, "Embaixador"],
  [/^(comercial|vendas|vendedor|vendedora|(executivo|executiva) de vendas|consultor|consultora|sdr|closer)$/, "Comercial"],
];
const CANONICAL = new Set(["administrador", "coordenacao", "lider", "embaixador", "comercial"]);

export function roleFromText(value: string): UserRole | null {
  const v = plain(value);
  return ROLE_WORDS.find(([pattern]) => pattern.test(v))?.[1] ?? null;
}

/** "2", "2º ciclo", "sim" → número do ciclo; vazio ou "não" → 0. */
export function mentorshipFromText(value: string): number | null {
  const v = plain(value);
  if (!v || v === "nao" || v === "-") return 0;
  if (v === "sim") return 1;
  const digits = v.match(/\d+/)?.[0];
  if (!digits) return null;
  const cycle = Number(digits);
  return cycle >= 0 && cycle <= 10 ? cycle : null;
}

export function mentorshipLabel(cycle: number): string {
  return cycle > 0 ? `Mentoria · ${cycle}º ciclo` : "";
}

const EMAIL = /^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/;

export function parseTeamLines(text: string, cities: { id: number; name: string }[]): TeamRow[] {
  const rows: TeamRow[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    const cells = raw.split(/[;\t]/).map((cell) => cell.trim());
    if (plain(cells[0]) === "nome") return; // cabeçalho copiado da planilha
    const [name = "", emailRaw = "", roleText = "", cityText = "", titleText = "", mentorshipText = ""] = cells;
    const email = emailRaw.toLowerCase();
    const role = roleFromText(roleText);
    const city = plain(cityText) && !["todas", "todas as cidades", "-"].includes(plain(cityText))
      ? cities.find((item) => plain(item.name) === plain(cityText)) : undefined;
    const mentorship = mentorshipFromText(mentorshipText);
    // "Executiva de Vendas" na coluna função também vira o cargo, se o cargo veio vazio.
    const title = titleText || (role && !CANONICAL.has(plain(roleText)) ? roleText : "");
    const row: TeamRow = { line: index + 1, name, email, role, cityId: city?.id ?? null, cityName: city?.name ?? "", title, mentorshipCycle: mentorship ?? 0 };
    if (name.length < 2) row.error = "Informe o nome.";
    else if (!EMAIL.test(email)) row.error = "E-mail inválido.";
    else if (/@exemplo\.com$/.test(email)) row.error = "Troque o e-mail de exemplo pelo e-mail real da pessoa.";
    else if (seen.has(email)) row.error = "E-mail repetido na lista.";
    else if (!role) row.error = `Função não reconhecida: "${roleText || "vazia"}". Use Administrador, Coordenação, Líder ou Comercial (Executivo de Vendas).`;
    else if (role === "Embaixador") row.error = "Embaixador precisa ser ligado ao cadastro dele: use \"Adicionar pessoa\".";
    else if (plain(cityText) && !city && !["todas", "todas as cidades", "-"].includes(plain(cityText))) row.error = `Cidade não cadastrada: "${cityText}". Cadastre a cidade antes.`;
    else if (["Coordenação", "Líder"].includes(role) && !city) row.error = `${role} precisa de uma cidade.`;
    else if (mentorship === null) row.error = "Mentoria: use o número do ciclo (1, 2, 3...) ou deixe vazio.";
    else if (title.length > 80) row.error = "Cargo com mais de 80 caracteres.";
    seen.add(email);
    rows.push(row);
  });
  return rows;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/** Mensagem pronta para mandar o convite (WhatsApp ou e-mail). */
export function inviteMessage(name: string, link: string, renewal = false) {
  return renewal
    ? `Olá, ${firstName(name)}! Segue um novo link para você definir sua senha na Elite Expansion X. Ele vale por 72 horas e só funciona uma vez: ${link}`
    : `Olá, ${firstName(name)}! Seja bem-vindo(a) à Elite Expansion X, a plataforma de expansão da Elite Frascaroli Academy. ` +
      `Abra este link para criar sua senha (vale por 72 horas e só funciona uma vez): ${link}\n\n` +
      `Depois, para entrar de novo, use ${new URL(link).origin}/entrar com seu e-mail e a senha que você criou.`;
}
