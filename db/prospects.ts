import {database,brazilTimestamp,audit,asNullableNumber} from '@/db/runtime';
import {executeAction} from '@/db/mutations';
import type {AccessView} from '@/lib/expansion-types';
import {canAccessCity,canAccessLead} from '@/lib/expansion-permissions';
import {parseActionPayload} from '@/lib/expansion-validation';
import {TEMPERATURES} from '@/lib/commercial';
import {importSchema,updateSchema,bulkSchema,convertSchema,removeSchema,contactedSchema,normalizePhone,phoneVariants,formatPhone,joinTags,splitTags,cleanTag,PROSPECT_LIMIT,PROSPECT_PAGE,PROSPECT_STATUSES} from '@/lib/prospects';
export class ProspectError extends Error{constructor(message:string,public status=400){super(message);}}
type Row=Record<string,unknown>;type Value=string|number|null;
const rows=async(sql:string,args:Value[]=[])=> (await database().prepare(sql).bind(...args).all()).results as Row[];
// D1 accepts at most 100 bound values per statement, so IN lists are split.
async function lookup(sql:(marks:string)=>string,prefix:Value[],values:string[]){const found:Row[]=[];for(let i=0;i<values.length;i+=45){const part=values.slice(i,i+45);found.push(...await rows(sql(part.map(()=>'?').join(',')),[...prefix,...part]));}return found;}
function owner(a:AccessView){if(!a.active||!['Administrador','Coordenação','Líder','Comercial'].includes(a.role))throw new ProspectError('Seu perfil não possui acesso aos contatos a mapear.',403);if(!Number.isInteger(a.organizationId)||a.organizationId<1)throw new ProspectError('Organização fora do seu acesso.',403);return a.email.toLowerCase();}
async function city(a:AccessView,id:number|null){if(id===null)return;if(!canAccessCity(a,id)||!(await rows('SELECT id FROM cities WHERE id=? AND organization_id=?',[id,a.organizationId]))[0])throw new ProspectError('Cidade fora do seu acesso.',403);}
async function own(a:AccessView,email:string,id:string){const r=(await rows('SELECT * FROM prospect_contacts WHERE id=? AND organization_id=? AND owner_email=?',[id,a.organizationId,email]))[0];if(!r)throw new ProspectError('Contato fora da sua lista.',403);return r;}
async function identityHash(organizationId:number,e164:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`elite-optout:${organizationId}:${e164}`));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export async function getProspects(a:AccessView,p:URLSearchParams){
 const email=owner(a),where=['r.organization_id=?','r.owner_email=?'],args:Value[]=[a.organizationId,email];
 const q=(p.get('q')||'').trim().slice(0,100),digits=q.replace(/\D/g,'');if(q){where.push(`(instr(lower(r.name),lower(?))>0${digits.length>=4?' OR instr(r.whatsapp,?)>0':''})`);args.push(q,...digits.length>=4?[digits]:[]);}
 const cityParam=p.get('city')||'';if(cityParam==='none')where.push('r.city_id IS NULL');else if(Number(cityParam)>0){where.push('r.city_id=?');args.push(Number(cityParam));}
 const tag=cleanTag(p.get('tag')||'');if(tag){where.push('instr(r.tags,?)>0');args.push('|'+tag+'|');}
 const status=p.get('status')||'';if((PROSPECT_STATUSES as readonly string[]).includes(status)){where.push('r.status=?');args.push(status);}
 const temperature=p.get('temperature')||'';if((TEMPERATURES as readonly string[]).includes(temperature)){where.push('r.temperature=?');args.push(temperature);}
 const offset=Math.max(0,Math.floor(Number(p.get('offset'))||0)),filter=where.join(' AND ');
 const list=await rows(`SELECT r.id,r.name,r.whatsapp,r.email,r.tags,r.temperature,r.status,r.note,r.source,r.city_id,c.name AS city_name,r.last_contacted_at,r.lead_id,r.version FROM prospect_contacts r LEFT JOIN cities c ON c.id=r.city_id WHERE ${filter} ORDER BY CASE r.status WHEN 'A contatar' THEN 0 WHEN 'Convidado' THEN 1 ELSE 2 END,CASE r.temperature WHEN 'Quente' THEN 0 WHEN 'Morno' THEN 1 ELSE 2 END,r.name COLLATE NOCASE,r.id LIMIT ? OFFSET ?`,[...args,PROSPECT_PAGE+1,offset]);
 const total=Number((await rows(`SELECT count(*) AS n FROM prospect_contacts r WHERE ${filter}`,args))[0]?.n??0);
 const byCity=await rows("SELECT r.city_id,c.name AS city_name,count(*) AS total,sum(r.status='A contatar') AS pending,sum(r.status='Convidado') AS invited,sum(r.status='Virou lead') AS converted,sum(r.temperature='Quente') AS hot FROM prospect_contacts r LEFT JOIN cities c ON c.id=r.city_id WHERE r.organization_id=? AND r.owner_email=? GROUP BY r.city_id,c.name ORDER BY total DESC",[a.organizationId,email]);
 const tagCount=new Map<string,number>();for(const r of await rows("SELECT tags FROM prospect_contacts WHERE organization_id=? AND owner_email=? AND tags<>''",[a.organizationId,email]))for(const t of splitTags(String(r.tags)))tagCount.set(t,(tagCount.get(t)??0)+1);
 return {rows:list.slice(0,PROSPECT_PAGE).map(r=>({...r,phone:formatPhone(String(r.whatsapp)),tags:splitTags(String(r.tags))})),total,offset,hasMore:list.length>PROSPECT_PAGE,byCity,tags:[...tagCount].sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0])).slice(0,50).map(([name,count])=>({name,count})),limit:PROSPECT_LIMIT,updatedAt:brazilTimestamp()};
}
type Outcome={line:number;ok:boolean;status:string;name:string;phone:string};
async function classify(a:AccessView,email:string,input:unknown){
 const v=importSchema.parse(input);await city(a,v.cityId);
 const prepared=v.rows.map(r=>({...r,phone:r.phones.map(n=>normalizePhone(n,v.defaultDdd)).find((n):n is string=>Boolean(n))??null}));
 const numbers=[...new Set(prepared.flatMap(r=>r.phone?[r.phone]:[]))];
 const listed=new Set((await lookup(m=>`SELECT whatsapp FROM prospect_contacts WHERE organization_id=? AND owner_email=? AND whatsapp IN (${m})`,[a.organizationId,email],numbers)).map(r=>String(r.whatsapp)));
 const leadRows=await lookup(m=>`SELECT l.normalized_whatsapp AS n,l.status,l.consent_revoked_at FROM leads l JOIN cities c ON c.id=l.city_id WHERE c.organization_id=? AND l.normalized_whatsapp IN (${m})`,[a.organizationId],numbers.flatMap(phoneVariants));
 const revoked=new Set(leadRows.filter(r=>r.consent_revoked_at).map(r=>String(r.n))),active=new Set(leadRows.filter(r=>!r.consent_revoked_at&&r.status!=='Cancelado').map(r=>String(r.n)));
 const hashes=new Map(await Promise.all(numbers.map(async n=>[n,await identityHash(a.organizationId,n)] as const)));
 const blocked=new Set((await lookup(m=>`SELECT identity_hash FROM contact_optouts WHERE organization_id=? AND identity_hash IN (${m})`,[a.organizationId],[...hashes.values()])).map(r=>String(r.identity_hash)));
 const seen=new Set<string>();
 const outcomes=prepared.map((r,line)=>{
  const phone=r.phone;let status='Novo';
  if(!phone)status=r.phones.length?'Número inválido ou sem DDD':'Sem telefone';
  else if(seen.has(phone))status='Repetido no arquivo';
  else if(blocked.has(hashes.get(phone)!)||phoneVariants(phone).some(n=>revoked.has(n)))status='Pediu para não ser contatado';
  else if(phoneVariants(phone).some(n=>active.has(n)))status='Já é lead';
  else if(listed.has(phone))status='Já está na sua lista';
  if(phone)seen.add(phone);
  return {line,ok:status==='Novo',status,name:r.name||(phone?formatPhone(phone):''),phone:phone?formatPhone(phone):'',row:{...r,phone}};
 });
 return {v,outcomes};
}
const strip=(o:Outcome&{row?:unknown}):Outcome=>({line:o.line,ok:o.ok,status:o.status,name:o.name,phone:o.phone});
export async function saveProspects(a:AccessView,action:string,input:unknown){
 const email=owner(a),db=database(),now=brazilTimestamp();
 if(action==='import_preview'||action==='import_commit'){
  const {v,outcomes}=await classify(a,email,input);
  if(action==='import_preview')return {rows:outcomes.map(strip)};
  if(!v.confirmed)throw new ProspectError('Confirme a origem dos contatos antes de importar.');
  const fresh=outcomes.filter(o=>o.ok);if(!fresh.length)return {rows:outcomes.map(strip),imported:0};
  const total=Number((await rows('SELECT count(*) AS n FROM prospect_contacts WHERE organization_id=? AND owner_email=?',[a.organizationId,email]))[0]?.n??0);
  if(total+fresh.length>PROSPECT_LIMIT)throw new ProspectError(`Sua lista comporta até ${PROSPECT_LIMIT} contatos. Remova contatos antigos ou importe menos.`);
  const extra=v.extraTag?[v.extraTag]:[];
  const result=await db.batch(fresh.map(o=>db.prepare("INSERT OR IGNORE INTO prospect_contacts(id,organization_id,owner_email,city_id,name,whatsapp,email,tags,temperature,status,note,source,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'Frio','A contatar',?,?,1,?,?)").bind(crypto.randomUUID(),a.organizationId,email,v.cityId,o.name,o.row.phone,o.row.email,joinTags([...o.row.tags,...extra]),o.row.note,v.source,now,now)));
  let imported=0;fresh.forEach((o,i)=>{if(result[i].meta.changes){o.status='Importado';imported++;}else{o.ok=false;o.status='Já está na sua lista';}});
  if(imported)await audit(db,a.organizationId,a.email,'prospect_import','prospect',null,`${imported} contatos da agenda importados com autorização pendente (${v.source}).`);
  return {rows:outcomes.map(strip),imported};
 }
 if(action==='contacted'){
  const {id}=contactedSchema.parse(input);
  const r=await db.prepare("UPDATE prospect_contacts SET status=CASE WHEN status='A contatar' THEN 'Convidado' ELSE status END,last_contacted_at=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=? AND owner_email=?").bind(now,now,id,a.organizationId,email).run();
  if(!r.meta.changes)throw new ProspectError('Contato fora da sua lista.',403);
  await audit(db,a.organizationId,a.email,'prospect_contacted','prospect',null,`Conversa individual aberta no WhatsApp (contato ${id}).`);return {};
 }
 if(action==='update'){
  const v=updateSchema.parse(input),old=await own(a,email,v.id);if(old.status==='Virou lead')throw new ProspectError('Este contato já virou lead. Atualize-o em Leads e vendas.');
  if(v.cityId!==asNullableNumber(old.city_id))await city(a,v.cityId);
  const r=await db.prepare('UPDATE prospect_contacts SET city_id=?,tags=?,temperature=?,status=?,note=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=? AND owner_email=? AND version=?').bind(v.cityId,joinTags(v.tags),v.temperature,v.status,v.note,now,v.id,a.organizationId,email,v.version).run();
  if(!r.meta.changes)throw new ProspectError('Contato alterado em outra janela. Atualize a lista antes de salvar.',409);return {};
 }
 if(action==='bulk'){
  const v=bulkSchema.parse(input);if(v.cityId!==undefined)await city(a,v.cityId);
  const found=await lookup(m=>`SELECT id,tags FROM prospect_contacts WHERE organization_id=? AND owner_email=? AND status<>'Virou lead' AND id IN (${m})`,[a.organizationId,email],[...new Set(v.ids)]);
  if(!found.length)return {updated:0};
  await db.batch(found.map(r=>db.prepare(`UPDATE prospect_contacts SET ${v.cityId!==undefined?'city_id=?,':''}tags=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=? AND owner_email=?`).bind(...(v.cityId!==undefined?[v.cityId]:[]),joinTags([...splitTags(String(r.tags)),...v.addTag?[v.addTag]:[]]),now,String(r.id),a.organizationId,email)));
  return {updated:found.length};
 }
 if(action==='convert'){
  const v=convertSchema.parse(input),p=await own(a,email,v.id);if(p.status==='Virou lead')return {leadId:Number(p.lead_id)};
  await city(a,v.cityId);
  const existing=(await rows(`SELECT l.id,l.city_id,l.ambassador_id,l.assigned_to_email FROM leads l JOIN cities c ON c.id=l.city_id WHERE c.organization_id=? AND l.status<>'Cancelado' AND l.consent_revoked_at IS NULL AND l.normalized_whatsapp IN (${phoneVariants(String(p.whatsapp)).map(()=>'?').join(',')}) LIMIT 1`,[a.organizationId,...phoneVariants(String(p.whatsapp))]))[0];
  let leadId:number,linked=false;
  if(existing){if(!canAccessLead(a,{cityId:Number(existing.city_id),ambassadorId:asNullableNumber(existing.ambassador_id),assignedToEmail:String(existing.assigned_to_email??'')}))throw new ProspectError('Este número já é lead de outro responsável. Peça a revisão à coordenação.',409);leadId=Number(existing.id);linked=true;}
  else leadId=Number(await executeAction('create_lead',parseActionPayload('create_lead',{cityId:v.cityId,name:String(p.name),email:String(p.email),whatsapp:String(p.whatsapp),status:'Lead válido',channel:v.channel,sourceLabel:'Agenda pessoal',consentAccepted:true,consentSource:v.consentSource,consentPurpose:v.consentPurpose,assignedToEmail:email}),a));
  await db.prepare("UPDATE prospect_contacts SET status='Virou lead',lead_id=?,city_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=? AND owner_email=?").bind(leadId,linked?Number(existing!.city_id):v.cityId,now,v.id,a.organizationId,email).run();
  await audit(db,a.organizationId,a.email,'prospect_convert','prospect',leadId,linked?`Contato ${v.id} vinculado ao lead existente.`:`Contato ${v.id} autorizou e virou lead.`);
  return {leadId,linked};
 }
 if(action==='remove'){
  const v=removeSchema.parse(input),p=await own(a,email,v.id);
  if(v.optOut&&p.status==='Virou lead')throw new ProspectError('Este contato já é lead. Registre a revogação em Leads e vendas.');
  const statements=[db.prepare('DELETE FROM prospect_contacts WHERE id=? AND organization_id=? AND owner_email=?').bind(v.id,a.organizationId,email)];
  if(v.optOut)statements.push(db.prepare('INSERT OR IGNORE INTO contact_optouts(organization_id,identity_hash,created_by,created_at) VALUES(?,?,?,?)').bind(a.organizationId,await identityHash(a.organizationId,String(p.whatsapp)),a.email,now));
  await db.batch(statements);
  await audit(db,a.organizationId,a.email,v.optOut?'prospect_optout':'prospect_remove','prospect',null,v.optOut?'Pessoa pediu para não ser contatada; dados removidos e reimportação bloqueada.':`Contato ${v.id} removido da lista.`);
  return {};
 }
 throw new ProspectError('Ação inválida.');
}
