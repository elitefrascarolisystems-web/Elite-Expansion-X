/**
 * Calculadora de metas: só contas (sem banco, sem tela). Datas são dias de Brasília no
 * formato AAAA-MM-DD; valores em reais. Um valor `null` quer dizer "Sem dados
 * suficientes": nunca vira 0 na tela, e a projeção nunca é gravada como resultado.
 * As fórmulas seguem docs/prompt-calculadora-pessoas-guias.md (Etapa 2, "Como calcula").
 */

export type GoalMetric = "Vendas pagas" | "Receita confirmada";

/** Taxas e contagens de um escopo (empresa, cidade ou pessoa), já com as premissas digitadas por cima. */
export type CalculatorBase = {
  today: string;
  target: string;
  metric: GoalMetric;
  /** Meta: vendas (Vendas pagas) ou reais (Receita confirmada). */
  goal: number;
  /** Vendas pagas e receita paga (R$) com o dia do pagamento entre o 1º dia do mês e hoje. */
  paid: number;
  paidRevenue: number;
  ticket: number | null;
  /** Vendas pagas por semana (ritmo). */
  v: number | null;
  /** Conversão (0 a 1). */
  c: number | null;
  /** Dias até pagar (inteiro). */
  m: number | null;
  /** Atendimentos novos por semana e a origem deles. */
  N: number | null;
  Nmap: number | null;
  Nind: number | null;
  Nmid: number | null;
  Nout: number | null;
  /** Pessoas mapeadas por semana, mapeadores e pessoa mapeada → atendimento (0 a 1). */
  Pm: number | null;
  nm: number | null;
  a: number | null;
  /** Vendedores e capacidade de um vendedor (atendimentos novos por semana). */
  nv: number | null;
  kv: number | null;
  /** Clientes e indicações por cliente por semana. */
  C: number | null;
  r: number | null;
  /** Custo por atendimento de mídia (R$); null = alavanca de mídia desligada. */
  cpl: number | null;
  /** Meta de participação orgânica (%) de Regras e cálculos; 0 = sem aviso. */
  organicGoal: number;
};

/** Ajustes do "E se…?": valores absolutos (não diferenças); verba é extra por mês, em R$. */
export type Levers = { sellers?: number; mappers?: number; conversion?: number; referralsPerMonth?: number; mediaPerMonth?: number };

export type Arrival =
  | { kind: "nodata" }
  | { kind: "never" }
  | { kind: "date"; days: number; date: string; diff: number; range: [number | null, number | null]; rangeDates: [string | null, string | null]; increaseOnly?: boolean };

export const MAX_DAYS = 730;

// ---------- Números sem sobra de ponto flutuante ----------

/** 6 casas antes de ⌈ ⌉, ⌊ ⌋ e comparações (3 × 1,2 = 3,5999… vira 3,6). */
export const r6 = (x: number) => Number(x.toFixed(6));
export const ceil6 = (x: number) => Math.ceil(r6(x));
export const floor6 = (x: number) => Math.floor(r6(x));
const has = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
const z = (x: number | null | undefined) => (has(x) ? x : 0);

// ---------- Datas (dias de calendário, sem fuso) ----------

const toUtc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
export function addDays(day: string, n: number) {
  const date = new Date(toUtc(day) + n * 86_400_000);
  return date.toISOString().slice(0, 10);
}
export const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
export const lastOfMonth = (day: string, add = 0) => {
  const y = Number(day.slice(0, 4)), mo = Number(day.slice(5, 7)) - 1 + add;
  return new Date(Date.UTC(y, mo + 1, 0)).toISOString().slice(0, 10);
};
/** "25/01" ou "25/01/2027" (com ano quando `year`). */
export const shortDate = (day: string, year = false) => `${day.slice(8, 10)}/${day.slice(5, 7)}${year ? "/" + day.slice(0, 4) : ""}`;

// ---------- Amostra mínima ----------

export const MINIMUMS = { conversionLeads: 30, conversionPaid: 3, ticketSales: 5, paceWeeks: 2, leadWeeks: 4, mappedPeople: 30, mappedLeads: 3, clients: 5, referrals: 2, mediaLeads: 10 } as const;
/** Amostra suficiente: cada contagem no mínimo dela. */
export const sampleOk = (pairs: [number, number][]) => pairs.every(([value, min]) => value >= min);

