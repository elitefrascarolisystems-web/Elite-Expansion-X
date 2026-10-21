import "./zod-pt";
import { z } from 'zod';
import { PERSON_ROLES, PLACE_LINKS } from './places';
const text = z.string().trim().max(200);
const id = z.number().int().positive();
export const locationSchema = z.object({
  key: z.string().regex(/^(city|partner|event):[1-9][0-9]*$|^(person|action|business):[a-f0-9-]{36}$/),
  latitude: z.number().finite().min(-85).max(85).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  region: text.default(''),
  precision: z.enum(['Cidade', 'Região aproximada', 'Local comercial']),
  source: text.min(3), validated: z.boolean(), authorized: z.literal(true),
  visibility: z.enum(['Equipe','Admin']),
}).superRefine((v,c) => {
  if ((v.latitude === null) !== (v.longitude === null)) c.addIssue({code:'custom',message:'Informe latitude e longitude juntas.'});
  if (v.validated && v.latitude === null) c.addIssue({code:'custom',message:'Confirme um ponto antes de validar.'});
  if (v.key.startsWith('person:') && v.precision === 'Local comercial') c.addIssue({code:'custom',message:'Pessoas usam cidade ou região aproximada.'});
});
export const personSchema = z.object({
  id: z.string().uuid().optional(), requestId: z.string().uuid().optional(), cityId: id, name: text.min(2),
  leader: z.boolean().default(false), referrerId: z.string().uuid().nullable().default(null),
  placeId: z.string().uuid().nullable().default(null), placeLink: z.union([z.enum(PLACE_LINKS), z.literal('')]).default(''),
  authorized: z.literal(true),
  /** A pessoa já foi avisada de que existe alguém com o mesmo nome na cidade e confirmou que é outra. */
  confirmDuplicate: z.boolean().default(false),
}).refine(v => !v.placeId || v.placeLink !== '', { message: 'Informe o vínculo da pessoa com o local.', path: ['placeLink'] });
export const activitySchema = z.object({
  id: z.string().uuid().optional(), requestId: z.string().uuid().optional(), cityId: id, personId: z.string().uuid().nullable().default(null),
  name: text.min(2), category: z.enum(['Ação','Visita','Follow-up','Interação','Missão']),
  status: z.enum(['Programado','Realizado','Cancelado']), responsible: text,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(value + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value; }, 'Informe uma data válida no formato AAAA-MM-DD.'),
});
export function displayedCoordinates(kind: string, latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return {latitude:null,longitude:null};
  // Personal coordinates are never accepted; reads resolve the city reference server-side.
  return kind === 'person' ? {latitude:null,longitude:null} : {latitude,longitude};
}
export const roleSchema=z.object({personId:z.string().uuid(),role:z.enum(PERSON_ROLES),status:z.enum(['Convidado','Em análise','Aprovado','Em treinamento','Ativo','Pausado','Inativo','Desligado']),responsible:text,source:text.min(3),authorized:z.literal(true)});

/** Linha da planilha de pessoas: o local é procurado pelo nome dentro da cidade. */
export const importPersonSchema = z.object({
  cityId: id, name: text.min(2),
  place: z.string().trim().max(200).default(''), link: z.string().trim().max(80).default(''), role: z.string().trim().max(80).default(''),
});
