import {rowDue,type Followup} from '@/lib/followup';
import { database, brazilTimestamp } from '@/db/runtime';
import { canAccessCity } from '@/lib/expansion-permissions';
import { cityReference } from '@/lib/territorial-map';
import { locationSchema, personSchema, activitySchema, roleSchema, displayedCoordinates } from '@/lib/territory-validation';
import type { AccessView } from '@/lib/expansion-types';
import type { TerritoryRecord, TerritoryResponse } from '@/lib/territory-types';

export class TerritoryError extends Error { constructor(message: string, public status = 400) { super(message); } }
const dbRows = async (sql:string, args:(string|number|null)[] = []) => (await database().prepare(sql).bind(...args).all()).results;
const n = (v:unknown) => v === null || v === undefined ? null : Number(v);
const str = (v:unknown) => String(v ?? '');
function management(a:AccessView) { return a.active && ['Administrador','Coordenação','Líder'].includes(a.role); }
function localScope(a:AccessView, alias = 'r') {
  if (!a.active) return {sql:'1=0',values:[] as (string|number)[]};
  if (a.role === 'Administrador') return {sql:'1=1',values:[] as (string|number)[]};
  if (['Coordenação','Líder'].includes(a.role) && a.cityId !== null) return {sql:`${alias}.city_id = ?`,values:[a.cityId]};
  if (a.role === 'Embaixador' && a.ambassadorId !== null) return {sql:`${alias}.kind = 'person' AND ${alias}.ambassador_id = ?`,values:[a.ambassadorId]};
  if (a.role === 'Comercial') return {sql:`((${alias}.kind = 'person' AND ${alias}.lead_id IN (SELECT id FROM leads WHERE lower(assigned_to_email)=lower(?) AND consent_revoked_at IS NULL)) OR (${alias}.kind='business' AND ${alias}.id IN (SELECT id FROM businesses WHERE lower(owner_email)=lower(?))))`,values:[a.email,a.email]};
  return {sql:'1=0',values:[]};
}
function scope(a:AccessView,alias='r') {const local=localScope(a,alias);return {sql:`(${local.sql}) AND ${alias}.city_id IN (SELECT id FROM cities WHERE organization_id=?)`,values:[...local.values,a.organizationId]};}
// O D1 aceita no máximo 5 SELECTs num mesmo UNION; por isso dois blocos de 3.
const recordsSql = `WITH records_base AS (
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
 'Pessoa'||CASE WHEN p.leader=1 THEN ',Líder' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id) THEN ',Embaixador' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM leads WHERE person_id=p.id AND consent_revoked_at IS NULL) THEN ',Lead' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM leads l JOIN sales s ON s.lead_id=l.id WHERE l.person_id=p.id AND l.consent_revoked_at IS NULL AND s.status='Pagamento confirmado' AND s.paid_at IS NOT NULL) THEN ',Cliente' ELSE '' END||COALESCE((SELECT ','||group_concat(role,',') FROM territory_roles WHERE person_id=p.id),'')
 FROM territory_people p
 WHERE NOT EXISTS(SELECT 1 FROM leads WHERE person_id=p.id AND consent_revoked_at IS NOT NULL)
 OR p.leader=1 OR EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id) OR EXISTS(SELECT 1 FROM territory_roles WHERE person_id=p.id AND status NOT IN ('Desligado','Inativo'))
 UNION ALL
 SELECT 'partner:'||id, CAST(id AS TEXT), 'partner',city_id,name,status,contact_name,created_at,next_action,'',NULL,NULL,NULL,'Parceiro' FROM partners WHERE NOT EXISTS(SELECT 1 FROM businesses b WHERE b.partner_id=partners.id)
), records_rest AS (
 SELECT 'business:'||b.id,b.id,'business',b.city_id,b.name,CASE WHEN EXISTS(SELECT 1 FROM opportunities o JOIN sales s ON s.lead_id=o.lead_id WHERE o.business_id=b.id AND s.status='Pagamento confirmado' AND s.paid_at IS NOT NULL) THEN 'Cliente' WHEN EXISTS(SELECT 1 FROM opportunities o JOIN leads l ON l.id=o.lead_id WHERE o.business_id=b.id AND l.consent_revoked_at IS NULL AND l.status<>'Cancelado') THEN 'Contato autorizado' WHEN b.status IN ('Cliente','Contato autorizado') THEN 'Selecionada' ELSE b.status END,'',b.updated_at,b.next_action,'',NULL,NULL,NULL,'Empresa'||CASE WHEN b.partner_id IS NOT NULL THEN ',Parceiro' ELSE '' END FROM businesses b
 UNION ALL
 SELECT 'event:'||id,CAST(id AS TEXT),'event',city_id,name,status,owner_name,created_at,'',event_date,NULL,NULL,NULL,'Evento' FROM events
 UNION ALL
 SELECT 'action:'||id,id,'action',city_id,name,status,responsible,updated_at,'',due_date,NULL,NULL,NULL,category FROM territory_actions
), records AS (SELECT * FROM records_base UNION ALL SELECT * FROM records_rest
) `;