// ---------- Meta e quanto falta ----------

export type GoalNumbers = { M: number | null; F: number | null; P: number | null; D: number; S: number; missingRevenue: number | null; needsTicket: boolean; reached: boolean };

export function goalNumbers(b: CalculatorBase): GoalNumbers {
  const D = Math.max(0, daysBetween(b.today, b.target));
  const S = D / 7;
  if (b.metric === "Receita confirmada") {
    if (!has(b.ticket) || b.ticket <= 0) return { M: null, F: null, P: null, D, S, missingRevenue: Math.max(0, b.goal - b.paidRevenue), needsTicket: true, reached: b.paidRevenue >= b.goal };
    const M = ceil6(b.goal / b.ticket);
    const F = Math.max(0, ceil6((b.goal - b.paidRevenue) / b.ticket));
    return { M, F, P: M - F, D, S, missingRevenue: Math.max(0, b.goal - b.paidRevenue), needsTicket: false, reached: F === 0 };
  }
  const M = Math.max(0, Math.round(b.goal));
  const F = Math.max(0, M - b.paid);
  return { M, F, P: b.paid, D, S, missingRevenue: has(b.ticket) ? F * b.ticket : null, needsTicket: false, reached: F === 0 };
}

function arrivalFromDays(b: CalculatorBase, days: number | null, low: number | null, high: number | null, D: number): Arrival {
  if (days === null) return { kind: "never" };
  const fit = (n: number | null) => (n === null || n > MAX_DAYS ? null : n);
  return {
    kind: "date", days, date: addDays(b.today, days), diff: days - D,
    range: [fit(low), fit(high)], rangeDates: [low === null || low > MAX_DAYS ? null : addDays(b.today, low), high === null || high > MAX_DAYS ? null : addDays(b.today, high)],
  };
}

/** "No ritmo atual": t = ⌈7F ÷ v⌉, com a faixa pelo ritmo × 1,2 e × 0,8. */
export function projectAtCurrentPace(b: CalculatorBase): Arrival {
  const g = goalNumbers(b);
  if (g.F === null || !has(b.v)) return { kind: "nodata" };
  if (g.F === 0) return arrivalFromDays(b, 0, 0, 0, g.D);
  if (b.v <= 0) return { kind: "never" };
  const days = ceil6(7 * g.F / b.v);
  return arrivalFromDays(b, days, ceil6(7 * g.F / (b.v * 1.2)), ceil6(7 * g.F / (b.v * 0.8)), g.D);
}

// ---------- Funil de trás para frente ----------

export type Bottleneck = "nenhum" | "atendimentos" | "atendimentos e vendedores" | "atendimentos e vendedores juntos";
export type Funnel = {
  status: "batida" | "sem-tempo-ate-pagar" | "andamento-basta" | "estenda" | "mantenha" | "precisa" | "sem-conversao";
  E: number; R: number; U: number; vn: number;
  Nn: number | null; totalLeads: number | null; startBy: string | null; leadsDelta: number | null;
  /** O que depende de um valor sem dados aparece como acréscimo sobre hoje. */
  absolute: boolean;
  mappingNeeded: number | null; peoplePerWeek: number | null; peopleTotal: number | null; mappers: number | null;
  sellers: number | null; bottleneck: Bottleneck;
};

const relative = (b: CalculatorBase) => has(b.N) && has(b.v) && b.N > 0 && b.v > 0;

