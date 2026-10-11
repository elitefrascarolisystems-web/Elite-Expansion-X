import { z } from 'zod';
import { database, brazilTimestamp } from '@/db/runtime';
import { isPlatformAdvisor } from '@/db/access';
import type { AccessView } from '@/lib/expansion-types';

export const ADVISORY_ROLE_LABEL = 'Assessoria Elite';
/** Erro com mensagem segura para mostrar ao usuário. */
export class OrganizationError extends Error { constructor(message:string, public status=400){ super(message); } }
const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());

/** Organizações da pessoa: as próprias e, para assessores, todas as clientes ativas. */
export async function listOrganizations(userEmail:string){
 const db=database();
 const own=(await db.prepare('SELECT o.id,o.name,u.role FROM organizations o JOIN app_users u ON u.organization_id=o.id WHERE lower(u.email)=lower(?) AND u.active=1 AND o.active=1 ORDER BY o.name').bind(userEmail).all()).results.map(row=>({id:Number(row.id),name:String(row.name),role:String(row.role)}));
 if(!await isPlatformAdvisor(userEmail))return own;
 const ownIds=new Set(own.map(o=>o.id));
 const clients=(await db.prepare('SELECT id,name FROM organizations WHERE active=1 AND id<>1 ORDER BY name').all()).results
  .filter(row=>!ownIds.has(Number(row.id))).map(row=>({id:Number(row.id),name:String(row.name),role:ADVISORY_ROLE_LABEL}));
 return [...own,...clients];
}

/**
 * Cria a organização de um cliente. O responsável indicado vira o dono e
 * administrador; o time Elite NÃO entra como membro: acompanha pela Assessoria Elite.
 */
export async function createOrganization(access:AccessView,input:unknown){
 if(!access.active||!access.isPlatformOwner)throw new OrganizationError('Sem permissão para criar organizações.',403);
 const v=z.object({name:z.string().trim().min(2).max(120),ownerEmail:email,ownerName:z.string().trim().min(2).max(120),requestId:z.string().uuid()}).parse(input);
 const db=database(),now=brazilTimestamp();
 const existing=(await db.prepare('SELECT id,created_by FROM organizations o LEFT JOIN (SELECT organization_id,actor_email AS created_by FROM platform_audit WHERE action=\'create\') a ON a.organization_id=o.id WHERE request_id=?').bind(v.requestId).all()).results[0];
 if(existing){if(existing.created_by&&String(existing.created_by)!==access.email.toLowerCase())throw new OrganizationError('Solicitação fora do seu acesso.',403);return Number(existing.id);}
 await db.batch([
  db.prepare('INSERT INTO organizations(name,owner_email,active,created_at,request_id) VALUES(?,?,1,?,?)').bind(v.name,v.ownerEmail,now,v.requestId),
  db.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) SELECT id,?,?,'Administrador',1,?,? FROM organizations WHERE request_id=?").bind(v.ownerEmail,v.ownerName,access.email,now,v.requestId),
  db.prepare('INSERT INTO settings(id,organization_id,owner_email,updated_by,updated_at) SELECT id,id,?,?,? FROM organizations WHERE request_id=?').bind(v.ownerEmail,access.email,now,v.requestId),
  db.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) SELECT id,?,'create_organization','organization',?,? FROM organizations WHERE request_id=?").bind(access.email,`Ambiente criado pela Assessoria Elite. Responsável: ${v.ownerName}.`,now,v.requestId),
  db.prepare("INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) SELECT id,?,'create',?,? FROM organizations WHERE request_id=?").bind(access.email.toLowerCase(),`Organização criada; responsável ${v.ownerEmail}.`,now,v.requestId),
 ]);
 return Number((await db.prepare('SELECT id FROM organizations WHERE request_id=?').bind(v.requestId).all()).results[0].id);
}

/** Gestão do time de assessoria: somente o dono da plataforma. */
export async function listAdvisors(access:AccessView){
 if(!access.isPlatformOwner)throw new OrganizationError('Sem permissão.',403);
 const r=await database().prepare(`SELECT adv.email,adv.name,adv.active,adv.granted_at,adv.revoked_at,
  EXISTS(SELECT 1 FROM app_users u WHERE u.organization_id=1 AND lower(u.email)=lower(adv.email) AND u.active=1) AS elite_member
  FROM platform_advisors adv ORDER BY adv.active DESC, adv.name`).all();
 return r.results.map(row=>({email:String(row.email),name:String(row.name),active:Number(row.active)===1,eliteMember:Number(row.elite_member)===1,grantedAt:String(row.granted_at),revokedAt:row.revoked_at==null?null:String(row.revoked_at)}));
}

export async function setAdvisor(access:AccessView,input:unknown){
 if(!access.isPlatformOwner)throw new OrganizationError('Sem permissão.',403);
 const v=z.object({email,active:z.boolean()}).parse(input);
 const db=database(),now=brazilTimestamp(),actor=access.email.toLowerCase();
 if(v.email===actor&&!v.active)throw new OrganizationError('O dono da plataforma não pode remover a própria assessoria.');
 if(v.active){
  const member=(await db.prepare("SELECT name FROM app_users WHERE organization_id=1 AND lower(email)=? AND active=1").bind(v.email).all()).results[0];
  if(!member)throw new OrganizationError('Só membros ativos do time Elite podem ser assessores. Cadastre a pessoa na Elite Frascaroli Academy primeiro.');
  await db.batch([
   db.prepare(`INSERT INTO platform_advisors(email,name,active,granted_by,granted_at) VALUES(?,?,1,?,?)
    ON CONFLICT(email) DO UPDATE SET active=1,name=excluded.name,granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_by=NULL,revoked_at=NULL`).bind(v.email,String(member.name),actor,now),
   db.prepare("INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) VALUES(1,?,'advisor_granted',?,?)").bind(actor,`Assessoria concedida a ${v.email}.`,now),
  ]);
 }else{
  await db.batch([
   db.prepare('UPDATE platform_advisors SET active=0,revoked_by=?,revoked_at=? WHERE email=? AND active=1').bind(actor,now,v.email),
   db.prepare("INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) VALUES(1,?,'advisor_revoked',?,?)").bind(actor,`Assessoria retirada de ${v.email}.`,now),
  ]);
 }
 return listAdvisors(access);
}
