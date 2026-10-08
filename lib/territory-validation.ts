import { z } from 'zod';
const text = z.string().trim().max(200);
const id = z.number().int().positive();
export const locationSchema = z.object({
  key: z.string().regex(/^(city|partner|event):[1-9][0-9]*$|^(person|action):[a-f0-9-]{36}$/),
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
  authorized: z.literal(true),
});
export const activitySchema = z.object({
  id: z.string().uuid().optional(), requestId: z.string().uuid().optional(), cityId: id, personId: z.string().uuid().nullable().default(null),
  name: text.min(2), category: z.enum(['Ação','Visita','Follow-up','Interação','Missão']),
  status: z.enum(['Programado','Realizado','Cancelado']), responsible: text,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(value + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value; }, 'Informe uma data válida no formato AAAA-MM-DD.'),
});
export function displayedCoordinates(kind: string, latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return {latitude:null,longitude:null};
  // Store only a ~1 km grid for people; raw personal coordinates never persist.
  return kind === 'person'
    ? { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100 }
    : {latitude,longitude};
}