export function reverseFunnel(b: CalculatorBase): Funnel {
  const g = goalNumbers(b);
  const empty = { E: 0, R: 0, U: 0, vn: 0, Nn: null, totalLeads: null, startBy: null, leadsDelta: null, absolute: false, mappingNeeded: null, peoplePerWeek: null, peopleTotal: null, mappers: null, sellers: null, bottleneck: "nenhum" as Bottleneck };
  if (g.F === null || g.F === 0) return { ...empty, status: "batida" };
  if (!has(b.m)) return { ...empty, status: "sem-tempo-ate-pagar" };
  const v = z(b.v), L = b.m / 7;
  const E = v * Math.min(L, g.S);
  const R = Math.max(0, g.F - E);
  if (r6(R) <= 0) return { ...empty, E, status: "andamento-basta" };
  const U = g.S - L;
  if (r6(U) <= 0) return { ...empty, E, R, status: "estenda" };
  const vn = R / U;
  const absolute = !relative(b);
  const N = z(b.N);
  let Nn: number | null;
  if (!absolute) Nn = N * vn / v;
  else if (!has(b.c) || b.c <= 0) return { ...empty, E, R, U, vn, absolute, status: "sem-conversao" };
  else Nn = Math.max(0, N + (vn - v) / b.c);
  const startBy = addDays(b.target, -b.m);
  const base = { E, R, U, vn, Nn, totalLeads: Nn * U, startBy, leadsDelta: Nn - N, absolute };
  if (r6(Nn) <= r6(N)) return { ...empty, ...base, status: "mantenha" };

  // Origem e equipe
  const mappingNeeded = Math.max(0, Nn - z(b.Nind) - z(b.Nmid) - z(b.Nout));
  const Nmap = z(b.Nmap), nm = z(b.nm), Pm = z(b.Pm);
  let peoplePerWeek: number | null = null, mappers: number | null = null;
  if (Nmap > 0 && nm > 0 && Pm > 0) {
    peoplePerWeek = Pm * mappingNeeded / Nmap;
    mappers = Math.max(0, ceil6(nm * mappingNeeded / Nmap));
  } else if (has(b.a) && b.a > 0) {
    const extraPeople = (mappingNeeded - Nmap) / b.a;
    peoplePerWeek = Math.max(0, Pm + extraPeople);
    mappers = has(b.Pm) && has(b.nm) && b.nm > 0 && b.Pm > 0 ? Math.max(0, nm + ceil6(extraPeople / (b.Pm / b.nm))) : null;
  }
  const kv = b.kv, nv = b.nv;
  let sellers: number | null = null;
  if (has(kv) && kv > 0 && has(nv)) sellers = Math.max(0, r6(N) <= r6(nv * kv) ? ceil6(Nn / kv) : nv + ceil6((Nn - N) / kv));
  let bottleneck: Bottleneck = "atendimentos";
  if (has(kv) && has(nv) && kv > 0) {
    const cap = nv * kv;
    if (r6(N) >= r6(cap)) bottleneck = "atendimentos e vendedores juntos";
    else if (r6(Nn) > r6(cap)) bottleneck = "atendimentos e vendedores";
  }
  return { ...base, status: "precisa", mappingNeeded, peoplePerWeek, peopleTotal: peoplePerWeek === null ? null : peoplePerWeek * U, mappers, sellers, bottleneck };
}

// ---------- E se…? ----------

/** Indicações por cliente: por semana na conta, por mês na tela. */
export const perMonth = (perWeek: number) => perWeek * 30 / 7;
export const perWeek = (perMonthValue: number) => perMonthValue * 7 / 30;

export type LeverState = {
  mappers: boolean; sellers: boolean; conversion: boolean; referrals: boolean; media: boolean;
};

/** Quais alavancas funcionam com os dados de hoje (as outras esperam a premissa). */
export function leversAvailable(b: CalculatorBase): LeverState {
  const mapRelative = z(b.Nmap) > 0 && z(b.nm) > 0;
  const absolute = !relative(b);
  return {
    mappers: has(b.nm) && (mapRelative || (has(b.a) && b.a > 0 && has(b.Pm) && b.Pm > 0 && has(b.nm) && b.nm > 0)),
    sellers: has(b.kv) && b.kv > 0 && has(b.nv),
    conversion: has(b.c) && b.c > 0,
    referrals: has(b.r) && b.r > 0 && has(b.Nind),
    media: has(b.cpl) && b.cpl > 0 && !(absolute && !has(b.c)),
  };
}

export type LeverResult = { N2: number; v2: number; sumBeforeCap: number; Nmid2: number; organicShare: number | null; organicWarning: boolean; capped: boolean };

