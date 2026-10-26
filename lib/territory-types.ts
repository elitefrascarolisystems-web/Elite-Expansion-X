export type TerritoryKind = 'city' | 'person' | 'partner' | 'business' | 'event' | 'action';
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
  /** Quem esta pessoa indicou (nome só para a gestão) e se já comprou. */
  referred?: { name: string; client: boolean }[];
  /** Local (empresa, escritório, network) ao qual a pessoa se liga. */
  place?: { id: string; name: string; type: string; link: string };
  /** Bairro da pessoa; `located` diz se o bairro já tem ponto no mapa. */
  region?: { id: string; name: string; located: boolean };
};
export type TerritoryPoint={latitude:number;longitude:number;count:number;people:number;key:string;kind:TerritoryKind;roles:string[];status:string;
 /** Nome do cadastro quando o ponto tem um só (para o cartão ao passar o mouse). */
 name?:string};
export type TerritoryResponse = {
 roleCounts?:Record<string,number>;points?:TerritoryPoint[];pointsCapped?:boolean;inView?:number;people?:number;pending?:number;
  records: TerritoryRecord[]; total: number; hasMore: boolean; nextOffset: number | null;
  updatedAt: string; canEdit: boolean;
};
/** Um local (empresa, escritório, network…) ou o centro de uma cidade, para os modos do mapa. Nunca a posição de uma pessoa. */
export type MapSpot={key:string;kind:'business'|'city'|'region';name:string;latitude:number;longitude:number;cityId:number;
 /** Tipo do local ("Empresa", "Escritório"…), "Bairro" ou "Cidade". */
 type:string;sector:string;
 /** Dia em que o local foi cadastrado (AAAA-MM-DD); vazio no centro da cidade. */
 mapped:string;
 /** Pessoas ligadas ao local, entre as que você pode ver. */
 people:number;
 /** Atendimentos registrados, ações realizadas e cadastro do local nos últimos 30 dias. */
 recent:number};
/** Atendimentos agrupados: [local (índice em spots), etapa (índice em STAGES), temperatura (índice em TEMPERATURES), mês de abertura AAAA-MM, mês do pagamento confirmado ou '', quantidade]. */
export type MapDeal=[spot:number,stage:number,temperature:number,opened:string,paid:string,count:number];
export type TerritoryPlacesResponse={spots:MapSpot[];deals:MapDeal[];
 /** Mais de 5.000 locais (ou atendimentos demais) no filtro: escolha uma cidade para ver tudo. */
 capped:boolean;
 /** Atendimentos de cidades ainda sem ponto no mapa. */
 unplaced:number;updatedAt:string};
