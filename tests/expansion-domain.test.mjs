import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => vite.close());

function baseData() {
  return {
    access: {
      id: 1,
      email: "teamfrascaroli@gmail.com",
      name: "Felipe Frascaroli",
      role: "Administrador",
      cityId: null,
      ambassadorId: null,
      active: true,
      canManageGlobal: true,
      canManageCity: true,
      canManagePipeline: true,
      canManageContent: true,
    },
    settings: {
      ownerEmail: "teamfrascaroli@gmail.com",
      referralBaseUrl: "",
      attributionModel: "Origem principal declarada",
      minActiveAmbassadors: 1,
      minConfirmedPayments: 1,
      minActivePartners: 0,
      minDataPeriods: 1,
      inactivityDays: 30,
      organicGoalPercent: 0,
      updatedBy: "",
      updatedAt: "",
    },
    cities: [{
      id: 1,
      name: "Esmeraldas",
      state: "MG",
      phase: "Piloto",
      leaderName: "Líder teste",
      targetCacCents: 50000,
      ambassadorGoal: 10,
      salesGoal: 100,
      status: "Ativa",
      budgetCents: 100000,
      trackingMode: "Detalhado",
      notes: "",
      updatedAt: "",
      createdAt: "2026-08-01T09:00:00-03:00",
    }],
    ambassadors: [],
    cityUpdates: [],
    ambassadorUpdates: [],
    leads: [],
    sales: [],
    costs: [],
    partners: [],
    events: [],
    contents: [],
    tasks: [],
    users: [],
    auditLogs: [],
    lastUpdated: "2026-08-30T10:00:00-03:00",
  };
}

test("keeps ratios empty instead of dividing by zero", async () => {
  const { buildDashboardView, EMPTY_FILTERS } = await vite.ssrLoadModule("/lib/expansion-domain.ts");
  const view = buildDashboardView(baseData(), EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.cplCents, null);
  assert.equal(view.summary.cacCents, null);
  assert.equal(view.summary.roas, null);
  assert.equal(view.summary.roi, null);
});

test("detailed tracking does not double count consolidated history", async () => {
  const { buildDashboardView, EMPTY_FILTERS } = await vite.ssrLoadModule("/lib/expansion-domain.ts");
  const data = baseData();
  data.cityUpdates.push({
    id: 1, cityId: 1, period: "2026-08", reach: 100, leads: 50, organicLeads: 40,
    sales: 10, revenueCents: 1000000, costCents: 300000, mediaCostCents: 200000,
    refunds: 0, satisfaction: 9, partners: 2, events: 1, note: "histórico", createdAt: "2026-08-20T10:00:00-03:00",
  });
  data.leads.push({
    id: 1, cityId: 1, cityName: "Esmeraldas", ambassadorId: null, ambassadorName: "",
    partnerId: null, eventId: null, contentId: null, name: "Lead teste", email: "", whatsapp: "31999999999",
    status: "Lead válido", channel: "Orgânico", sourceLabel: "", campaign: "", consentAt: "2026-08-21T10:00:00-03:00",
    consentSource: "Formulário", consentPurpose: "Atendimento", assignedToEmail: "", createdAt: "2026-08-21T10:00:00-03:00",
  });
  const view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.validLeads, 1);
  assert.equal(view.summary.revenueCents, 0);
});

test("CAC uses only confirmed payments", async () => {
  const { buildDashboardView, EMPTY_FILTERS } = await vite.ssrLoadModule("/lib/expansion-domain.ts");
  const data = baseData();
  data.leads.push({
    id: 1, cityId: 1, cityName: "Esmeraldas", ambassadorId: null, ambassadorName: "",
    partnerId: null, eventId: null, contentId: null, name: "Lead teste", email: "", whatsapp: "31999999999",
    status: "Oportunidade", channel: "Mídia paga", sourceLabel: "", campaign: "", consentAt: "2026-08-21T10:00:00-03:00",
    consentSource: "Formulário", consentPurpose: "Atendimento", assignedToEmail: "", createdAt: "2026-08-21T10:00:00-03:00",
  });
  data.costs.push({ id: 1, cityId: 1, ambassadorId: null, partnerId: null, eventId: null, category: "Mídia paga", channel: "Mídia paga", period: "2026-08", amountCents: 30000, note: "", createdAt: "2026-08-21T10:00:00-03:00" });
  data.sales.push({ id: 1, leadId: 1, cityId: 1, ambassadorId: null, product: "Premium", amountCents: 149700, status: "Venda confirmada", paidAt: null, updatedAt: "2026-08-22T10:00:00-03:00", createdAt: "2026-08-22T10:00:00-03:00" });
  let view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.confirmedPayments, 0);
  assert.equal(view.summary.cacCents, null);
  data.sales[0].status = "Pagamento confirmado";
  data.sales[0].paidAt = "2026-08-23T10:00:00-03:00";
  view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.confirmedPayments, 1);
  assert.equal(view.summary.cacCents, 30000);
  assert.equal(view.summary.revenueCents, 149700);
});