export function leverFlow(b: CalculatorBase, l: Levers): LeverResult {
  const N = z(b.N), Nmap = z(b.Nmap), Nind = z(b.Nind), Nmid = z(b.Nmid), Nout = z(b.Nout);
  const nm = z(b.nm), nv = z(b.nv);
  const nm2 = l.mappers ?? nm, nv2 = l.sellers ?? nv;
  let Nmap2 = Nmap;
  if (Nmap > 0 && nm > 0) Nmap2 = Nmap * nm2 / nm;
  else if (has(b.a) && b.a > 0 && has(b.Pm) && has(b.nm) && b.nm > 0 && b.Pm > 0) Nmap2 = Math.max(0, Nmap + (nm2 - nm) * (b.Pm / b.nm) * b.a);
  const r = b.r;
  const Nind2 = has(r) && r > 0 && l.referralsPerMonth !== undefined ? Nind * perWeek(l.referralsPerMonth) / r : Nind;
  const media = l.mediaPerMonth ?? 0;
  const Nmid2 = has(b.cpl) && b.cpl > 0 ? Nmid + (media / b.cpl) * 7 / 30 : Nmid;
  const sumBeforeCap = Nmap2 + Nind2 + Nmid2 + Nout;
  const capacity = has(b.kv) && b.kv > 0 && has(b.nv) ? Math.max(nv2 * b.kv, N + (nv2 - nv) * b.kv) : Infinity;
  const N2 = Math.min(sumBeforeCap, capacity);
  const c = b.c, c2 = l.conversion ?? c;
  let v2: number;
  if (relative(b)) v2 = z(b.v) * (N2 / N) * (has(c) && c > 0 && has(c2) ? c2 / c : 1);
  else if (has(c) && has(c2)) v2 = Math.max(0, z(b.v) + N2 * c2 - N * c);
  else v2 = z(b.v);
  const organicShare = sumBeforeCap > 0 ? (1 - Nmid2 / sumBeforeCap) * 100 : null;
  return { N2, v2, sumBeforeCap, Nmid2, organicShare, organicWarning: media > 0 && b.organicGoal > 0 && organicShare !== null && r6(organicShare) < r6(b.organicGoal), capped: r6(sumBeforeCap) > r6(N2) };
}

const noLevers = (b: CalculatorBase, l: Levers) =>
  (l.mappers === undefined || l.mappers === z(b.nm)) && (l.sellers === undefined || l.sellers === z(b.nv))
  && (l.conversion === undefined || l.conversion === b.c) && (l.mediaPerMonth === undefined || l.mediaPerMonth === 0)
  && (l.referralsPerMonth === undefined || !has(b.r) || r6(perWeek(l.referralsPerMonth)) === r6(b.r));

function daysWith(b: CalculatorBase, F: number, v: number, v2: number): number | null {
  const m = z(b.m);
  if (r6(v * m / 7) >= r6(F)) return v > 0 ? ceil6(7 * F / v) : 0;
  if (r6(v2) <= 0) return null;
  return m + ceil6(7 * (F - v * m / 7) / v2);
}

/** "Com ajustes": a chegada com as alavancas (sem ajuste, igual a "No ritmo atual"). */
export function projectWithLevers(b: CalculatorBase, l: Levers): Arrival & { flow?: LeverResult } {
  const g = goalNumbers(b);
  if (g.F === null) return { kind: "nodata" };
  if (!has(b.v) && noLevers(b, l)) return { kind: "nodata" };
  if (noLevers(b, l)) return projectAtCurrentPace(b);
  if (!has(b.m)) return { kind: "nodata" };
  const flow = leverFlow(b, l);
  if (g.F === 0) return { ...arrivalFromDays(b, 0, 0, 0, g.D), flow };
  const v = z(b.v), v2 = flow.v2;
  const days = daysWith(b, g.F, v, v2);
  if (days === null) return { kind: "never", flow };
  const low = daysWith(b, g.F, v * 1.2, v2 * 1.2), high = daysWith(b, g.F, v * 0.8, v2 * 0.8);
  const arrival = arrivalFromDays(b, days, low, high, g.D);
  return { ...arrival, ...(has(b.v) ? {} : { increaseOnly: true }), flow } as Arrival & { flow: LeverResult };
}

// ---------- O que mais ajuda ----------

