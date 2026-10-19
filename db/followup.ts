import {database,brazilTimestamp} from '@/db/runtime';
import {scope,entity,CommercialError} from '@/db/commercial';
import type {AccessView} from '@/lib/expansion-types';
import {commandSchema,transition,fechaStatus,rowDue,type Followup,type FollowupRow} from '@/lib/followup';
import {z} from 'zod';
const rows=async(sql:string,args:(string|number|null)[]=[])=> (await database().prepare(sql).bind(...args).all()).results as Record<string,unknown>[];
export async function getFollowup(a:AccessView,p:URLSearchParams){
 const s=scope(a),args=[...s.args],where=[s.sql,"l.consent_revoked_at IS NULL AND l.status<>'Cancelado'"];
 if(a.role==='Comercial'){where.push('lower(l.assigned_to_email)=lower(?)');args.push(a.email);}
 for(const [key,column] of [['city','r.city_id'],['owner','r.owner_email'],['lead','r.lead_id'],['id','r.id']])if(p.get(key)){where.push(`${column}=?`);args.push(p.get(key)!);}
 if(p.get('q')){where.push('(l.name LIKE ? OR r.next_action LIKE ?)');args.push('%'+p.get('q')!.slice(0,100)+'%','%'+p.get('q')!.slice(0,100)+'%');}
 const offset=Math.max(0,Math.min(100000,Number(p.get('offset'))||0));
 const from=`FROM opportunities r JOIN leads l ON l.id=r.lead_id JOIN cities c ON c.id=r.city_id LEFT JOIN sales sale ON sale.lead_id=l.id WHERE ${where.join(' AND ')}`;
 const list=await rows(`SELECT r.*,l.name AS lead_name,l.person_id,l.channel,l.source_label,c.name AS city_name,sale.status AS payment_status,sale.paid_at,sale.amount_cents,(SELECT name FROM app_users u WHERE u.organization_id=r.organization_id AND lower(u.email)=lower(r.owner_email)) AS owner_name,(SELECT MAX(created_at) FROM commercial_activities act WHERE act.opportunity_id=r.id AND act.kind<>'Etapa') AS last_contact ${from} ORDER BY r.due_date,r.id LIMIT 101 OFFSET ?`,[...args,offset]);
 const total=Number((await rows(`SELECT COUNT(*) AS n ${from}`,args))[0].n);
 const records=list.slice(0,100).map(r=>{const f=JSON.parse(String(r.followup_json||'{}')) as Followup;const row={...r,followup:f} as unknown as FollowupRow;delete (row as unknown as Record<string,unknown>).followup_json;row.fechaStatus=fechaStatus(f,row.payment_status==='Pagamento confirmado'&&!!row.paid_at);row.dueAt=rowDue(row);if(row.payment_status==='Pagamento confirmado'&&row.paid_at&&!f.aftercare)row.next_action='Agendar boas-vindas';return row;});
 const history=p.get('id')&&records.length?await rows('SELECT id,action,note,actor_email,created_at FROM followup_events WHERE organization_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 100',[a.organizationId,p.get('id')!]):[];
 return {records,history,total,hasMore:list.length>100,offset,updatedAt:brazilTimestamp()};
}
export async function saveFollowup(a:AccessView,input:unknown){
 const v=commandSchema.parse(input),o=await entity(a,'opportunities',v.opportunityId);
 const prior=(await rows('SELECT * FROM followup_events WHERE id=?',[v.requestId]))[0],requestJson=JSON.stringify(v);
 if(prior){if(Number(prior.organization_id)!==a.organizationId||prior.actor_email!==a.email||prior.opportunity_id!==v.opportunityId||prior.request_json!==requestJson)throw new CommercialError('Identificador de envio já utilizado.',409);return {id:v.opportunityId};}
 const lead=(await rows('SELECT consent_revoked_at,status FROM leads WHERE id=?',[Number(o.lead_id)]))[0];if(!lead||lead.consent_revoked_at||lead.status==='Cancelado')throw new CommercialError('Contato sem autorização vigente.',403);
 const sale=(await rows('SELECT status,paid_at FROM sales WHERE lead_id=?',[Number(o.lead_id)]))[0];const paid=sale?.status==='Pagamento confirmado'&&!!sale.paid_at;
 const before=JSON.parse(String(o.followup_json||'{}')) as Followup;let after:Followup;
 try{after=transition(before,v,paid,String(o.stage));}catch(e){throw new CommercialError((e as Error).message);}
 const db=database(),now=brazilTimestamp(),nextAction=after.dueAt?v.nextAction:'',due=after.dueAt?brazilTimestamp(new Date(after.dueAt)).slice(0,10):String(o.due_date);
 // CAS and all dependent writes share one D1 transaction. changes() propagates a failed CAS.
 const result=await db.batch([
  db.prepare("UPDATE opportunities SET followup_json=?,next_action=?,due_date=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND version=? AND EXISTS(SELECT 1 FROM leads WHERE id=opportunities.lead_id AND consent_revoked_at IS NULL AND status<>'Cancelado' AND (?<> 'Comercial' OR lower(assigned_to_email)=lower(?))) AND (? = EXISTS(SELECT 1 FROM sales WHERE lead_id=opportunities.lead_id AND status='Pagamento confirmado' AND paid_at IS NOT NULL))").bind(JSON.stringify(after),nextAction,due,now,v.opportunityId,a.organizationId,v.version,a.role,a.email,Number(paid)),
  db.prepare('INSERT INTO followup_events(id,organization_id,opportunity_id,actor_email,request_json,action,note,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()>0').bind(v.requestId,a.organizationId,v.opportunityId,a.email,requestJson,v.action,v.note,JSON.stringify({followup:before,nextAction:o.next_action,dueDate:o.due_date,version:o.version}),JSON.stringify({followup:after,nextAction,dueDate:due,version:v.version+1}),now),
  db.prepare("INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at) SELECT ?,?,?,?,?,'Follow-up',?,?,? WHERE changes()>0").bind(v.requestId,a.organizationId,o.city_id,v.opportunityId,a.email,v.channel+' · '+v.note,now.slice(0,10),now),
  db.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) SELECT ?,?,'followup','opportunity',?,? WHERE changes()>0").bind(a.organizationId,a.email,`${v.action} · ${v.opportunityId} · ${v.requestId}`,now),
 ]);
 if(!result[0].meta.changes)throw new CommercialError('Registro alterado ou acesso atualizado. Recarregue a ficha antes de salvar.',409);
 return {id:v.opportunityId};
}
function peopleScope(a:AccessView){scope(a);const args:(string|number|null)[]=[a.organizationId];let sql='p.city_id IN (SELECT id FROM cities WHERE organization_id=?)';
 if(a.role!=='Administrador'&&a.cityId){sql+=' AND p.city_id=?';args.push(a.cityId);}else if(a.role!=='Administrador'&&a.role!=='Comercial')sql+=' AND 1=0';
 if(a.role==='Comercial'){sql+=" AND EXISTS(SELECT 1 FROM leads l WHERE l.person_id=p.id AND lower(l.assigned_to_email)=lower(?) AND l.consent_revoked_at IS NULL AND l.status<>'Cancelado')";args.push(a.email);}
 sql+=" AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.person_id=p.id AND (l.consent_revoked_at IS NOT NULL OR l.status='Cancelado'))";return {sql,args};}
