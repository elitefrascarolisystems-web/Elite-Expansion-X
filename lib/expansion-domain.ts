import type {
  AlertMetric,
  AmbassadorMetric,
  ChannelMetric,
  CityMetric,
  CityRecord,
  DashboardData,
  DashboardFilters,
  DashboardView,
  DecisionName,
  SettingsView,
  SummaryMetric,
  TimelineMetric,
} from "@/lib/expansion-types";

export const EMPTY_FILTERS: DashboardFilters = {
  cityId: null,
  period: "",
  channel: "",
  leader: "",
  ambassadorId: null,
};

const activeStatuses = new Set(["Ativo", "Líder local"]);
const paidStatus = "Pagamento confirmado";
const confirmedSaleStatuses = new Set(["Venda confirmada", paidStatus]);

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function monthOf(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : "";
}

function latest(values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value)).sort();
  return valid.at(-1) ?? null;
}

function activityIsRecent(value: string | null, inactivityDays: number, now: Date) {
  if (!value) return false;
  if (inactivityDays <= 0) return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return now.getTime() - timestamp <= inactivityDays * 86_400_000;
}

function recordPeriodMatches(value: string | null | undefined, period: string) {
  return !period || monthOf(value) === period || value === period;
}

function cityIsSelected(city: CityRecord, filters: DashboardFilters) {
  if (filters.cityId !== null && city.id !== filters.cityId) return false;
  if (filters.leader && city.leaderName !== filters.leader) return false;
  return true;
}

function ambassadorMetrics(
  data: DashboardData,
  filters: DashboardFilters,
  selectedCityIds: Set<number>,
  now: Date,
): AmbassadorMetric[] {
  return data.ambassadors
    .filter((item) => selectedCityIds.has(item.cityId))
    .filter((item) => filters.ambassadorId === null || item.id === filters.ambassadorId)
    .map((item) => {
      const updates = data.ambassadorUpdates.filter(
        (update) => update.ambassadorId === item.id && recordPeriodMatches(update.period, filters.period),
      );
      const leads = data.leads.filter(
        (lead) => lead.ambassadorId === item.id &&
          lead.status !== "Cancelado" &&
          recordPeriodMatches(lead.createdAt, filters.period) &&
          (!filters.channel || lead.channel === filters.channel),
      );
      const leadIds = new Set(leads.map((lead) => lead.id));
      const sales = data.sales.filter((sale) => leadIds.has(sale.leadId));
      const payments = sales.filter((sale) => sale.status === paidStatus);
      const costs = data.costs.filter(
        (cost) => cost.ambassadorId === item.id &&
          recordPeriodMatches(cost.period, filters.period) &&
          (!filters.channel || cost.channel === filters.channel),
      );
      const taskDates = data.tasks
        .filter((task) => task.ambassadorId === item.id && task.status === "Concluída")
        .map((task) => task.completedAt);
      const lastActivity = latest([
        ...updates.map((update) => update.createdAt),
        ...leads.map((lead) => lead.createdAt),
        ...taskDates,
      ]);
      const actions = updates.reduce(
        (total, update) => total + update.actions + update.contents + update.events,
        0,
      );
      const validLeads = leads.length;
      const confirmedPayments = payments.length;
      const revenueCents = payments.reduce((total, sale) => total + sale.amountCents, 0);
      const costCents = costs.reduce((total, cost) => total + cost.amountCents, 0) +
        updates.reduce((total, update) => total + update.costCents, 0);
      const isActive = activeStatuses.has(item.status) &&
        item.onboardingStatus === "Concluído" &&
        item.trainingProgress >= 100 &&
        Boolean(item.termsAcceptedAt) &&
        activityIsRecent(lastActivity, data.settings.inactivityDays, now);

      return {
        ...item,
        isActive,
        lastActivity,
        actions,
        validLeads,
        confirmedPayments,
        revenueCents,
        costCents,
        conversion: safeRatio(confirmedPayments, validLeads),
        cacCents: confirmedPayments ? costCents / confirmedPayments : null,
      };
    });
}