export type StepId = "conversao" | "indicacoes" | "midia" | "mapeador" | "vendedor";
export type Step = { id: StepId; label: string; levers: Levers; arrival: Arrival; gain: number | null; noGain?: "falta atendimento" | "falta vendedor" | "a meta já chega no prazo"; wasNever: boolean };
const STEP_ORDER: StepId[] = ["conversao", "indicacoes", "midia", "mapeador", "vendedor"];

export function rankAdjustments(b: CalculatorBase): { steps: Step[]; needs?: "conversao" | "capacidade" } {
  const g = goalNumbers(b);
  if (g.F === null || g.F === 0 || !has(b.m)) return { steps: [] };
  const can = leversAvailable(b);
  if (!relative(b) && !can.conversion) return { steps: [], needs: "conversao" };
  const now = projectAtCurrentPace(b);
  const nowDays = now.kind === "date" ? now.days : null;
  const candidates: [StepId, string, Levers][] = [];
  if (can.conversion) candidates.push(["conversao", "Conversão +5 pontos", { conversion: Math.min(1, r6(z(b.c) + 0.05)) }]);
  if (can.referrals) candidates.push(["indicacoes", "Indicações +50%", { referralsPerMonth: perMonth(z(b.r) * 1.5) }]);
  if (can.media) candidates.push(["midia", "+R$ 1.000 por mês de mídia", { mediaPerMonth: 1000 }]);
  if (can.mappers) candidates.push(["mapeador", "+1 mapeador", { mappers: z(b.nm) + 1 }]);
  if (can.sellers) candidates.push(["vendedor", "+1 vendedor", { sellers: z(b.nv) + 1 }]);
  const inProgressDecides = r6(z(b.v) * b.m / 7) >= r6(g.F);
  const steps = candidates.map(([id, label, levers]): Step => {
    const arrival = projectWithLevers(b, levers);
    const days = arrival.kind === "date" ? arrival.days : null;
    const gain = days === null ? null : nowDays === null ? null : nowDays - days;
    const step: Step = { id, label, levers, arrival, gain, wasNever: nowDays === null && days !== null };
    if (days === null || (nowDays !== null && gain !== null && gain <= 0)) {
      step.noGain = inProgressDecides ? "a meta já chega no prazo" : id === "vendedor" ? "falta atendimento" : "falta vendedor";
    }
    return step;
  });
  const key = (s: Step) => (s.arrival.kind === "date" && !s.noGain ? s.arrival.days : Number.MAX_SAFE_INTEGER);
  steps.sort((x, y) => key(x) - key(y) || STEP_ORDER.indexOf(x.id) - STEP_ORDER.indexOf(y.id));
  return { steps: steps.slice(0, 4) };
}

// ---------- Menor combinação ----------

export type Combo = { status: "basta" } | { status: "ok"; mappers: number; sellers: number; extraMappers: number; extraSellers: number; arrival: Arrival } | { status: "nenhuma" } | { status: "sem-dados"; needs: "conversao" | "capacidade" | "tempo" };

export function smallestTeamCombo(b: CalculatorBase): Combo {
  const g = goalNumbers(b);
  if (g.F === null || g.F === 0) return { status: "basta" };
  const now = projectAtCurrentPace(b);
  if (now.kind === "date" && now.days <= g.D) return { status: "basta" };
  if (!has(b.m)) return { status: "sem-dados", needs: "tempo" };
  const can = leversAvailable(b);
  if (!relative(b) && !can.conversion) return { status: "sem-dados", needs: "conversao" };
  const nm = z(b.nm), nv = z(b.nv);
  let best: { mappers: number; sellers: number; extra: number; arrival: Arrival & { kind: "date" } } | null = null;
  for (let dm = 0; dm <= 10; dm++) for (let dv = 0; dv <= 5; dv++) {
    if (dm === 0 && dv === 0) continue;
    const arrival = projectWithLevers(b, { mappers: nm + dm, sellers: nv + dv });
    if (arrival.kind !== "date" || arrival.days > g.D) continue;
    const extra = dm + dv;
    if (!best || extra < best.extra || (extra === best.extra && arrival.days < best.arrival.days)) best = { mappers: nm + dm, sellers: nv + dv, extra, arrival };
  }
  if (!best) return can.sellers || can.mappers ? { status: "nenhuma" } : { status: "sem-dados", needs: "capacidade" };
  return { status: "ok", mappers: best.mappers, sellers: best.sellers, extraMappers: best.mappers - nm, extraSellers: best.sellers - nv, arrival: best.arrival };
}

