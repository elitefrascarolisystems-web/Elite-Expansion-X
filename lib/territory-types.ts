export type TerritoryKind = 'city' | 'person' | 'partner' | 'event' | 'action';
export type TerritoryLocation = {
  latitude: number | null; longitude: number | null; region: string;
  precision: 'Cidade' | 'Região aproximada' | 'Local comercial';
  source: string; validated: boolean; visibility: 'Equipe' | 'Admin'; updatedAt: string;
};
export type TerritoryRecord = {
  key: string; id: string; kind: TerritoryKind; cityId: number; cityName: string; state: string;
  name: string; roles: string[]; status: string; responsible: string; lastActivity: string;
  nextAction: string; dueDate: string; location: TerritoryLocation | null;
  ambassadorId: number | null; leadId: number | null; referrerId: string | null;
};
export type TerritoryResponse = {
  records: TerritoryRecord[]; total: number; hasMore: boolean; nextOffset: number | null;
  updatedAt: string; canEdit: boolean;
};
