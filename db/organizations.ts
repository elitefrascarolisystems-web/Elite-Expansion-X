import { z } from 'zod';
import { database, brazilTimestamp } from '@/db/runtime';
import type { AccessView } from '@/lib/expansion-types';

export async function listOrganizations(email:string){
 const r=await database().prepare('SELECT o.id,o.name,u.role FROM organizations o JOIN app_users u ON u.organization_id=o.id WHERE lower(u.email)=lower(?) AND u.active=1 AND o.active=1 ORDER BY o.name').bind(email).all();
 return r.results.map(row=>({id:Number(row.id),name:String(row.name),role:String(row.role)}));
}
export async function createOrganization(access:AccessView,input:unknown){
 if(!access.active||!access.isPlatformOwner)throw new Error('Sem permissão para criar organizações.');
 const v=z.object({name:z.string().trim().min(2).max(120),requestId:z.string().uuid()}).parse(input);
 const db=database(),now=brazilTimestamp();
 const existing=(await db.prepare('SELECT id,owner_email FROM organizations WHERE request_id=?').bind(v.requestId).all()).results[0];
 if(existing){if(existing.owner_email!==access.email)throw new Error('Solicitação fora do seu acesso.');return Number(existing.id);}
 await db.batch([
  db.prepare('INSERT INTO organizations(name,owner_email,active,created_at,request_id) VALUES(?,?,1,?,?)').bind(v.name,access.email,now,v.requestId),
  db.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) SELECT id,?,?,'Administrador',1,?,? FROM organizations WHERE request_id=?").bind(access.email,access.name,access.email,now,v.requestId),
  db.prepare('INSERT INTO settings(id,organization_id,owner_email,updated_by,updated_at) SELECT id,id,?,?,? FROM organizations WHERE request_id=?').bind(access.email,access.email,now,v.requestId),
  db.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) SELECT id,?,'create_organization','organization','Ambiente privado criado pelo proprietário.',? FROM organizations WHERE request_id=?").bind(access.email,now,v.requestId),
 ]);
 return Number((await db.prepare('SELECT id FROM organizations WHERE request_id=?').bind(v.requestId).all()).results[0].id);
}