function cityDecision(city: Omit<CityMetric, "decision" | "decisionReason">, settings: SettingsView) {
  if (city.status === "Pausada") {
    return { decision: "Pausar" as DecisionName, reason: "A cidade está pausada por decisão da operação." };
  }

  const missing: string[] = [];
  if (!city.leaderName) missing.push("líder local");
  if (city.targetCacCents <= 0) missing.push("limite de CAC");
  if (settings.minActiveAmbassadors <= 0) missing.push("mínimo de embaixadores ativos");
  if (settings.minConfirmedPayments <= 0) missing.push("mínimo de pagamentos");
  if (settings.minDataPeriods <= 0) missing.push("períodos mínimos de dados");
  if (missing.length) {
    return { decision: "Preparar" as DecisionName, reason: `Configure: ${missing.join(", ")}.` };
  }
  if (city.periods < settings.minDataPeriods) {
    return {
      decision: "Preparar" as DecisionName,
      reason: `Há ${city.periods} período(s) registrado(s); a regra pede ${settings.minDataPeriods}.`,
    };
  }
  if (city.costCents > 0 && city.confirmedPayments === 0) {
    return { decision: "Corrigir" as DecisionName, reason: "Existe custo registrado sem pagamento confirmado." };
  }
  if (city.cacCents !== null && city.cacCents > city.targetCacCents) {
    return {
      decision: "Corrigir" as DecisionName,
      reason: `O CAC está acima do limite configurado para ${city.name}.`,
    };
  }
  if (city.budgetCents > 0 && city.costCents > city.budgetCents) {
    return { decision: "Corrigir" as DecisionName, reason: "O custo acumulado ultrapassou o orçamento da cidade." };
  }

  const ambassadorsOk = city.activeAmbassadors >= settings.minActiveAmbassadors;
  const paymentsOk = city.confirmedPayments >= settings.minConfirmedPayments;
  const partnersOk = city.activePartners >= settings.minActivePartners;
  const organicOk = settings.organicGoalPercent <= 0 ||
    (city.organicShare !== null && city.organicShare * 100 >= settings.organicGoalPercent);

  if (ambassadorsOk && paymentsOk && partnersOk && organicOk) {
    return { decision: "Avançar" as DecisionName, reason: "A cidade atingiu todos os critérios configurados." };
  }

  const gaps: string[] = [];
  if (!ambassadorsOk) gaps.push("embaixadores ativos");
  if (!paymentsOk) gaps.push("pagamentos confirmados");
  if (!partnersOk) gaps.push("parceiros ativos");
  if (!organicOk) gaps.push("participação orgânica");
  return { decision: "Ajustar" as DecisionName, reason: `Falta atingir: ${gaps.join(", ")}.` };
}