function coordinateSql(axis:'latitude'|'longitude') {
 const refs=[['Esmeraldas',-19.7628,-44.3131],['Belo Horizonte',-19.9167,-43.9345],['Contagem',-19.9317,-44.0536],['Betim',-19.9678,-44.1983]];
 return `CASE WHEN g.source IS NOT NULL THEN CASE WHEN g.validated=1 THEN g.${axis} ELSE NULL END ELSE CASE ${refs.map(r=>`WHEN lower(c.name)=lower('${r[0]}') AND upper(c.state)='MG' THEN ${r[axis==='latitude'?1:2]}`).join(' ')} ELSE NULL END END`;
}
function bounds(value:string|null) {if(!value)return null;const b=value.split(',').map(Number);if(b.length!==4||!b.every(Number.isFinite)||b[0]<-180||b[2]>180||b[1]<-85||b[3]>85||b[0]>b[2]||b[1]>b[3])throw new TerritoryError('Área geográfica inválida.');return b;}
export async function getTerritory(a:AccessView, params:URLSearchParams):Promise<TerritoryResponse> {
  const s=scope(a); const conditions=[s.sql]; const args:(string|number)[]=[...s.values];
  const city=params.get('city'); if(city && /^\d+$/.test(city)) {conditions.push('r.city_id=?');args.push(Number(city));}
  const key=params.get('key');if(key){conditions.push('r.entity_key=?');args.push(key);}
  if(params.get('referrals')==='1')conditions.push("r.kind='person' AND r.referrer_id IS NOT NULL");
  const referrer=params.get('referrer');if(referrer){conditions.push('r.referrer_id=?');args.push(referrer);}
  const q=params.get('q')?.trim().slice(0,160); if(q) {conditions.push('(r.name LIKE ? OR c.name LIKE ? OR COALESCE(g.region,\'\') LIKE ?)');args.push(`%${q}%`,`%${q}%`,`%${q}%`);}
  const leadId=params.get('leadId');if(leadId&&/^\d+$/.test(leadId)){conditions.push('r.lead_id=?');args.push(Number(leadId));}
  const category=params.get('category'); if(category) {conditions.push("(r.kind=? OR instr(','||r.roles||',',?)>0)");args.push(category,','+category+',');}
  const layers=params.get('layers');if(layers!==null){const selected=layers.split('|').filter(Boolean);const allowed=['city','person','partner','business','event','action','Líder','Embaixador','Mentor','Mentorado','Equipe','Parceiro','Vendedor','Lead','Cliente'];if(selected.some(v=>!allowed.includes(v))||selected.length>allowed.length)throw new TerritoryError('Camada inválida.');if(!selected.length)conditions.push('1=0');else{conditions.push('('+selected.map(()=>"(r.kind=? OR instr(','||r.roles||',',?)>0)").join(' OR ')+')');for(const v of selected)args.push(v,','+v+',');}}
  const level=params.get('level');if(level){conditions.push("r.kind='person' AND EXISTS(SELECT 1 FROM ambassadors ab WHERE ab.person_id=r.id AND ab.level=?)");args.push(level);}
  const source=params.get('source')?.trim();if(source){conditions.push("r.kind='person' AND EXISTS(SELECT 1 FROM territory_roles tr WHERE tr.person_id=r.id AND tr.source LIKE ?)");args.push('%'+source.slice(0,200)+'%');}

  for(const [param,col] of [['status','r.status'],['state','c.state'],['responsible','r.responsible']] as const) {const v=params.get(param);if(v){if(param==='status'&&['Mentor','Mentorado','Equipe','Parceiro','Vendedor'].includes(category??'')){conditions.push("((r.kind<>'person' AND r.status=?) OR EXISTS(SELECT 1 FROM territory_roles tr WHERE r.kind='person' AND tr.person_id=r.id AND tr.role=? AND tr.status=?))");args.push(v,category!,v);}else if(param==='status'){conditions.push(`(${col}=? OR EXISTS(SELECT 1 FROM territory_roles tr WHERE r.kind='person' AND tr.person_id=r.id AND tr.status=?))`);args.push(v,v);}else if(param==='responsible'){conditions.push(`(${col}=? OR EXISTS(SELECT 1 FROM territory_roles tr WHERE r.kind='person' AND tr.person_id=r.id AND tr.responsible=?))`);args.push(v,v);}else{conditions.push(`${col}=?`);args.push(v);}}}
  const training=params.get('training');if(training==='complete'||training==='pending'){conditions.push(`r.kind='person' AND EXISTS(SELECT 1 FROM ambassadors ab WHERE ab.person_id=r.id AND ab.training_progress ${training==='complete'?'>=100':'<100'})`);}
  const activity=params.get('activity');if(activity==='pending'||activity==='overdue'){conditions.push("((r.kind='action' AND r.status='Programado') OR (r.kind='person' AND r.next_action<>''))");if(activity==='overdue'){conditions.push('r.due_date<?');args.push(brazilTimestamp().slice(0,10));}}
  const period=params.get('period');if(period && /^\d{4}-\d{2}$/.test(period)){conditions.push("substr(CASE WHEN r.due_date<>'' THEN r.due_date ELSE r.updated_at END,1,7)=?");args.push(period);}
  const area=bounds(params.get('area'));if(area){conditions.push(`(${coordinateSql('longitude')}) BETWEEN ? AND ? AND (${coordinateSql('latitude')}) BETWEEN ? AND ?`);args.push(area[0],area[2],area[1],area[3]);}
  if(params.get('location')==='pending')conditions.push(`(${coordinateSql('latitude')}) IS NULL`);
  if(params.get('location')==='validated')conditions.push(`(${coordinateSql('latitude')}) IS NOT NULL`);
  const where=conditions.join(' AND ');
  // Restricted locations are never selected; city fallback is safe.
  const join=`FROM records r JOIN cities c ON c.id=r.city_id LEFT JOIN territory_locations g ON g.entity_key=CASE WHEN r.kind='person' THEN 'city:'||r.city_id ELSE r.entity_key END AND (r.kind<>'person' OR g.precision='Cidade') AND (g.visibility='Equipe' OR ?='Administrador') WHERE ${where}`;
  const offset=Math.max(0,Math.min(100000,Number(params.get('offset'))||0));
  const result=await dbRows(recordsSql+`SELECT r.*,CASE WHEN r.kind='person' THEN (SELECT MAX(activity_at) FROM (SELECT updated_at AS activity_at FROM territory_actions WHERE person_id=r.id AND status='Realizado' UNION ALL SELECT u.created_at FROM ambassador_updates u JOIN ambassadors a ON a.id=u.ambassador_id WHERE a.person_id=r.id UNION ALL SELECT t.completed_at FROM tasks t JOIN ambassadors a ON a.id=t.ambassador_id WHERE a.person_id=r.id AND t.status='Concluída')) ELSE r.updated_at END AS activity_date,(SELECT json_group_array(json_object('role',role,'status',status,'responsible',responsible,'source',source)) FROM territory_roles WHERE r.kind='person' AND person_id=r.id) AS role_details,(SELECT name FROM territory_people WHERE id=r.referrer_id AND city_id=r.city_id) AS referrer_name,c.name AS city_name,c.state,g.latitude,g.longitude,g.region,g.precision,g.source,g.validated,g.visibility,g.updated_at AS location_updated_at ${join} ORDER BY r.kind,r.name,r.id LIMIT 201 OFFSET ?`,[a.role,...args,offset]);
  const count=await dbRows(recordsSql+`SELECT COUNT(*) AS total,SUM(r.kind='person') AS people,SUM((${coordinateSql('latitude')}) IS NULL) AS pending,SUM(instr(','||r.roles||',',',Mentor,')>0) AS mentors,SUM(instr(','||r.roles||',',',Mentorado,')>0) AS members,SUM(instr(','||r.roles||',',',Embaixador,')>0) AS ambassadors,SUM(instr(','||r.roles||',',',Líder,')>0) AS leaders ${join}`,[a.role,...args]);
  const viewport=bounds(params.get('viewport'));const vp=viewport?'WHERE longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ?':'WHERE latitude IS NOT NULL AND longitude IS NOT NULL';
  const vpArgs=viewport?[viewport[0],viewport[2],viewport[1],viewport[3]]:[];
  const located=recordsSql+`, located AS (SELECT r.entity_key,r.kind,r.roles,r.status,${coordinateSql('latitude')} AS latitude,${coordinateSql('longitude')} AS longitude ${join}) `;
  const points=await dbRows(located+`SELECT latitude,longitude,COUNT(*) AS count,SUM(kind='person') AS people,MIN(entity_key) AS entity_key,MIN(kind) AS kind,MIN(roles) AS roles,MIN(status) AS status FROM located ${vp} GROUP BY latitude,longitude ORDER BY latitude,longitude LIMIT 1001`,[a.role,...args,...vpArgs]);
  const inView=await dbRows(located+`SELECT COUNT(*) AS total FROM located ${vp}`,[a.role,...args,...vpArgs]);
  const records:TerritoryRecord[]=result.slice(0,200).map(row=>{
    const reference=cityReference(str(row.city_name),str(row.state));
    const explicit=Boolean(row.source);
    const location=explicit ? {
      latitude: row.validated ? n(row.latitude):null, longitude:row.validated?n(row.longitude):null,
      region:str(row.region),precision:str(row.precision) as 'Cidade',source:str(row.source),validated:Boolean(row.validated),visibility:str(row.visibility) as 'Equipe',updatedAt:str(row.location_updated_at),
    } : reference ? {latitude:reference.latitude,longitude:reference.longitude,region:'',precision:'Cidade' as const,source:reference.sourceLabel,validated:true,visibility:'Equipe' as const,updatedAt:''}:null;
    return {key:str(row.entity_key),id:str(row.id),kind:str(row.kind) as TerritoryRecord['kind'],cityId:Number(row.city_id),cityName:str(row.city_name),state:str(row.state),name:str(row.name),roles:str(row.roles).split(','),status:(['Mentor','Mentorado','Equipe','Parceiro','Vendedor'].includes(category??'')?JSON.parse(str(row.role_details)||'[]').find((v:{role:string;status:string})=>v.role===category)?.status:null)??str(row.status),responsible:a.role==='Embaixador'?'':str(row.responsible),lastActivity:str(row.activity_date),roleDetails:JSON.parse(str(row.role_details)||'[]'),nextAction:str(row.next_action),dueDate:str(row.due_date),location,ambassadorId:n(row.ambassador_id),leadId:a.role==='Embaixador'?null:n(row.lead_id),referrerName:['Administrador','Coordenação','Líder'].includes(a.role)?str(row.referrer_name):'',referrerId:a.role==='Embaixador'?null:row.referrer_id?str(row.referrer_id):null};
  });
  // Both views read the same commercial next step; no duplicate territorial task is created.
  const personIds=records.filter(r=>r.kind==='person').map(r=>r.id);
  if(personIds.length&&a.role!=='Embaixador'){
    // O D1 aceita no máximo 100 parâmetros por consulta; a página tem até 201 pessoas.
    const commercial:Record<string,unknown>[]=[];
    for(let i=0;i<personIds.length;i+=80){const batch=personIds.slice(i,i+80);commercial.push(...await dbRows(`SELECT o.*,l.person_id,s.status AS payment_status,s.paid_at FROM opportunities o JOIN leads l ON l.id=o.lead_id LEFT JOIN sales s ON s.lead_id=l.id WHERE o.organization_id=? AND l.consent_revoked_at IS NULL AND l.status<>'Cancelado' AND l.person_id IN (${batch.map(()=>'?').join(',')}) AND (?<>'Comercial' OR (lower(o.owner_email)=lower(?) AND lower(l.assigned_to_email)=lower(?)))`,[a.organizationId,...batch,a.role,a.email,a.email]));}
    for(const o of commercial){const record=records.find(r=>r.id===o.person_id&&r.kind==='person');if(!record)continue;const due=rowDue({followup:JSON.parse(str(o.followup_json)||'{}') as Followup,due_date:str(o.due_date),stage:str(o.stage),payment_status:o.payment_status?str(o.payment_status):null,paid_at:o.paid_at?str(o.paid_at):null});if(due&&(!record.dueDate||Date.parse(due)<Date.parse(record.dueDate+'T23:59:59-03:00'))){record.nextAction=str(o.next_action);record.dueDate=due;record.responsible=str(o.owner_email);}}
  }
  return {roleCounts:{Mentor:Number(count[0]?.mentors??0),Mentorado:Number(count[0]?.members??0),Embaixador:Number(count[0]?.ambassadors??0),Líder:Number(count[0]?.leaders??0)},points:points.slice(0,1000).map(p=>({latitude:Number(p.latitude),longitude:Number(p.longitude),count:Number(p.count),people:Number(p.people),key:str(p.entity_key),kind:str(p.kind) as TerritoryRecord['kind'],roles:str(p.roles).split(','),status:str(p.status)})),pointsCapped:points.length>1000,inView:Number(inView[0]?.total??0),people:Number(count[0]?.people??0),pending:Number(count[0]?.pending??0),records,total:Number(count[0]?.total??0),hasMore:result.length>200,nextOffset:result.length>200?offset+200:null,updatedAt:brazilTimestamp(),canEdit:management(a)};
}
async function allowedCity(a:AccessView,cityId:number) {
  if(!management(a)||!canAccessCity(a,cityId)) throw new TerritoryError('Registro fora do seu acesso.',403);
  if(!(await dbRows('SELECT id FROM cities WHERE id=? AND organization_id=?',[cityId,a.organizationId]))[0]) throw new TerritoryError('Cidade não encontrada.',404);
}
async function entity(a:AccessView,key:string) {
  const s=scope(a);const rows=await dbRows(recordsSql+`SELECT r.* FROM records r WHERE r.entity_key=? AND ${s.sql}`,[key,...s.values]);
  if(!rows[0]) throw new TerritoryError('Registro fora do seu acesso.',403);return rows[0];
}
function auditStatement(a:AccessView,action:string,key:string) {
  return database().prepare('INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) VALUES(?,?,?,?,?,?)').bind(a.organizationId,a.email,action,'territory',`Registro territorial ${key}.`,brazilTimestamp());
}
export async function mutateTerritory(a:AccessView,action:string,input:unknown) {
  if(!management(a)) throw new TerritoryError('Seu perfil não pode alterar o território.',403);
  const db=database(),now=brazilTimestamp();
  if(action==='location') {
    const v=locationSchema.parse(input);if(v.key.startsWith('person:'))throw new TerritoryError('Pessoas usam somente o centro da cidade. Valide a referência da cidade.');const row=await entity(a,v.key);await allowedCity(a,Number(row.city_id));
    if(v.visibility==='Admin' && a.role!=='Administrador') throw new TerritoryError('Somente o administrador altera a visibilidade restrita.',403);
    const previous=await dbRows('SELECT visibility FROM territory_locations WHERE entity_key=?',[v.key]);
    if(previous[0]?.visibility==='Admin' && a.role!=='Administrador') throw new TerritoryError('Localização restrita.',403);
    const coords=displayedCoordinates(str(row.kind),v.latitude,v.longitude);
    await db.batch([db.prepare(`INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(entity_key) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,region=excluded.region,precision=excluded.precision,source=excluded.source,validated=excluded.validated,visibility=excluded.visibility,authorized_by=excluded.authorized_by,authorized_at=excluded.authorized_at,updated_at=excluded.updated_at`).bind(v.key,row.city_id,coords.latitude,coords.longitude,v.region,v.precision,v.source,Number(v.validated),v.visibility,a.email,now,now),auditStatement(a,'update_location',v.key)]);return;
  }
  if(action==='role') {
    const v=roleSchema.parse(input),p=await entity(a,`person:${v.personId}`);await allowedCity(a,Number(p.city_id));
    await db.batch([db.prepare(`INSERT INTO territory_roles(id,person_id,city_id,role,status,responsible,source,authorized_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(person_id,city_id,role) DO UPDATE SET status=excluded.status,responsible=excluded.responsible,source=excluded.source,authorized_by=excluded.authorized_by,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),v.personId,p.city_id,v.role,v.status,v.responsible,v.source,a.email,now,now),auditStatement(a,'save_role',v.personId)]);return;
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
