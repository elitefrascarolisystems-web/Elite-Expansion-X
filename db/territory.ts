import { database, brazilTimestamp } from '@/db/runtime';
import { canAccessCity } from '@/lib/expansion-permissions';
import { cityReference } from '@/lib/territorial-map';
import { locationSchema, personSchema, activitySchema, displayedCoordinates } from '@/lib/territory-validation';
import type { AccessView } from '@/lib/expansion-types';
import type { TerritoryRecord, TerritoryResponse } from '@/lib/territory-types';

export class TerritoryError extends Error { constructor(message: string, public status = 400) { super(message); } }
const dbRows = async (sql:string, args:(string|number|null)[] = []) => (await database().prepare(sql).bind(...args).all()).results;
const n = (v:unknown) => v === null || v === undefined ? null : Number(v);
const str = (v:unknown) => String(v ?? '');
function management(a:AccessView) { return a.active && ['Administrador','Coordenação','Líder'].includes(a.role); }
function scope(a:AccessView, alias = 'r') {
  if (a.role === 'Administrador') return {sql:'1=1',values:[] as (string|number)[]};
  if (['Coordenação','Líder'].includes(a.role) && a.cityId !== null) return {sql:`${alias}.city_id = ?`,values:[a.cityId]};
  if (a.role === 'Embaixador' && a.ambassadorId !== null) return {sql:`${alias}.kind = 'person' AND ${alias}.ambassador_id = ?`,values:[a.ambassadorId]};
  if (a.role === 'Comercial') return {sql:`${alias}.kind = 'person' AND ${alias}.lead_id IN (SELECT id FROM leads WHERE lower(assigned_to_email)=lower(?) AND consent_revoked_at IS NULL)`,values:[a.email]};
  return {sql:'1=0',values:[]};
}
const recordsSql = `WITH records AS (
 SELECT 'city:'||id AS entity_key, CAST(id AS TEXT) AS id, 'city' AS kind, id AS city_id, name, status,
 leader_name AS responsible, updated_at, '' AS next_action, '' AS due_date,
 NULL AS ambassador_id, NULL AS lead_id, NULL AS referrer_id, 'Cidade' AS roles FROM cities
 UNION ALL
 SELECT 'person:'||p.id, p.id, 'person', p.city_id, p.name,
 COALESCE((SELECT status FROM ambassadors WHERE person_id=p.id LIMIT 1),(SELECT CASE WHEN EXISTS(SELECT 1 FROM sales WHERE lead_id=l.id AND status='Pagamento confirmado' AND paid_at IS NOT NULL) THEN 'Cliente' ELSE l.status END FROM leads l WHERE l.person_id=p.id AND l.consent_revoked_at IS NULL LIMIT 1),'Cadastrado'),
 '', p.updated_at, COALESCE((SELECT name FROM territory_actions WHERE person_id=p.id AND status='Programado' ORDER BY due_date LIMIT 1),''),
 COALESCE((SELECT due_date FROM territory_actions WHERE person_id=p.id AND status='Programado' ORDER BY due_date LIMIT 1),''),
 (SELECT id FROM ambassadors WHERE person_id=p.id LIMIT 1),
 (SELECT id FROM leads WHERE person_id=p.id AND consent_revoked_at IS NULL LIMIT 1), p.referrer_id,
 'Pessoa'||CASE WHEN p.leader=1 THEN ',Líder' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id) THEN ',Embaixador' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM leads WHERE person_id=p.id AND consent_revoked_at IS NULL) THEN ',Lead' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM leads l JOIN sales s ON s.lead_id=l.id WHERE l.person_id=p.id AND l.consent_revoked_at IS NULL AND s.status='Pagamento confirmado' AND s.paid_at IS NOT NULL) THEN ',Cliente' ELSE '' END
 FROM territory_people p
 WHERE NOT EXISTS(SELECT 1 FROM leads WHERE person_id=p.id AND consent_revoked_at IS NOT NULL)
 OR p.leader=1 OR EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id)
 UNION ALL
 SELECT 'partner:'||id, CAST(id AS TEXT), 'partner',city_id,name,status,contact_name,created_at,next_action,'',NULL,NULL,NULL,'Parceiro' FROM partners
 UNION ALL
 SELECT 'event:'||id,CAST(id AS TEXT),'event',city_id,name,status,owner_name,created_at,'',event_date,NULL,NULL,NULL,'Evento' FROM events
 UNION ALL
 SELECT 'action:'||id,id,'action',city_id,name,status,responsible,updated_at,'',due_date,NULL,NULL,NULL,category FROM territory_actions
) `;
export async function getTerritory(a:AccessView, params:URLSearchParams):Promise<TerritoryResponse> {
  const s=scope(a); const conditions=[s.sql]; const args:(string|number)[]=[...s.values];
  const city=params.get('city'); if(city && /^\d+$/.test(city)) {conditions.push('r.city_id=?');args.push(Number(city));}
  const q=params.get('q')?.trim().slice(0,160); if(q) {conditions.push('(r.name LIKE ? OR c.name LIKE ? OR COALESCE(g.region,\'\') LIKE ?)');args.push(`%${q}%`,`%${q}%`,`%${q}%`);}
  const leadId=params.get('leadId');if(leadId&&/^\d+$/.test(leadId)){conditions.push('r.lead_id=?');args.push(Number(leadId));}
  const category=params.get('category'); if(category) {conditions.push('(r.kind=? OR instr(r.roles,?)>0)');args.push(category,category);}
  for(const [param,col] of [['status','r.status'],['state','c.state'],['responsible','r.responsible']] as const) {const v=params.get(param);if(v){conditions.push(`${col}=?`);args.push(v);}}
  const period=params.get('period');if(period && /^\d{4}-\d{2}$/.test(period)){conditions.push("substr(CASE WHEN r.due_date<>'' THEN r.due_date ELSE r.updated_at END,1,7)=?");args.push(period);}
  const where=conditions.join(' AND ');
  // Restricted locations are never selected; city fallback is safe.
  const join=`FROM records r JOIN cities c ON c.id=r.city_id LEFT JOIN territory_locations g ON g.entity_key=r.entity_key AND (g.visibility='Equipe' OR ?='Administrador') WHERE ${where}`;
  const offset=Math.max(0,Math.min(100000,Number(params.get('offset'))||0));
  const result=await dbRows(recordsSql+`SELECT r.*,c.name AS city_name,c.state,g.latitude,g.longitude,g.region,g.precision,g.source,g.validated,g.visibility,g.updated_at AS location_updated_at ${join} ORDER BY r.kind,r.name,r.id LIMIT 201 OFFSET ?`,[a.role,...args,offset]);
  const count=await dbRows(recordsSql+`SELECT COUNT(*) AS total ${join}`,[a.role,...args]);
  const records:TerritoryRecord[]=result.slice(0,200).map(row=>{
    const reference=cityReference(str(row.city_name),str(row.state));
    const explicit=Boolean(row.source);
    const location=explicit ? {
      latitude: row.validated ? n(row.latitude):null, longitude:row.validated?n(row.longitude):null,
      region:str(row.region),precision:str(row.precision) as 'Cidade',source:str(row.source),validated:Boolean(row.validated),visibility:str(row.visibility) as 'Equipe',updatedAt:str(row.location_updated_at),
    } : reference ? {latitude:reference.latitude,longitude:reference.longitude,region:'',precision:'Cidade' as const,source:reference.sourceLabel,validated:true,visibility:'Equipe' as const,updatedAt:''}:null;
    return {key:str(row.entity_key),id:str(row.id),kind:str(row.kind) as TerritoryRecord['kind'],cityId:Number(row.city_id),cityName:str(row.city_name),state:str(row.state),name:str(row.name),roles:str(row.roles).split(','),status:str(row.status),responsible:a.role==='Embaixador'?'':str(row.responsible),lastActivity:str(row.updated_at),nextAction:str(row.next_action),dueDate:str(row.due_date),location,ambassadorId:n(row.ambassador_id),leadId:a.role==='Embaixador'?null:n(row.lead_id),referrerId:a.role==='Embaixador'?null:row.referrer_id?str(row.referrer_id):null};
  });
  return {records,total:Number(count[0]?.total??0),hasMore:result.length>200,nextOffset:result.length>200?offset+200:null,updatedAt:brazilTimestamp(),canEdit:management(a)};
}
async function allowedCity(a:AccessView,cityId:number) {
  if(!management(a)||!canAccessCity(a,cityId)) throw new TerritoryError('Registro fora do seu acesso.',403);
  if(!(await dbRows('SELECT id FROM cities WHERE id=?',[cityId]))[0]) throw new TerritoryError('Cidade não encontrada.',404);
}
async function entity(a:AccessView,key:string) {
  const s=scope(a);const rows=await dbRows(recordsSql+`SELECT r.* FROM records r WHERE r.entity_key=? AND ${s.sql}`,[key,...s.values]);
  if(!rows[0]) throw new TerritoryError('Registro fora do seu acesso.',403);return rows[0];
}
function auditStatement(a:AccessView,action:string,key:string) {
  return database().prepare('INSERT INTO audit_logs(actor_email,action,entity_type,summary,created_at) VALUES(?,?,?,?,?)').bind(a.email,action,'territory',`Registro territorial ${key}.`,brazilTimestamp());
}
export async function mutateTerritory(a:AccessView,action:string,input:unknown) {
  if(!management(a)) throw new TerritoryError('Seu perfil não pode alterar o território.',403);
  const db=database(),now=brazilTimestamp();
  if(action==='location') {
    const v=locationSchema.parse(input);const row=await entity(a,v.key);await allowedCity(a,Number(row.city_id));
    if(v.visibility==='Admin' && a.role!=='Administrador') throw new TerritoryError('Somente o administrador altera a visibilidade restrita.',403);
    const previous=await dbRows('SELECT visibility FROM territory_locations WHERE entity_key=?',[v.key]);
    if(previous[0]?.visibility==='Admin' && a.role!=='Administrador') throw new TerritoryError('Localização restrita.',403);
    const coords=displayedCoordinates(str(row.kind),v.latitude,v.longitude);
    await db.batch([db.prepare(`INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(entity_key) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,region=excluded.region,precision=excluded.precision,source=excluded.source,validated=excluded.validated,visibility=excluded.visibility,authorized_by=excluded.authorized_by,authorized_at=excluded.authorized_at,updated_at=excluded.updated_at`).bind(v.key,row.city_id,coords.latitude,coords.longitude,v.region,v.precision,v.source,Number(v.validated),v.visibility,a.email,now,now),auditStatement(a,'update_location',v.key)]);return;
  }
  if(action==='person') {
    const v=personSchema.parse(input);await allowedCity(a,v.cityId);const id=v.id??v.requestId??crypto.randomUUID();
    if(!v.id&&v.requestId){const existing=await dbRows('SELECT created_by,city_id FROM '+'territory_people'+' WHERE id=?',[id]);if(existing[0]){if(existing[0].created_by!==a.email||Number(existing[0].city_id)!==v.cityId)throw new TerritoryError('Identificador já utilizado.',409);return {id};}}
    if(v.id){const old=await entity(a,`person:${id}`);if(Number(old.city_id)!==v.cityId) throw new TerritoryError('A mudança de cidade exige revisão dos vínculos existentes.');}
    if(v.referrerId){const ref=await entity(a,`person:${v.referrerId}`);if(Number(ref.city_id)!==v.cityId) throw new TerritoryError('A indicação deve pertencer à cidade autorizada.');
      const seen=new Set([id]);let current:string|null=v.referrerId;
      while(current){if(seen.has(current)) throw new TerritoryError('A indicação criaria um ciclo.');seen.add(current);const p=await dbRows('SELECT referrer_id FROM territory_people WHERE id=?',[current]);current=p[0]?.referrer_id?str(p[0].referrer_id):null;}}
    const previousLeader=v.id?(await dbRows('SELECT name,leader FROM territory_people WHERE id=?',[id]))[0]:null;
    const statements=[db.prepare(`INSERT INTO territory_people(id,city_id,name,leader,referrer_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,leader=excluded.leader,referrer_id=excluded.referrer_id,updated_at=excluded.updated_at`).bind(id,v.cityId,v.name,Number(v.leader),v.referrerId,a.email,now,now)];
    statements.push(db.prepare('UPDATE ambassadors SET name=?,updated_at=? WHERE person_id=?').bind(v.name,now,id),db.prepare('UPDATE leads SET name=?,updated_at=? WHERE person_id=?').bind(v.name,now,id));
    if(previousLeader?.leader&&!v.leader) statements.push(db.prepare("UPDATE cities SET leader_name='',updated_at=? WHERE id=? AND leader_name=?").bind(now,v.cityId,String(previousLeader.name)));
    if(v.leader) statements.push(db.prepare('UPDATE territory_people SET leader=0 WHERE city_id=? AND id<>?').bind(v.cityId,id),db.prepare('UPDATE cities SET leader_name=?,updated_at=? WHERE id=?').bind(v.name,now,v.cityId));
    statements.push(auditStatement(a,'save_person',id));await db.batch(statements);return {id};
  }
  if(action==='activity') {
    const v=activitySchema.parse(input);await allowedCity(a,v.cityId);const id=v.id??v.requestId??crypto.randomUUID();
    if(!v.id&&v.requestId){const existing=await dbRows('SELECT created_by,city_id FROM '+'territory_actions'+' WHERE id=?',[id]);if(existing[0]){if(existing[0].created_by!==a.email||Number(existing[0].city_id)!==v.cityId)throw new TerritoryError('Identificador já utilizado.',409);return {id};}}
    if(v.id){const old=await entity(a,`action:${id}`);if(Number(old.city_id)!==v.cityId) throw new TerritoryError('Mantenha a cidade original da ação.');}
    if(v.personId){const p=await entity(a,`person:${v.personId}`);if(Number(p.city_id)!==v.cityId) throw new TerritoryError('Pessoa fora da cidade selecionada.');}
    await db.batch([db.prepare(`INSERT INTO territory_actions(id,city_id,person_id,name,category,status,responsible,due_date,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,status=excluded.status,responsible=excluded.responsible,due_date=excluded.due_date,updated_at=excluded.updated_at`).bind(id,v.cityId,v.personId,v.name,v.category,v.status,v.responsible,v.dueDate,a.email,now,now),auditStatement(a,'save_activity',id)]);return {id};
  }
  if(action==='event_status') {
    const v=input as {id?:unknown;status?:unknown};if(!['Planejado','Confirmado','Realizado','Cancelado'].includes(String(v.status))||!Number.isInteger(v.id)) throw new TerritoryError('Evento ou situação inválida.');
    await entity(a,`event:${v.id}`);await db.batch([db.prepare('UPDATE events SET status=? WHERE id=?').bind(v.status,v.id),auditStatement(a,'update_event',String(v.id))]);return;
  }
  throw new TerritoryError('Ação não disponível.');
}
