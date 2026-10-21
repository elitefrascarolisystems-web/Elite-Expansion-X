export const USER_ROLES = ["Administrador", "Coordenação", "Líder", "Embaixador", "Comercial"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type AccessView = {
  isOrganizationOwner?: boolean;
  /** Acesso pela Assessoria Elite (time da plataforma), não por vínculo próprio na organização. */
  isAdvisory?: boolean;
  organizationId: number;
  organizationName: string;
  isPlatformOwner: boolean;
  id: number;
  email: string;
  name: string;
  role: UserRole;
  cityId: number | null;
  ambassadorId: number | null;
  active: boolean;
  canManageGlobal: boolean;
  canManageCity: boolean;
  canManagePipeline: boolean;
  canManageContent: boolean;
};

export type SettingsView = {
  ownerEmail: string;
  referralBaseUrl: string;
  attributionModel: string;
  minActiveAmbassadors: number;
  minConfirmedPayments: number;
  minActivePartners: number;
  minDataPeriods: number;
  inactivityDays: number;
  organicGoalPercent: number;
  updatedBy: string;
  updatedAt: string;
};

export type CityRecord = {
  id: number;
  name: string;
  state: string;
  phase: string;
  leaderName: string;
  targetCacCents: number;
  ambassadorGoal: number;
  salesGoal: number;
  status: string;
  budgetCents: number;
  trackingMode: string;
  notes: string;
  updatedAt: string;
  createdAt: string;
};

export type AmbassadorRecord = {
  id: number;
  cityId: number;
  cityName: string;
  name: string;
  code: string;
  email: string;
  whatsapp: string;
  whatsappAuthorizedAt: string | null;
  level: string;
  status: string;
  onboardingStatus: string;
  trainingProgress: number;
  termsAcceptedAt: string | null;
  pauseReason: string;
  updatedAt: string;
  createdAt: string;
};

export type CityUpdateRecord = {
  id: number;
  cityId: number;
  period: string;
  reach: number;
  leads: number;
  organicLeads: number;
  sales: number;
  revenueCents: number;
  costCents: number;
  mediaCostCents: number;
  refunds: number;
  satisfaction: number;
  partners: number;
  events: number;
  note: string;
  createdAt: string;
};

export type AmbassadorUpdateRecord = {
  id: number;
  ambassadorId: number;
  period: string;
  leads: number;
  sales: number;
  actions: number;
  contents: number;
  events: number;
  costCents: number;
  note: string;
  createdAt: string;
};

export type LeadRecord = {
  id: number;
  cityId: number;
  cityName: string;
  ambassadorId: number | null;
  ambassadorName: string;
  partnerId: number | null;
  eventId: number | null;
  contentId: number | null;
  name: string;
  email: string;
  whatsapp: string;
  status: string;
  channel: string;
  sourceLabel: string;
  campaign: string;
  consentAt: string;
  consentSource: string;
  consentPurpose: string;
  consentRevokedAt: string | null;
  consentRevocationReason: string;
  assignedToEmail: string;
  createdAt: string;
};

export type SaleRecord = {
  id: number;
  leadId: number;
  cityId: number;
  ambassadorId: number | null;
  product: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type CostRecord = {
  id: number;
  cityId: number;
  ambassadorId: number | null;
  partnerId: number | null;
  eventId: number | null;
  category: string;
  channel: string;
  period: string;
  amountCents: number;
  note: string;
  createdAt: string;
};

export type PartnerRecord = {
  id: number;
  cityId: number;
  cityName: string;
  name: string;
  type: string;
  contactName: string;
  whatsapp: string;
  status: string;
  nextAction: string;
  createdAt: string;
};

export type EventRecord = {
  id: number;
  cityId: number;
  cityName: string;
  partnerId: number | null;
  name: string;
  eventDate: string;
  status: string;
  ownerName: string;
  costCents: number;
  reach: number;
  leads: number;
  sales: number;
  createdAt: string;
};

export type ContentRecord = {
  id: number;
  cityId: number | null;
  cityName: string;
  title: string;
  type: string;
  channel: string;
  version: string;
  status: string;
  url: string;
  instructions: string;
  expiresAt: string | null;
  createdAt: string;
};

export type TaskRecord = {
  id: number;
  cityId: number | null;
  ambassadorId: number | null;
  ambassadorName: string;
  title: string;
  category: string;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
};

export type UserProfileRecord = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  cityId: number | null;
  cityName: string;
  ambassadorId: number | null;
  ambassadorName: string;
  active: boolean;
  /** Já criou a senha de acesso. */
  hasPassword: boolean;
  createdAt: string;
};

export type AuditRecord = {
  id: number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  createdAt: string;
  /** Ação feita pela Assessoria Elite (time da plataforma). */
  advisory?: boolean;
};

export type DashboardData = {
  people?: Array<{id: string; cityId: number; name: string}>;
  /** Empresas, escritórios e networks para vincular pessoas a um local. */
  places?: Array<{id: string; cityId: number; name: string; placeType: string}>;
  access: AccessView;
  settings: SettingsView;
  cities: CityRecord[];
  ambassadors: AmbassadorRecord[];
  cityUpdates: CityUpdateRecord[];
  ambassadorUpdates: AmbassadorUpdateRecord[];
  leads: LeadRecord[];
  sales: SaleRecord[];
  costs: CostRecord[];
  partners: PartnerRecord[];
  events: EventRecord[];
  contents: ContentRecord[];
  tasks: TaskRecord[];
  users: UserProfileRecord[];
  /** Time da Assessoria Elite com acesso a esta organização (visível a quem administra). */
  advisors: { email: string; name: string }[];
  auditLogs: AuditRecord[];
  lastUpdated: string;
};

export type DashboardFilters = {
  cityId: number | null;
  period: string;
  channel: string;
  leader: string;
  ambassadorId: number | null;
};

export type DecisionName = "Preparar" | "Ajustar" | "Corrigir" | "Avançar" | "Pausar";

export type CityMetric = CityRecord & {
  ambassadors: number;
  activeAmbassadors: number;
  reach: number;
  validLeads: number;
  organicLeads: number;
  confirmedSales: number;
  confirmedPayments: number;
  revenueCents: number;
  costCents: number;
  mediaCostCents: number;
  ambassadorProgramCostCents: number | null;
  refunds: number;
  activePartners: number;
  eventsCount: number;
  periods: number;
  cplCents: number | null;
  cacCents: number | null;
  organicShare: number | null;
  decision: DecisionName;
  decisionReason: string;
  dataSource: "Consolidado" | "Detalhado";
};

export type AmbassadorMetric = AmbassadorRecord & {
  isActive: boolean;
  lastActivity: string | null;
  actions: number;
  validLeads: number;
  confirmedPayments: number;
  revenueCents: number;
  costCents: number;
  conversion: number | null;
  cacCents: number | null;
};

export type SummaryMetric = {
  plannedCities: number;
  activeCities: number;
  activeAmbassadors: number;
  eligibleAmbassadors: number;
  validLeads: number;
  confirmedSales: number;
  confirmedPayments: number;
  revenueCents: number;
  costCents: number;
  mediaCostCents: number;
  organicLeads: number;
  conversion: number | null;
  cplCents: number | null;
  cacCents: number | null;
  organicShare: number | null;
  activation: number | null;
  roas: number | null;
  roi: number | null;
  costPerActiveAmbassadorCents: number | null;
};

export type AlertMetric = {
  id: string;
  severity: "Atenção" | "Alta";
  title: string;
  description: string;
  cityId: number | null;
};

export type TimelineMetric = {
  period: string;
  leads: number;
  payments: number;
  revenue: number;
  cost: number;
};

export type ChannelMetric = {
  channel: string;
  leads: number;
  payments: number;
  revenueCents: number;
  costCents: number;
};

export type DashboardView = {
  summary: SummaryMetric;
  cities: CityMetric[];
  ambassadors: AmbassadorMetric[];
  alerts: AlertMetric[];
  timeline: TimelineMetric[];
  channels: ChannelMetric[];
  filteredLeads: LeadRecord[];
  filteredSales: SaleRecord[];
  filteredCosts: CostRecord[];
};