function cityMetrics(
  data: DashboardData,
  filters: DashboardFilters,
  ambassadors: AmbassadorMetric[],
): CityMetric[] {
  return data.cities.filter((city) => cityIsSelected(city, filters)).map((city) => {
    const cityAmbassadors = ambassadors.filter((item) => item.cityId === city.id);
    const detailedMode = city.trackingMode === "Detalhado";
    const attributionFilterActive = Boolean(filters.channel || filters.ambassadorId !== null);
    const updates = detailedMode || attributionFilterActive
      ? []
      : data.cityUpdates.filter(
          (update) => update.cityId === city.id && recordPeriodMatches(update.period, filters.period),
        );
    const leads = !detailedMode
      ? []
      : data.leads.filter(
          (lead) => lead.cityId === city.id &&
            lead.status !== "Cancelado" &&
            recordPeriodMatches(lead.createdAt, filters.period) &&
            (!filters.channel || lead.channel === filters.channel) &&
            (filters.ambassadorId === null || lead.ambassadorId === filters.ambassadorId),
        );
    const leadIds = new Set(leads.map((lead) => lead.id));
    const sales = detailedMode
      ? data.sales.filter((sale) => leadIds.has(sale.leadId))
      : [];
    const costs = !detailedMode
      ? []
      : data.costs.filter(
          (cost) => cost.cityId === city.id &&
            recordPeriodMatches(cost.period, filters.period) &&
            (!filters.channel || cost.channel === filters.channel) &&
            (filters.ambassadorId === null || cost.ambassadorId === filters.ambassadorId),
        );
    const partners = data.partners.filter((partner) => partner.cityId === city.id && partner.status === "Ativo");
    const events = data.events.filter(
      (event) => event.cityId === city.id &&
        event.status === "Realizado" &&
        recordPeriodMatches(event.eventDate, filters.period),
    );

    const validLeads = detailedMode ? leads.length : updates.reduce((total, update) => total + update.leads, 0);
    const organicLeads = detailedMode
      ? leads.filter((lead) => lead.channel !== "Mídia paga").length
      : updates.reduce((total, update) => total + update.organicLeads, 0);
    const confirmedSales = detailedMode
      ? sales.filter((sale) => confirmedSaleStatuses.has(sale.status)).length
      : updates.reduce((total, update) => total + update.sales, 0);
    const confirmedPayments = detailedMode
      ? sales.filter((sale) => sale.status === paidStatus).length
      : updates.reduce((total, update) => total + update.sales, 0);
    const revenueCents = detailedMode
      ? sales.filter((sale) => sale.status === paidStatus).reduce((total, sale) => total + sale.amountCents, 0)
      : updates.reduce((total, update) => total + update.revenueCents, 0);
    const costCents = detailedMode
      ? costs.reduce((total, cost) => total + cost.amountCents, 0)
      : updates.reduce((total, update) => total + update.costCents, 0);
    const mediaCostCents = detailedMode
      ? costs.filter((cost) => cost.category === "Mídia paga" || cost.channel === "Mídia paga")
          .reduce((total, cost) => total + cost.amountCents, 0)
      : updates.reduce((total, update) => total + update.mediaCostCents, 0);
    const refunds = detailedMode
      ? sales.filter((sale) => sale.status === "Reembolsada").length
      : updates.reduce((total, update) => total + update.refunds, 0);
    const periods = new Set(
      detailedMode
        ? [
            ...leads.map((lead) => monthOf(lead.createdAt)),
            ...sales.map((sale) => monthOf(sale.paidAt ?? sale.updatedAt ?? sale.createdAt)),
            ...costs.map((cost) => cost.period),
          ].filter(Boolean)
        : updates.map((update) => update.period),
    ).size;

    const base = {
      ...city,
      ambassadors: cityAmbassadors.length,
      activeAmbassadors: cityAmbassadors.filter((item) => item.isActive).length,
      reach: detailedMode
        ? events.reduce((total, event) => total + event.reach, 0)
        : updates.reduce((total, update) => total + update.reach, 0),
      validLeads,
      organicLeads,
      confirmedSales,
      confirmedPayments,
      revenueCents,
      costCents,
      mediaCostCents,
      refunds,
      activePartners: detailedMode
        ? partners.length
        : updates.reduce((total, update) => total + update.partners, 0),
      eventsCount: detailedMode
        ? events.length
        : updates.reduce((total, update) => total + update.events, 0),
      periods,
      cplCents: validLeads ? costCents / validLeads : null,
      cacCents: confirmedPayments ? costCents / confirmedPayments : null,
      organicShare: safeRatio(organicLeads, validLeads),
      dataSource: (detailedMode ? "Detalhado" : "Consolidado") as "Detalhado" | "Consolidado",
    };
    const decision = cityDecision(base, data.settings);
    return { ...base, decision: decision.decision, decisionReason: decision.reason };
  });
}