// ---------- Bônus da rede e avisos ----------

/** Indicações a mais que os clientes novos trazem até o prazo (fora da data, conservador). */
export function networkBonus(b: CalculatorBase): number | null {
  const f = reverseFunnel(b);
  if (!has(b.r) || f.status !== "precisa" && f.status !== "mantenha") return null;
  if (f.R <= 0 || f.U <= 0) return null;
  return Math.max(0, f.R * b.r * f.U / 2);
}

export function divergence(b: CalculatorBase): boolean {
  if (!has(b.v) || !has(b.N) || !has(b.c) || b.v <= 0) return false;
  return r6(Math.abs(b.v - b.N * b.c)) > r6(0.3 * b.v);
}

/** Pontos do gráfico "Chegamos lá?": a projeção a partir de hoje (dias × vendas acumuladas). */
export function paceProjection(b: CalculatorBase, v2: number | null, horizonDays: number): { day: number; value: number }[] {
  const g = goalNumbers(b);
  if (g.P === null) return [];
  const v = z(b.v), m = z(b.m), vv = v2 ?? v;
  const points: { day: number; value: number }[] = [];
  const step = Math.max(1, Math.ceil(horizonDays / 40));
  for (let t = 0; t <= horizonDays; t += step) points.push({ day: t, value: g.P + v * Math.min(t, m) / 7 + vv * Math.max(0, t - m) / 7 });
  return points;
}

// ---------- Resumo para copiar ----------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const money = (value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`;

export function summaryText(b: CalculatorBase, scopeName: string): string {
  const g = goalNumbers(b);
  const what = b.metric === "Receita confirmada" ? `${money(b.goal)} de receita confirmada` : plural(Math.round(b.goal), "venda paga", "vendas pagas");
  const head = `Meta (${scopeName}): ${what} até ${shortDate(b.target)}.`;
  if (g.F === null) return `${head} Falta o ticket médio para calcular.`;
  const done = b.metric === "Receita confirmada" ? `Feitas: ${money(b.paidRevenue)}.` : `Feitas: ${g.P}.`;
  if (g.F === 0) return `${head} ${done} Meta batida.`;
  const missing = b.metric === "Receita confirmada" ? `Faltam ${money(g.missingRevenue ?? 0)} (≈ ${plural(g.F, "venda", "vendas")}).` : `Faltam ${g.F}.`;
  const now = projectAtCurrentPace(b);
  const pace = now.kind === "date" ? (now.days > MAX_DAYS ? " No ritmo atual chegamos em mais de 2 anos." : ` No ritmo atual chegamos em ${shortDate(now.date)}.`) : now.kind === "never" ? " No ritmo atual a meta não chega." : "";
  const f = reverseFunnel(b);
  if (f.status === "mantenha" || f.status === "andamento-basta") {
    const ahead = now.kind === "date" && now.diff <= 0 ? ` No ritmo atual chegamos em ${shortDate(now.date)}, ${plural(-now.diff, "dia", "dias")} antes do prazo.` : pace;
    return `${head} ${done} ${missing}${ahead}`;
  }
  if (f.status !== "precisa" || f.Nn === null || f.startBy === null) return `${head} ${done} ${missing}${pace}`;
  const combo = smallestTeamCombo(b);
  const team = combo.status === "ok" ? `, por exemplo com +${combo.extraMappers} ${combo.extraMappers === 1 ? "mapeador" : "mapeadores"} e +${combo.extraSellers} ${combo.extraSellers === 1 ? "vendedor" : "vendedores"}` : "";
  const today = has(b.N) ? ` (hoje ${ceil6(b.N)})` : "";
  return `${head} ${done} ${missing}${pace} Para chegar no prazo: ${ceil6(f.Nn)} atendimentos novos por semana até ${shortDate(f.startBy)}${today}${team}.`;
}