test("ambassador is active only after onboarding, terms and recent activity", async () => {
  const { buildDashboardView, EMPTY_FILTERS } = await vite.ssrLoadModule("/lib/expansion-domain.ts");
  const data = baseData();
  data.ambassadors.push({
    id: 1, cityId: 1, cityName: "Esmeraldas", name: "Embaixador teste", code: "ESM001", email: "", whatsapp: "",
    level: "Embaixador ativo", status: "Ativo", onboardingStatus: "Concluído", trainingProgress: 100,
    termsAcceptedAt: "2026-08-01T10:00:00-03:00", pauseReason: "", updatedAt: "", createdAt: "2026-08-01T10:00:00-03:00",
  });
  data.ambassadorUpdates.push({ id: 1, ambassadorId: 1, period: "2026-08", leads: 0, sales: 0, actions: 1, contents: 0, events: 0, costCents: 0, note: "", createdAt: "2026-08-29T10:00:00-03:00" });
  const view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.ambassadors[0].isActive, true);
  data.ambassadors[0].termsAcceptedAt = null;
  const withoutTerms = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(withoutTerms.ambassadors[0].isActive, false);
});

test("permissions keep ambassadors inside their own city and profile", async () => {
  const { canAccessAmbassador, canPerform } = await vite.ssrLoadModule("/lib/expansion-permissions.ts");
  const access = { ...baseData().access, role: "Embaixador", cityId: 1, ambassadorId: 7, canManageGlobal: false, canManageCity: false, canManagePipeline: false, canManageContent: false };
  assert.equal(canPerform(access, "accept_terms"), true);
  assert.equal(canPerform(access, "update_settings"), false);
  assert.equal(canAccessAmbassador(access, 7, 1), true);
  assert.equal(canAccessAmbassador(access, 8, 1), false);
  assert.equal(canAccessAmbassador(access, 7, 2), false);
});

test("keeps leader and commercial API actions within their duties", async () => {
  const { canAccessCity, canPerform } = await vite.ssrLoadModule("/lib/expansion-permissions.ts");
  const leader = { ...baseData().access, role: "Líder", cityId: 1, canManageGlobal: false };
  assert.equal(canPerform(leader, "create_ambassador"), true);
  assert.equal(canPerform(leader, "update_settings"), false);
  assert.equal(canAccessCity(leader, 1), true);
  assert.equal(canAccessCity(leader, 2), false);
  const commercial = { ...baseData().access, role: "Comercial", canManageGlobal: false, canManageCity: false, canManageContent: false };
  assert.equal(canPerform(commercial, "record_sale"), true);
  assert.equal(canPerform(commercial, "create_cost"), false);
  assert.equal(canPerform(commercial, "create_content"), false);
});