function channelMetrics(data: DashboardData, filters: DashboardFilters, cities: CityMetric[]): ChannelMetric[] {
  const detailedCityIds = new Set(cities.filter((city) => city.dataSource === "Detalhado").map((city) => city.id));
  const selectedLeads = data.leads.filter(
    (lead) => detailedCityIds.has(lead.cityId) &&
      lead.status !== "Cancelado" &&
      recordPeriodMatches(lead.createdAt, filters.period) &&
      (!filters.channel || lead.channel === filters.channel) &&
      (filters.ambassadorId === null || lead.ambassadorId === filters.ambassadorId),
  );
  const selectedCosts = data.costs.filter(
    (cost) => detailedCityIds.has(cost.cityId) &&
      recordPeriodMatches(cost.period, filters.period) &&
      (!filters.channel || cost.channel === filters.channel) &&
      (filters.ambassadorId === null || cost.ambassadorId === filters.ambassadorId),
  );
  const leadById = new Map(selectedLeads.map((lead) => [lead.id, lead]));
  const channels = new Set([...selectedLeads.map((lead) => lead.channel), ...selectedCosts.map((cost) => cost.channel)]);
  return [...channels].sort().map((channel) => {
    const channelLeads = selectedLeads.filter((lead) => lead.channel === channel);
    const payments = data.sales.filter((sale) => {
      const lead = leadById.get(sale.leadId);
      return lead?.channel === channel && sale.status === paidStatus;
    });
    return {
      channel,
      leads: channelLeads.length,
      payments: payments.length,
      revenueCents: payments.reduce((total, sale) => total + sale.amountCents, 0),
      costCents: selectedCosts.filter((cost) => cost.channel === channel)
        .reduce((total, cost) => total + cost.amountCents, 0),
    };
  });
}

function summaryMetrics(cities: CityMetric[], ambassadors: AmbassadorMetric[], channels: ChannelMetric[]): SummaryMetric {
  const base = cities.reduce(
    (total, city) => ({
      plannedCities: total.plannedCities + 1,
      activeCities: total.activeCities + (city.status === "Ativa" ? 1 : 0),
      validLeads: total.validLeads + city.validLeads,
      confirmedSales: total.confirmedSales + city.confirmedSales,
      confirmedPayments: total.confirmedPayments + city.confirmedPayments,
      revenueCents: total.revenueCents + city.revenueCents,
      costCents: total.costCents + city.costCents,
      mediaCostCents: total.mediaCostCents + city.mediaCostCents,
      organicLeads: total.organicLeads + city.organicLeads,
    }),
    {
      plannedCities: 0,
      activeCities: 0,
      validLeads: 0,
      confirmedSales: 0,
      confirmedPayments: 0,
      revenueCents: 0,
      costCents: 0,
      mediaCostCents: 0,
      organicLeads: 0,
    },
  );
  const activeAmbassadors = ambassadors.filter((item) => item.isActive).length;
  const paidRevenue = channels.find((item) => item.channel === "Mídia paga")?.revenueCents ?? 0;
  return {
    ...base,
    activeAmbassadors,
    conversion: safeRatio(base.confirmedPayments, base.validLeads),
    cplCents: base.validLeads ? base.costCents / base.validLeads : null,
    cacCents: base.confirmedPayments ? base.costCents / base.confirmedPayments : null,
    organicShare: safeRatio(base.organicLeads, base.validLeads),
    roas: safeRatio(paidRevenue, base.mediaCostCents),
    roi: base.costCents ? (base.revenueCents - base.costCents) / base.costCents : null,
    costPerActiveAmbassadorCents: activeAmbassadors ? base.costCents / activeAmbassadors : null,
  };
}

function alerts(data: DashboardData, cities: CityMetric[], ambassadors: AmbassadorMetric[]): AlertMetric[] {
  const result: AlertMetric[] = [];
  if (data.settings.minActiveAmbassadors <= 0 || data.settings.minConfirmedPayments <= 0 || data.settings.minDataPeriods <= 0) {
    result.push({
      id: "settings-incomplete",
      severity: "Alta",
      title: "Critérios de decisão incompletos",
      description: "Defina os mínimos de embaixadores, pagamentos e períodos em Configurações.",
      cityId: null,
    });
  }
  cities.forEach((city) => {
    if (["Corrigir", "Pausar"].includes(city.decision)) {
      result.push({
        id: `city-${city.id}-${city.decision}`,
        severity: "Alta",
        title: `${city.name}: ${city.decision}`,
        description: city.decisionReason,
        cityId: city.id,
      });
    } else if (!city.leaderName) {
      result.push({
        id: `city-${city.id}-leader`,
        severity: "Atenção",
        title: `${city.name} está sem líder`,
        description: "Defina um responsável antes de ampliar as ações locais.",
        cityId: city.id,
      });
    }
  });
  ambassadors.filter((item) => ["Aprovado", "Em treinamento", "Ativo"].includes(item.status) && !item.isActive)
    .slice(0, 6)
    .forEach((item) => result.push({
      id: `ambassador-${item.id}`,
      severity: "Atenção",
      title: `${item.name} ainda não está ativo`,
      description: "Confira treinamento, aceite das regras e atividade registrada.",
      cityId: item.cityId,
    }));
  data.sales.filter((sale) => sale.status === "Venda confirmada").slice(0, 6).forEach((sale) => result.push({
    id: `sale-${sale.id}-payment`,
    severity: "Atenção",
    title: "Venda aguardando pagamento",
    description: `A venda do lead #${sale.leadId} não entra no CAC até o pagamento ser confirmado.`,
    cityId: sale.cityId,
  }));
  return result;
}

