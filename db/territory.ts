import {nameKey,PERSON_ROLES,PLACE_LINKS,PLACE_TYPES,personRoleFromText,placeLinkFromText,SECTORS} from '@/lib/places';
import { ZodError } from 'zod';
import {rowDue,type Followup} from '@/lib/followup';
import { database, brazilTimestamp } from '@/db/runtime';
import { featureBlocked } from '@/db/plan';
import { canAccessCity } from '@/lib/expansion-permissions';
import { cityReference } from '@/lib/territorial-map';
import { locationSchema, personSchema, activitySchema, roleSchema, displayedCoordinates, importPersonSchema } from '@/lib/territory-validation';
import type { AccessView } from '@/lib/expansion-types';
import type { TerritoryRecord, TerritoryResponse } from '@/lib/territory-types';

export class TerritoryError extends Error { constructor(message: string, public status = 400, public duplicate = false) { super(message); } }
const dbRows = async (sql:string, args:(string|number|null)[] = []) => (await database().prepare(sql).bind(...args).all()).results;
const n = (v:unknown) => v === null || v === undefined ? null : Number(v);
const str = (v:unknown) => String(v ?? '');
function management(a:AccessView) { return a.active && ['Administrador','Coordenação','Líder'].includes(a.role); }
/** Quem mapeia: a gestão e o Comercial (Executivo de Vendas), que cadastra pessoas e valida os próprios locais. */
function mapper(a:AccessView) { return management(a) || (a.active && a.role==='Comercial'); }
function localScope(a:AccessView, alias = 'r') {
  if (!a.active) return {sql:'1=0',values:[] as (string|number)[]};
  if (a.role === 'Administrador') return {sql:'1=1',values:[] as (string|number)[]};
  if (['Coordenação','Líder'].includes(a.role) && a.cityId !== null) return {sql:`${alias}.city_id = ?`,values:[a.cityId]};
  if (a.role === 'Embaixador' && a.ambassadorId !== null) return {sql:`${alias}.kind = 'person' AND ${alias}.ambassador_id = ?`,values:[a.ambassadorId]};
  if (a.role === 'Comercial') return {sql:`((${alias}.kind = 'person' AND (${alias}.lead_id IN (SELECT id FROM leads WHERE lower(assigned_to_email)=lower(?) AND consent_revoked_at IS NULL) OR ${alias}.id IN (SELECT id FROM territory_people WHERE lower(created_by)=lower(?)))) OR (${alias}.kind='business' AND ${alias}.id IN (SELECT id FROM businesses WHERE lower(owner_email)=lower(?))) OR (${alias}.kind='action' AND ${alias}.id IN (SELECT id FROM territory_actions WHERE lower(created_by)=lower(?))))`,values:[a.email,a.email,a.email,a.email]};
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
 'Pessoa'||CASE WHEN p.leader=1 THEN ',Líder' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id) THEN ',Embaixador' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM leads WHERE person_id=p.id AND consent_revoked_at IS NULL) THEN ',Lead' ELSE '' END||CASE WHEN EXISTS(SELECT 1 FROM leads l JOIN sales s ON s.lead_id=l.id WHERE l.person_id=p.id AND l.consent_revoked_at IS NULL AND s.status='Pagamento confirmado' AND s.paid_at IS NOT NULL) THEN ',Cliente' ELSE '' END||COALESCE((SELECT ','||group_concat(role,',') FROM territory_roles WHERE person_id=p.id),'')||CASE WHEN p.place_link='Mentorado' AND NOT EXISTS(SELECT 1 FROM territory_roles WHERE person_id=p.id AND role='Mentorado') THEN ',Mentorado' WHEN p.place_link='Membro do network' AND NOT EXISTS(SELECT 1 FROM territory_roles WHERE person_id=p.id AND role='Network') THEN ',Network' ELSE '' END
 FROM territory_people p
 WHERE NOT EXISTS(SELECT 1 FROM leads WHERE person_id=p.id AND consent_revoked_at IS NOT NULL)
 OR p.leader=1 OR EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id) OR EXISTS(SELECT 1 FROM territory_roles WHERE person_id=p.id AND status NOT IN ('Desligado','Inativo'))
 UNION ALL
 SELECT 'partner:'||id, CAST(id AS TEXT), 'partner',city_id,name,status,contact_name,created_at,next_action,'',NULL,NULL,NULL,'Parceiro' FROM partners WHERE NOT EXISTS(SELECT 1 FROM businesses b WHERE b.partner_id=partners.id)
), records_rest AS (
 SELECT 'business:'||b.id,b.id,'business',b.city_id,b.name,CASE WHEN EXISTS(SELECT 1 FROM opportunities o JOIN sales s ON s.lead_id=o.lead_id WHERE o.business_id=b.id AND s.status='Pagamento confirmado' AND s.paid_at IS NOT NULL) THEN 'Cliente' WHEN EXISTS(SELECT 1 FROM opportunities o JOIN leads l ON l.id=o.lead_id WHERE o.business_id=b.id AND l.consent_revoked_at IS NULL AND l.status<>'Cancelado') THEN 'Contato autorizado' WHEN b.status IN ('Cliente','Contato autorizado') THEN 'Selecionada' ELSE b.status END,'',b.updated_at,b.next_action,'',NULL,NULL,NULL,COALESCE(NULLIF(b.place_type,''),'Empresa')||CASE WHEN b.sector<>'' THEN ','||b.sector ELSE '' END||CASE WHEN b.partner_id IS NOT NULL THEN ',Parceiro' ELSE '' END FROM businesses b
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
  const layers=params.get('layers');if(layers!==null){const selected=layers.split('|').filter(Boolean);const allowed=['city','person','partner','business','event','action','Líder','Embaixador','Lead','Cliente',...PERSON_ROLES,...PLACE_TYPES,...SECTORS];if(selected.some(v=>!allowed.includes(v))||selected.length>allowed.length)throw new TerritoryError('Camada inválida.');if(!selected.length)conditions.push('1=0');else{conditions.push('('+selected.map(()=>"(r.kind=? OR instr(','||r.roles||',',?)>0)").join(' OR ')+')');for(const v of selected)args.push(v,','+v+',');}}
  const level=params.get('level');if(level){conditions.push("r.kind='person' AND EXISTS(SELECT 1 FROM ambassadors ab WHERE ab.person_id=r.id AND ab.level=?)");args.push(level);}
  const source=params.get('source')?.trim();if(source){conditions.push("r.kind='person' AND EXISTS(SELECT 1 FROM territory_roles tr WHERE tr.person_id=r.id AND tr.source LIKE ?)");args.push('%'+source.slice(0,200)+'%');}

  for(const [param,col] of [['status','r.status'],['state','c.state'],['responsible','r.responsible']] as const) {const v=params.get(param);if(v){if(param==='status'&&(PERSON_ROLES as readonly string[]).includes(category??'')){conditions.push("((r.kind<>'person' AND r.status=?) OR EXISTS(SELECT 1 FROM territory_roles tr WHERE r.kind='person' AND tr.person_id=r.id AND tr.role=? AND tr.status=?))");args.push(v,category!,v);}else if(param==='status'){conditions.push(`(${col}=? OR EXISTS(SELECT 1 FROM territory_roles tr WHERE r.kind='person' AND tr.person_id=r.id AND tr.status=?))`);args.push(v,v);}else if(param==='responsible'){conditions.push(`(${col}=? OR EXISTS(SELECT 1 FROM territory_roles tr WHERE r.kind='person' AND tr.person_id=r.id AND tr.responsible=?))`);args.push(v,v);}else{conditions.push(`${col}=?`);args.push(v);}}}
  const training=params.get('training');if(training==='complete'||training==='pending'){conditions.push(`r.kind='person' AND EXISTS(SELECT 1 FROM ambassadors ab WHERE ab.person_id=r.id AND ab.training_progress ${training==='complete'?'>=100':'<100'})`);}
  const activity=params.get('activity');if(activity==='pending'||activity==='overdue'){conditions.push("((r.kind='action' AND r.status='Programado') OR (r.kind='person' AND r.next_action<>''))");if(activity==='overdue'){conditions.push('r.due_date<?');args.push(brazilTimestamp().slice(0,10));}}
  const period=params.get('period');if(period && /^\d{4}-\d{2}$/.test(period)){conditions.push("substr(CASE WHEN r.due_date<>'' THEN r.due_date ELSE r.updated_at END,1,7)=?");args.push(period);}
  const area=bounds(params.get('area'));if(area){conditions.push(`(${coordinateSql('longitude')}) BETWEEN ? AND ? AND (${coordinateSql('latitude')}) BETWEEN ? AND ?`);args.push(area[0],area[2],area[1],area[3]);}
  if(params.get('location')==='pending')conditions.push(`(${coordinateSql('latitude')}) IS NULL`);
  if(params.get('location')==='validated')conditions.push(`(${coordinateSql('latitude')}) IS NOT NULL`);
  const where=conditions.join(' AND ');
  // Restricted locations are never selected; city fallback is safe.
  const join=`FROM records r JOIN cities c ON c.id=r.city_id LEFT JOIN territory_locations g ON g.entity_key=CASE WHEN r.kind='person' THEN COALESCE((SELECT 'business:'||tp.place_id FROM territory_people tp JOIN territory_locations pl ON pl.entity_key='business:'||tp.place_id AND pl.validated=1 AND pl.latitude IS NOT NULL WHERE tp.id=r.id),'city:'||r.city_id) ELSE r.entity_key END AND (r.kind<>'person' OR g.precision IN ('Cidade','Local comercial')) AND (g.visibility='Equipe' OR ?='Administrador') WHERE ${where}`;
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
  // Local vinculado de cada pessoa (para a ficha e para editar), em lotes pelo limite do D1.
  for(let i=0;i<personIds.length;i+=80){const batch=personIds.slice(i,i+80);for(const p of await dbRows(`SELECT tp.id,tp.place_id,tp.place_link,b.name AS place_name,b.place_type FROM territory_people tp JOIN businesses b ON b.id=tp.place_id AND b.organization_id=? WHERE tp.id IN (${batch.map(()=>'?').join(',')})`,[a.organizationId,...batch])){const record=records.find(r=>r.kind==='person'&&r.id===str(p.id));if(record)record.place={id:str(p.place_id),name:str(p.place_name),type:str(p.place_type),link:str(p.place_link)};}}
  return {roleCounts:{Mentor:Number(count[0]?.mentors??0),Mentorado:Number(count[0]?.members??0),Embaixador:Number(count[0]?.ambassadors??0),Líder:Number(count[0]?.leaders??0)},points:points.slice(0,1000).map(p=>({latitude:Number(p.latitude),longitude:Number(p.longitude),count:Number(p.count),people:Number(p.people),key:str(p.entity_key),kind:str(p.kind) as TerritoryRecord['kind'],roles:str(p.roles).split(','),status:str(p.status)})),pointsCapped:points.length>1000,inView:Number(inView[0]?.total??0),people:Number(count[0]?.people??0),pending:Number(count[0]?.pending??0),records,total:Number(count[0]?.total??0),hasMore:result.length>200,nextOffset:result.length>200?offset+200:null,updatedAt:brazilTimestamp(),canEdit:mapper(a)};
}
async function allowedCity(a:AccessView,cityId:number) {
  if(!mapper(a)||!canAccessCity(a,cityId)) throw new TerritoryError('Registro fora do seu acesso.',403);
  if(!(await dbRows('SELECT id FROM cities WHERE id=? AND organization_id=?',[cityId,a.organizationId]))[0]) throw new TerritoryError('Cidade não encontrada.',404);
}
async function entity(a:AccessView,key:string) {
  const s=scope(a);const rows=await dbRows(recordsSql+`SELECT r.* FROM records r WHERE r.entity_key=? AND ${s.sql}`,[key,...s.values]);
  if(!rows[0]) throw new TerritoryError('Registro fora do seu acesso.',403);return rows[0];
}
function auditStatement(a:AccessView,action:string,key:string) {
  return database().prepare('INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) VALUES(?,?,?,?,?,?)').bind(a.organizationId,a.email,action,'territory',`Registro territorial ${key}.`,brazilTimestamp());
}
/** Pessoas da cidade com o mesmo nome (sem acento, caixa ou espaços extras). */
async function samePeople(cityId:number,name:string){
  const key=nameKey(name);if(!key)return [];
  const rows=await dbRows("SELECT p.id,p.name,COALESCE(b.name,'') AS place FROM territory_people p LEFT JOIN businesses b ON b.id=p.place_id WHERE p.city_id=? AND length(p.name) BETWEEN ? AND ? LIMIT 5000",[cityId,Math.max(1,name.length-6),name.length+6]);
  return rows.filter(r=>nameKey(str(r.name))===key).map(r=>({id:str(r.id),name:str(r.name),place:str(r.place)}));
}
function duplicateError(a:AccessView,same:{name:string;place:string}[]){
  // Quem só mapeia não vê o cadastro dos outros: recebe o aviso sem os detalhes.
  const detail=management(a)?`: ${same.slice(0,3).map(p=>p.name+(p.place?` (${p.place})`:'')).join(', ')}`:'';
  return new TerritoryError(`Já existe ${same.length===1?'uma pessoa':`${same.length} pessoas`} com esse nome nesta cidade${detail}. Confira antes de cadastrar de novo.`,409,true);
}
async function importPeople(a:AccessView,input:unknown){
  const body=input as {rows?:unknown[];commit?:boolean};
  const blocked=await featureBlocked(a.organizationId,'imports');if(blocked)throw new TerritoryError(blocked,403);
  if(!Array.isArray(body?.rows)||body.rows.length<1||body.rows.length>50) throw new TerritoryError('Importe de 1 a 50 pessoas por lote.');
  const output:{line:number;ok:boolean;status:string}[]=[];const seen=new Set<string>();const places=new Map<number,{id:string;key:string}[]>();
  for(const [index,item] of body.rows.entries()){
    try{
      const r=importPersonSchema.parse(item);await allowedCity(a,r.cityId);
      const key=r.cityId+'|'+nameKey(r.name);if(seen.has(key))throw new TerritoryError('Pessoa repetida no arquivo.');seen.add(key);
      if((await samePeople(r.cityId,r.name)).length)throw new TerritoryError('Já existe uma pessoa com esse nome nesta cidade.');
      let placeId:string|null=null,placeLink='';
      if(r.place){
        if(!places.has(r.cityId))places.set(r.cityId,(await dbRows('SELECT id,name FROM businesses WHERE organization_id=? AND city_id=? LIMIT 5000',[a.organizationId,r.cityId])).map(p=>({id:str(p.id),key:nameKey(str(p.name))})));
        const found=places.get(r.cityId)!.filter(p=>p.key===nameKey(r.place));
        if(!found.length)throw new TerritoryError(`Local "${r.place}" não encontrado nesta cidade. Cadastre o local antes.`);
        if(found.length>1)throw new TerritoryError(`Há mais de um local chamado "${r.place}" nesta cidade. Ligue esta pessoa pelo mapa.`);
        const link=placeLinkFromText(r.link);if(!link)throw new TerritoryError(r.link?`Vínculo "${r.link}" não reconhecido. Use: ${PLACE_LINKS.join(', ')}.`:'Informe o vínculo com o local.');
        placeId=found[0].id;placeLink=link;
      }
      const role=r.role?personRoleFromText(r.role):null;if(r.role&&!role)throw new TerritoryError(`Papel "${r.role}" não reconhecido. Use: ${PERSON_ROLES.join(', ')}.`);
      if(body.commit===true){
        const saved=await mutateTerritory(a,'person',{requestId:crypto.randomUUID(),cityId:r.cityId,name:r.name,placeId,placeLink,authorized:true,confirmDuplicate:true}) as {id:string};
        if(role)await mutateTerritory(a,'role',{personId:saved.id,role,status:'Ativo',responsible:a.name||a.email,source:'Importação de planilha',authorized:true});
      }
      output.push({line:index+2,ok:true,status:body.commit===true?'Salvo':'Válido'});
    }catch(e){output.push({line:index+2,ok:false,status:e instanceof TerritoryError?e.message:e instanceof ZodError?(e.issues[0]?.message??'Linha inválida.'):'Não foi possível salvar esta linha.'});}
  }
  return {rows:output};
}
export async function mutateTerritory(a:AccessView,action:string,input:unknown) {
  if(!mapper(a)||(!management(a)&&action==='event_status')) throw new TerritoryError('Seu perfil não pode alterar o território.',403);
  if(action==='import_people') return importPeople(a,input);
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
    // Líder da cidade é decisão da gestão: quem só mapeia mantém o que já estava gravado.
    if(!management(a)){if(v.leader&&!(v.id&&(await dbRows('SELECT leader FROM territory_people WHERE id=?',[id]))[0]?.leader))throw new TerritoryError('Só a gestão define o líder da cidade.',403);v.leader=Boolean(v.id&&(await dbRows('SELECT leader FROM territory_people WHERE id=?',[id]))[0]?.leader);}
    if(!v.id&&v.requestId){const existing=await dbRows('SELECT created_by,city_id FROM '+'territory_people'+' WHERE id=?',[id]);if(existing[0]){if(existing[0].created_by!==a.email||Number(existing[0].city_id)!==v.cityId)throw new TerritoryError('Este registro já foi criado por outra pessoa. Atualize a página para ver o cadastro atual.',409);return {id};}}
    if(v.id){const old=await entity(a,`person:${id}`);if(Number(old.city_id)!==v.cityId) throw new TerritoryError('A mudança de cidade exige revisão dos vínculos existentes.');}
    if(!v.id&&!v.confirmDuplicate){const same=await samePeople(v.cityId,v.name);if(same.length)throw duplicateError(a,same);}
    if(v.referrerId){const ref=await entity(a,`person:${v.referrerId}`);if(Number(ref.city_id)!==v.cityId) throw new TerritoryError('A indicação deve pertencer à cidade autorizada.');
      const seen=new Set([id]);let current:string|null=v.referrerId;
      while(current){if(seen.has(current)) throw new TerritoryError('A indicação criaria um ciclo.');seen.add(current);const p=await dbRows('SELECT referrer_id FROM territory_people WHERE id=?',[current]);current=p[0]?.referrer_id?str(p[0].referrer_id):null;}}
    if(v.placeId&&!(await dbRows('SELECT id FROM businesses WHERE id=? AND organization_id=? AND city_id=?',[v.placeId,a.organizationId,v.cityId]))[0]) throw new TerritoryError('O local vinculado deve ser da mesma cidade e da sua organização.');
    const previousLeader=v.id?(await dbRows('SELECT name,leader FROM territory_people WHERE id=?',[id]))[0]:null;
    const statements=[db.prepare(`INSERT INTO territory_people(id,city_id,name,leader,referrer_id,place_id,place_link,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,leader=excluded.leader,referrer_id=excluded.referrer_id,place_id=excluded.place_id,place_link=excluded.place_link,updated_at=excluded.updated_at`).bind(id,v.cityId,v.name,Number(v.leader),v.referrerId,v.placeId,v.placeId?v.placeLink:'',a.email,now,now)];
    statements.push(db.prepare('UPDATE ambassadors SET name=?,updated_at=? WHERE person_id=?').bind(v.name,now,id),db.prepare('UPDATE leads SET name=?,updated_at=? WHERE person_id=?').bind(v.name,now,id));
    if(previousLeader?.leader&&!v.leader) statements.push(db.prepare("UPDATE cities SET leader_name='',updated_at=? WHERE id=? AND leader_name=?").bind(now,v.cityId,String(previousLeader.name)));
    if(v.leader) statements.push(db.prepare('UPDATE territory_people SET leader=0 WHERE city_id=? AND id<>?').bind(v.cityId,id),db.prepare('UPDATE cities SET leader_name=?,updated_at=? WHERE id=?').bind(v.name,now,v.cityId));
    statements.push(auditStatement(a,'save_person',id));await db.batch(statements);return {id};
  }
  if(action==='activity') {
    const v=activitySchema.parse(input);await allowedCity(a,v.cityId);const id=v.id??v.requestId??crypto.randomUUID();
    if(!v.id&&v.requestId){const existing=await dbRows('SELECT created_by,city_id FROM '+'territory_actions'+' WHERE id=?',[id]);if(existing[0]){if(existing[0].created_by!==a.email||Number(existing[0].city_id)!==v.cityId)throw new TerritoryError('Este registro já foi criado por outra pessoa. Atualize a página para ver o cadastro atual.',409);return {id};}}
    if(v.id){const old=await entity(a,`action:${id}`);if(Number(old.city_id)!==v.cityId) throw new TerritoryError('Mantenha a cidade original da ação.');}
    if(v.personId){const p=await entity(a,`person:${v.personId}`);if(Number(p.city_id)!==v.cityId) throw new TerritoryError('Pessoa fora da cidade selecionada.');}
    await db.batch([db.prepare(`INSERT INTO territory_actions(id,city_id,person_id,name,category,status,responsible,due_date,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,status=excluded.status,responsible=excluded.responsible,due_date=excluded.due_date,updated_at=excluded.updated_at`).bind(id,v.cityId,v.personId,v.name,v.category,v.status,v.responsible,v.dueDate,a.email,now,now),auditStatement(a,'save_activity',id)]);return {id};
  }
  if(action==='event_status') {
    const v=input as {id?:unknown;status?:unknown};if(!['Planejado','Confirmado','Realizado','Cancelado'].includes(String(v.status))||!Number.isInteger(v.id)) throw new TerritoryError('Evento ou situação inválida.');
    await entity(a,`event:${v.id}`);await db.batch([db.prepare('UPDATE events SET status=? WHERE id=?').bind(v.status,v.id),auditStatement(a,'update_event',String(v.id))]);return;
  }
  throw new TerritoryError('Esta ação não está disponível. Atualize a página e tente de novo.');
}