test("counts only validated leads in acquisition formulas", async () => {
  const { buildDashboardView, EMPTY_FILTERS } = await vite.ssrLoadModule("/lib/expansion-domain.ts");
  const data = baseData();
  const leadBase = {
    cityId: 1, cityName: "Esmeraldas", ambassadorId: null, ambassadorName: "", partnerId: null,
    eventId: null, contentId: null, email: "", sourceLabel: "", campaign: "", consentAt: "2026-08-21T10:00:00-03:00",
    consentSource: "Formulário", consentPurpose: "Atendimento", assignedToEmail: "", createdAt: "2026-08-21T10:00:00-03:00",
  };
  data.leads.push(
    { ...leadBase, id: 1, name: "Contato informado", whatsapp: "31900000001", status: "Lead informado", channel: "Orgânico" },
    { ...leadBase, id: 2, name: "Contato validado", whatsapp: "31900000002", status: "Oportunidade", channel: "Mídia paga" },
  );
  data.costs.push({ id: 1, cityId: 1, ambassadorId: null, partnerId: null, eventId: null, category: "Mídia paga", channel: "Mídia paga", period: "2026-08", amountCents: 20000, note: "", createdAt: "2026-08-21T10:00:00-03:00" });
  data.sales.push({ id: 1, leadId: 2, cityId: 1, ambassadorId: null, product: "Produto", amountCents: 100000, status: "Pagamento confirmado", paidAt: "2026-08-22T10:00:00-03:00", updatedAt: "2026-08-22T10:00:00-03:00", createdAt: "2026-08-22T10:00:00-03:00" });
  const view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.validLeads, 1);
  assert.equal(view.summary.organicLeads, 0);
  assert.equal(view.summary.cacCents, 20000);
  assert.equal(view.summary.roas, 5);
  assert.equal(view.summary.roi, 4);
});

test("uses only ambassador-program costs in the active ambassador formula", async () => {
  const { buildDashboardView, EMPTY_FILTERS } = await vite.ssrLoadModule("/lib/expansion-domain.ts");
  const data = baseData();
  data.ambassadors.push({
    id: 1, cityId: 1, cityName: "Esmeraldas", name: "Embaixador teste", code: "ESM001", email: "", whatsapp: "",
    level: "Embaixador ativo", status: "Ativo", onboardingStatus: "Concluído", trainingProgress: 100,
    termsAcceptedAt: "2026-08-01T10:00:00-03:00", pauseReason: "", updatedAt: "", createdAt: "2026-08-01T10:00:00-03:00",
  });
  data.ambassadorUpdates.push({ id: 1, ambassadorId: 1, period: "2026-08", leads: 0, sales: 0, actions: 1, contents: 0, events: 0, costCents: 0, note: "", createdAt: "2026-08-29T10:00:00-03:00" });
  data.costs.push(
    { id: 1, cityId: 1, ambassadorId: 1, partnerId: null, eventId: null, category: "Material", channel: "Embaixador", period: "2026-08", amountCents: 30000, note: "", createdAt: "2026-08-21T10:00:00-03:00" },
    { id: 2, cityId: 1, ambassadorId: null, partnerId: null, eventId: null, category: "Mídia paga", channel: "Mídia paga", period: "2026-08", amountCents: 70000, note: "", createdAt: "2026-08-21T10:00:00-03:00" },
  );
  let view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.activation, 1);
  assert.equal(view.summary.costPerActiveAmbassadorCents, 30000);
  data.cities[0].trackingMode = "Consolidado";
  view = buildDashboardView(data, EMPTY_FILTERS, new Date("2026-08-30T12:00:00Z"));
  assert.equal(view.summary.costPerActiveAmbassadorCents, null);
});

test("rejects unsafe links and contact data without authorization", async () => {
  const { parseActionPayload } = await vite.ssrLoadModule("/lib/expansion-validation.ts");
  assert.throws(() => parseActionPayload("create_content", {
    cityId: null, title: "Material", type: "Mensagem", channel: "WhatsApp", version: "1.0",
    status: "Aprovado", url: "javascript:alert(1)", instructions: "Uso interno", expiresAt: "",
  }));
  assert.throws(() => parseActionPayload("create_ambassador", {
    cityId: 1, name: "Pessoa teste", code: "ESM002", email: "", whatsapp: "31900000000",
    whatsappAuthorized: false, level: "Indicador", status: "Convidado",
  }));
  assert.throws(() => parseActionPayload("update_lead", {
    leadId: 1, status: "Cancelado", assignedToEmail: "", consentRevoked: true, consentRevocationReason: "",
  }));
  assert.throws(() => parseActionPayload("update_settings", {
    referralBaseUrl: "", attributionModel: "Último contato confirmado", minActiveAmbassadors: 1,
    minConfirmedPayments: 1, minActivePartners: 0, minDataPeriods: 1, inactivityDays: 30,
    organicGoalPercent: 0,
  }));
});