function timeline(data: DashboardData, filters: DashboardFilters, now: Date): TimelineMetric[] {
  const periods = new Set<string>();
  data.cityUpdates.forEach((item) => periods.add(item.period));
  data.leads.forEach((item) => { const period = monthOf(item.createdAt); if (period) periods.add(period); });
  data.costs.forEach((item) => periods.add(item.period));
  data.sales.forEach((item) => { const period = monthOf(item.paidAt ?? item.updatedAt ?? item.createdAt); if (period) periods.add(period); });
  return [...periods].filter(Boolean).sort().slice(-8).map((period) => {
    const periodFilters = { ...filters, period };
    const selectedCityIds = new Set(data.cities.filter((city) => cityIsSelected(city, periodFilters)).map((city) => city.id));
    const ambassadorView = ambassadorMetrics(data, periodFilters, selectedCityIds, now);
    const cityView = cityMetrics(data, periodFilters, ambassadorView);
    const periodSummary = cityView.reduce((total, city) => ({
      leads: total.leads + city.validLeads,
      payments: total.payments + city.confirmedPayments,
      revenue: total.revenue + city.revenueCents / 100,
      cost: total.cost + city.costCents / 100,
    }), { leads: 0, payments: 0, revenue: 0, cost: 0 });
    return { period, ...periodSummary };
  });
}

export function buildDashboardView(
  data: DashboardData,
  filters: DashboardFilters = EMPTY_FILTERS,
  now = new Date(),
): DashboardView {
  const selectedCityIds = new Set(data.cities.filter((city) => cityIsSelected(city, filters)).map((city) => city.id));
  const ambassadors = ambassadorMetrics(data, filters, selectedCityIds, now);
  const cities = cityMetrics(data, filters, ambassadors);
  const channels = channelMetrics(data, filters, cities);
  const selectedLeadIds = new Set(
    data.leads.filter((lead) => selectedCityIds.has(lead.cityId))
      .filter((lead) => recordPeriodMatches(lead.createdAt, filters.period))
      .filter((lead) => !filters.channel || lead.channel === filters.channel)
      .filter((lead) => filters.ambassadorId === null || lead.ambassadorId === filters.ambassadorId)
      .map((lead) => lead.id),
  );
  return {
    summary: summaryMetrics(cities, ambassadors, channels),
    cities,
    ambassadors,
    alerts: alerts(data, cities, ambassadors),
    timeline: timeline(data, filters, now),
    channels,
    filteredLeads: data.leads.filter((lead) => selectedLeadIds.has(lead.id)),
    filteredSales: data.sales.filter((sale) => selectedLeadIds.has(sale.leadId)),
    filteredCosts: data.costs.filter((cost) => selectedCityIds.has(cost.cityId))
      .filter((cost) => recordPeriodMatches(cost.period, filters.period))
      .filter((cost) => !filters.channel || cost.channel === filters.channel)
      .filter((cost) => filters.ambassadorId === null || cost.ambassadorId === filters.ambassadorId),
  };
}

export function availablePeriods(data: DashboardData) {
  const periods = new Set<string>();
  data.cityUpdates.forEach((item) => periods.add(item.period));
  data.leads.forEach((item) => { const value = monthOf(item.createdAt); if (value) periods.add(value); });
  data.costs.forEach((item) => periods.add(item.period));
  return [...periods].filter(Boolean).sort().reverse();
}