export async function getNetwork(a:AccessView,p:URLSearchParams){
 const s=peopleScope(a),base=`WITH visible AS (SELECT p.* FROM territory_people p WHERE ${s.sql}) `,args=[...s.args];let where='1=1';
 if(p.get('city')){where+=' AND p.city_id=?';args.push(p.get('city')!);}
 if(p.get('q')){where+=' AND p.name LIKE ?';args.push('%'+p.get('q')!.slice(0,100)+'%');}
 else if(p.get('parent')){if(!(await rows(base+'SELECT id FROM visible WHERE id=?',[...s.args,p.get('parent')!]))[0])throw new CommercialError('Pessoa fora do seu acesso.',403);where+=' AND p.referrer_id=?';args.push(p.get('parent')!);}
 else if(p.get('view')!=='list')where+=' AND NOT EXISTS(SELECT 1 FROM visible v WHERE v.id=p.referrer_id)';
 const offset=Math.max(0,Math.min(100000,Number(p.get('offset'))||0));
 const list=await rows(base+`SELECT p.id,p.name,p.city_id,c.name AS city_name,(SELECT id FROM visible WHERE id=p.referrer_id) AS referrer_id,(SELECT name FROM visible WHERE id=p.referrer_id) AS referrer_name,(SELECT COUNT(*) FROM visible v WHERE v.referrer_id=p.id) AS children_count,l.id AS lead_id,r.id AS opportunity_id,r.next_action,r.due_date,r.stage,s.status AS payment_status,s.amount_cents,CASE WHEN EXISTS(SELECT 1 FROM ambassadors WHERE person_id=p.id) THEN 'Embaixador' WHEN s.status='Pagamento confirmado' AND s.paid_at IS NOT NULL THEN 'Cliente' ELSE 'Pessoa' END AS role FROM visible p JOIN cities c ON c.id=p.city_id LEFT JOIN leads l ON l.person_id=p.id LEFT JOIN opportunities r ON r.lead_id=l.id AND (?<>'Comercial' OR lower(r.owner_email)=lower(?)) LEFT JOIN sales s ON s.lead_id=l.id WHERE ${where} ORDER BY p.name,p.id LIMIT 51 OFFSET ?`,[...s.args,a.role,a.email,...args.slice(s.args.length),offset]);
 const total=Number((await rows(base+`SELECT COUNT(*) AS n FROM visible p WHERE ${where}`,args))[0].n);
 return {records:list.slice(0,50),hasMore:list.length>50,total,offset,updatedAt:brazilTimestamp()};
}
export async function linkReferral(a:AccessView,input:unknown){
 const v=z.object({personId:z.string().uuid(),referrerId:z.string().uuid(),note:z.string().trim().min(3).max(1000)}).parse(input),s=peopleScope(a);
 const people=await rows(`SELECT p.* FROM territory_people p WHERE ${s.sql} AND p.id IN (?,?)`,[...s.args,v.personId,v.referrerId]);
 if(people.length!==2)throw new CommercialError('Selecione duas pessoas diferentes dentro do seu acesso.',403);
 const child=people.find(p=>p.id===v.personId)!,parent=people.find(p=>p.id===v.referrerId)!;
 if(child.city_id!==parent.city_id)throw new CommercialError('A indicação deve pertencer à mesma cidade.');
 if(child.referrer_id===v.referrerId)return {id:v.personId};
 if(child.referrer_id)throw new CommercialError('A origem principal já está registrada. Solicite revisão à gestão.',409);
 const db=database(),now=brazilTimestamp();
 const result=await db.batch([
 db.prepare(`WITH RECURSIVE ancestors(id,referrer_id) AS (SELECT id,referrer_id FROM territory_people WHERE id=? UNION SELECT p.id,p.referrer_id FROM territory_people p JOIN ancestors a ON p.id=a.referrer_id) UPDATE territory_people SET referrer_id=?,updated_at=? WHERE id=? AND referrer_id IS NULL AND NOT EXISTS(SELECT 1 FROM ancestors WHERE id=?)`).bind(v.referrerId,v.referrerId,now,v.personId,v.personId),
 db.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) SELECT ?,?,'link_referral','territory',?,? WHERE changes()>0").bind(a.organizationId,a.email,`${v.referrerId} → ${v.personId}: ${v.note}`,now)
 ]);if(!result[0].meta.changes)throw new CommercialError('O vínculo mudou ou criaria um ciclo. Atualize a rede.',409);return {id:v.personId};
}
