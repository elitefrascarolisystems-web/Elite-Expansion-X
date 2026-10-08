export type TerritoryKind = 'city' | 'person' | 'partner' | 'event' | 'action';
export type TerritoryLocation = {
  latitude: number | null; longitude: number | null; region: string;
  precision: 'Cidade' | 'Região aproximada' | 'Local comercial';
  source: string; validated: boolean; visibility: 'Equipe' | 'Admin'; updatedAt: string;
};
export type TerritoryRecord = {
  aggregateCount?:number;aggregatePeople?:number; key: string; id: string; kind: TerritoryKind; cityId: number; cityName: string; state: string;
  roleDetails?:Array<{role:string;status:string;responsible:string;source:string}>;
  name: string; roles: string[]; status: string; responsible: string; lastActivity: string;
  nextAction: string; dueDate: string; location: TerritoryLocation | null;
  ambassadorId: number | null; leadId: number | null; referrerId: string | null;referrerName?:string;
};
export type TerritoryPoint={latitude:number;longitude:number;count:number;people:number;key:string;kind:TerritoryKind;roles:string[];status:string};
export type TerritoryResponse = {
 roleCounts?:Record<string,number>;points?:TerritoryPoint[];pointsCapped?:boolean;inView?:number;people?:number;pending?:number;
  records: TerritoryRecord[]; total: number; hasMore: boolean; nextOffset: number | null;
  updatedAt: string; canEdit: boolean;
};
