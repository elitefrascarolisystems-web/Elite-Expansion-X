export type CityView = {
  id: number;
  name: string;
  state: string;
  phase: string;
  leaderName: string;
  targetCacCents: number;
  ambassadorGoal: number;
  salesGoal: number;
  status: string;
  ambassadors: number;
  activeAmbassadors: number;
  reach: number;
  leads: number;
  organicLeads: number;
  sales: number;
  revenueCents: number;
  costCents: number;
  partners: number;
  events: number;
};

export type AmbassadorView = {
  id: number;
  cityId: number;
  cityName: string;
  name: string;
  code: string;
  whatsapp: string;
  level: string;
  status: string;
  leads: number;
  sales: number;
  costCents: number;
  lastActivity: string | null;
};

export type RecentUpdate = {
  id: number;
  cityName: string;
  period: string;
  leads: number;
  sales: number;
  costCents: number;
  createdAt: string;
};

export type DashboardData = {
  cities: CityView[];
  ambassadors: AmbassadorView[];
  recentUpdates: RecentUpdate[];
  summary: {
    plannedCities: number;
    activeCities: number;
    activeAmbassadors: number;
    leads: number;
    sales: number;
    revenueCents: number;
    costCents: number;
    organicLeads: number;
  };
};
