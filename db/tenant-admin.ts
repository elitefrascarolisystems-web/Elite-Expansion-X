import "@/lib/zod-pt";
import {z} from 'zod';
import {database,brazilTimestamp} from '@/db/runtime';
import {getUserAccess} from '@/db/access';
import {USER_ROLES,type AccessView} from '@/lib/expansion-types';
export class TenantError extends Error {constructor(message:string,public status=400){super(message)}}
const id=z.number().int().positive(),email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const reason=z.string().trim().min(5).max(500);
const row=async(sql:string,...args:(string|number|null)[])=>(await database().prepare(sql).bind(...args).all()).results[0];
export async function platformAccess(email:string,name:string){return (await getUserAccess(email,name,1))?.isPlatformOwner===true;}
export async function requireFeature(org:number,feature:'imports'|'exports'|'maps'|'external_maps'|'reports'){
 const e=await row(`SELECT ${feature} AS enabled FROM organization_entitlements WHERE organization_id=?`,org);
 if(e&&Number(e.enabled)!==1)throw new TenantError('Este recurso não está liberado para sua organização.',403);
}
/** Logo da empresa: só PNG, JPEG ou WebP de verdade, até 150 KB e dentro do armazenamento do plano. */
export async function validateLogo(org:number,logo:string,official:boolean){
 if(!official)throw new TenantError('Confirme que esta é a logo oficial autorizada.');const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(logo);if(!m)throw new TenantError('Use PNG, JPEG ou WebP. SVG não é aceito neste upload.');let bytes:string;try{bytes=atob(m[2]);}catch{throw new TenantError('Arquivo inválido.')}
 if(bytes.length>150000)throw new TenantError('A logo deve ter até 150 KB.');
 const valid=m[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):m[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';if(!valid)throw new TenantError('O conteúdo não corresponde ao formato da imagem.');
 const ent=await row('SELECT storage_bytes FROM organization_entitlements WHERE organization_id=?',org);if(ent?.storage_bytes!=null&&bytes.length>Number(ent.storage_bytes))throw new TenantError('O arquivo excede o armazenamento contratado para logos.');
}
function requireAdmin(a:AccessView|null):asserts a is AccessView {if(!a?.active||a.role!=='Administrador')throw new TenantError('Acesso administrativo não autorizado.',403)}
function auditStatement(org:number,actor:string,action:string,reason:string){return database().prepare('INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) VALUES(?,?,?,?,?)').bind(org,actor,action,reason,brazilTimestamp())}
async function scope(org:number,city:number|null,amb:number|null,role:string){
 if(city&&!await row('SELECT id FROM cities WHERE id=? AND organization_id=?',city,org))throw new TenantError('Cidade fora da organização.',403);
 if(['Coordenação','Líder','Embaixador'].includes(role)&&!city)throw new TenantError('Selecione a cidade autorizada.');
 if(role==='Embaixador'&&!amb)throw new TenantError('Selecione o cadastro de embaixador.');
 if(amb&&!await row('SELECT a.id FROM ambassadors a JOIN cities c ON c.id=a.city_id WHERE a.id=? AND a.city_id=? AND c.organization_id=?',amb,city,org))throw new TenantError('Embaixador fora da cidade autorizada.',403);
}
export async function getTenantAdmin(email:string,name:string,a:AccessView|null){
 const db=database(),platform=await platformAccess(email,name);
 const organizations=platform?(await db.prepare(`SELECT o.id,o.name,o.active,o.created_at,(SELECT count(*) FROM app_users u WHERE u.organization_id=o.id AND u.active=1) AS members,(SELECT count(*) FROM cities c WHERE c.organization_id=o.id AND c.status='Ativa') AS cities FROM organizations o ORDER BY o.id LIMIT 200`).all()).results:[];
 if(!a||a.role!=='Administrador')return {platform,organizations,members:[],invites:[],audit:platform?(await db.prepare('SELECT * FROM platform_audit ORDER BY id DESC LIMIT 100').all()).results:[],profile:null,entitlements:null};
 const org=a.organizationId;
 return {platform,organizations,members:(await db.prepare('SELECT id,email,name,role,city_id,ambassador_id,active FROM app_users WHERE organization_id=? ORDER BY id LIMIT 500').bind(org).all()).results,
 invites:(await db.prepare('SELECT id,email,name,role,city_id,expires_at,revoked_at,accepted_at FROM organization_invites WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').bind(org).all()).results,
 profile:await row('SELECT * FROM organization_profiles WHERE organization_id=?',org),entitlements:await row('SELECT * FROM organization_entitlements WHERE organization_id=?',org),
 audit:(await db.prepare('SELECT * FROM platform_audit WHERE organization_id=? ORDER BY id DESC LIMIT 100').bind(org).all()).results};
}
const memberFields={role:z.enum(USER_ROLES),cityId:id.nullable().default(null),ambassadorId:id.nullable().default(null)};
async function digest(token:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function mutateTenant(emailValue:string,name:string,a:AccessView|null,action:string,input:unknown){
 const db=database(),now=brazilTimestamp(),actor=emailValue.toLowerCase();
 if(action==='accept'){
  const v=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).parse(input),hash=await digest(v.token);
  const invite=await row('SELECT i.* FROM organization_invites i JOIN organizations o ON o.id=i.organization_id AND o.active=1 WHERE i.token_hash=? AND lower(i.email)=? AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>?',hash,actor,new Date().toISOString());
  if(!invite)throw new TenantError('Convite inválido, expirado, já usado ou destinado a outra conta.',403);
  const org=Number(invite.organization_id);await scope(org,invite.city_id==null?null:Number(invite.city_id),invite.ambassador_id==null?null:Number(invite.ambassador_id),String(invite.role));
  if(await row('SELECT id FROM app_users WHERE organization_id=? AND lower(email)=?',org,actor))throw new TenantError('Já existe um vínculo. Peça ao administrador para revisar seu acesso.');
  // The guarded insert and claim run in one transaction. Concurrent accepts cannot duplicate membership.
  await db.batch([
   db.prepare(`INSERT INTO app_users(organization_id,email,name,role,city_id,ambassador_id,active,created_by,created_at) SELECT organization_id,email,?,role,city_id,ambassador_id,1,created_by,? FROM organization_invites WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?`).bind(name||String(invite.name),now,String(invite.id),new Date().toISOString()),
   db.prepare('UPDATE organization_invites SET accepted_at=? WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL').bind(now,String(invite.id)),auditStatement(org,actor,'invite_accepted','Aceite pelo e-mail autenticado do destinatário.'),
  ]);return {organizationId:org};
 }
 if(['create','organization_status','entitlements'].includes(action)){
  if(!await platformAccess(actor,name))throw new TenantError('Administração da plataforma não autorizada.',403);
  if(action==='create'){
   const v=z.object({requestId:z.string().uuid(),name:z.string().trim().min(2).max(120),ownerEmail:email,ownerName:z.string().trim().min(2).max(120),confirmed:z.literal(true)}).parse(input);
   const existing=await row('SELECT id FROM organizations WHERE request_id=?',v.requestId);if(existing)return {organizationId:Number(existing.id)};
   await db.batch([db.prepare('INSERT INTO organizations(name,owner_email,active,created_at,request_id) VALUES(?,?,1,?,?)').bind(v.name,v.ownerEmail,now,v.requestId),
    db.prepare('INSERT INTO settings(id,organization_id,owner_email,updated_by,updated_at) SELECT id,id,?,?,? FROM organizations WHERE request_id=?').bind(v.ownerEmail,actor,now,v.requestId),
    db.prepare("INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) SELECT id,?,'create','Ambiente vazio; proprietário indicado, aguardando aceite.',? FROM organizations WHERE request_id=?").bind(actor,now,v.requestId)]);
   return {organizationId:Number((await row('SELECT id FROM organizations WHERE request_id=?',v.requestId))!.id)};
  }
  if(action==='organization_status'){
   const v=z.object({organizationId:id,active:z.boolean(),reason}).parse(input);if(v.organizationId===1&&!v.active)throw new TenantError('A organização principal não pode ser suspensa por esta tela.');
   if(!await row('SELECT id FROM organizations WHERE id=?',v.organizationId))throw new TenantError('Organização inexistente.');
   await db.batch([db.prepare('UPDATE organizations SET active=? WHERE id=?').bind(Number(v.active),v.organizationId),auditStatement(v.organizationId,actor,v.active?'reactivate':'suspend',v.reason)]);return {};
  }
  const limit=z.number().int().min(0).max(100000000).nullable();
  const v=z.object({organizationId:id,userLimit:limit,cityLimit:limit,storageBytes:limit,imports:z.boolean(),exports:z.boolean(),maps:z.boolean(),externalMaps:z.boolean(),reports:z.boolean(),reason}).parse(input);
  if(!await row('SELECT id FROM organizations WHERE id=?',v.organizationId))throw new TenantError('Organização inexistente.');
  await db.batch([db.prepare(`INSERT INTO organization_entitlements(organization_id,user_limit,city_limit,storage_bytes,imports,exports,maps,external_maps,reports,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET user_limit=excluded.user_limit,city_limit=excluded.city_limit,storage_bytes=excluded.storage_bytes,imports=excluded.imports,exports=excluded.exports,maps=excluded.maps,external_maps=excluded.external_maps,reports=excluded.reports,updated_at=excluded.updated_at`).bind(v.organizationId,v.userLimit,v.cityLimit,v.storageBytes,Number(v.imports),Number(v.exports),Number(v.maps),Number(v.externalMaps),Number(v.reports),now),auditStatement(v.organizationId,actor,'entitlements',v.reason)]);return {};
 }
 if(action==='invite'){
  const v=z.object({organizationId:id,email,name:z.string().trim().min(2).max(120),...memberFields,days:z.number().int().min(1).max(14),confirmed:z.literal(true)}).parse(input);
  const org=await row('SELECT owner_email,active FROM organizations WHERE id=?',v.organizationId);if(!org||!org.active)throw new TenantError('Organização indisponível.');
  const initialOwner=await platformAccess(actor,name)&&String(org.owner_email).toLowerCase()===v.email&&!await row('SELECT id FROM app_users WHERE organization_id=? AND lower(email)=?',v.organizationId,v.email);
  if(!initialOwner){requireAdmin(a);if(a.organizationId!==v.organizationId)throw new TenantError('Organização fora do seu acesso.',403);}
  const role=initialOwner?'Administrador':v.role,city=initialOwner?null:v.cityId,amb=initialOwner?null:v.ambassadorId;
  await scope(v.organizationId,city,amb,role);
  if(await row('SELECT id FROM app_users WHERE organization_id=? AND lower(email)=?',v.organizationId,v.email))throw new TenantError('Este e-mail já possui vínculo. Use a gestão de membros.');
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join(''),hash=await digest(token);
  await db.batch([db.prepare('INSERT INTO organization_invites(id,organization_id,email,name,role,city_id,ambassador_id,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),v.organizationId,v.email,v.name,role,city,amb,hash,new Date(Date.now()+v.days*86400000).toISOString(),actor,now),auditStatement(v.organizationId,actor,'invite_created','Convite preparado, sem envio de mensagem.')]);return {token};
 }
 requireAdmin(a);const org=a.organizationId;
 if(action==='revoke_invite'){
  const v=z.object({id:z.string().uuid()}).parse(input);if(!await row('SELECT id FROM organization_invites WHERE id=? AND organization_id=?',v.id,org))throw new TenantError('Convite fora do seu acesso.',403);
  await db.batch([db.prepare('UPDATE organization_invites SET revoked_at=? WHERE id=? AND organization_id=? AND accepted_at IS NULL').bind(now,v.id,org),auditStatement(org,actor,'invite_revoked','Convite revogado.')]);return {};
 }
 if(action==='member'){
  const v=z.object({id,...memberFields,active:z.boolean(),reason}).parse(input);const target=await row('SELECT * FROM app_users WHERE id=? AND organization_id=?',v.id,org);if(!target)throw new TenantError('Membro fora do seu acesso.',403);
  await scope(org,v.cityId,v.ambassadorId,v.role);
  if(!a.isOrganizationOwner&&(target.role==='Administrador'||v.role==='Administrador'))throw new TenantError('Somente o proprietário altera administradores.',403);
  if(v.id===a.id&&!v.active)throw new TenantError('Peça ao proprietário para suspender seu vínculo.');
  await db.batch([db.prepare('UPDATE app_users SET role=?,city_id=?,ambassador_id=?,active=? WHERE id=? AND organization_id=?').bind(v.role,v.cityId,v.ambassadorId,Number(v.active),v.id,org),auditStatement(org,actor,'member_updated',v.reason)]);return {};
 }
 if(action==='transfer'){
  if(!a.isOrganizationOwner)throw new TenantError('Somente o proprietário pode transferir o ambiente.',403);
  const v=z.object({memberId:id,confirmed:z.literal(true),reason}).parse(input);const target=await row("SELECT email FROM app_users WHERE id=? AND organization_id=? AND active=1 AND role='Administrador' AND city_id IS NULL",v.memberId,org);if(!target)throw new TenantError('Selecione um administrador ativo sem restrição de cidade.');
  if(org===1)throw new TenantError('A propriedade da organização principal deve permanecer com o fundador.');
  await db.batch([db.prepare('UPDATE organizations SET owner_email=? WHERE id=? AND owner_email=?').bind(String(target.email),org,a.email),db.prepare('UPDATE settings SET owner_email=?,updated_at=?,updated_by=? WHERE organization_id=?').bind(String(target.email),now,actor,org),auditStatement(org,actor,'ownership_transferred',v.reason)]);return {};
 }
 if(action==='profile'){
  const v=z.object({name:z.string().trim().min(2).max(120),objective:z.string().trim().max(1000),onboarding:z.object({pilotCityId:id.nullable(),responsibles:z.string().max(500),goals:z.string().max(1000),firstRecord:z.string().max(500)}),logo:z.string().max(210000).nullable(),official:z.boolean()}).parse(input);
  if(v.onboarding.pilotCityId)await scope(org,v.onboarding.pilotCityId,null,'Administrador');
  if(v.logo)await validateLogo(org,v.logo,v.official);
  await db.batch([db.prepare('UPDATE organizations SET name=? WHERE id=?').bind(v.name,org),db.prepare('INSERT INTO organization_profiles(organization_id,objective,onboarding,logo,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET objective=excluded.objective,onboarding=excluded.onboarding,logo=excluded.logo,updated_at=excluded.updated_at').bind(org,v.objective,JSON.stringify(v.onboarding),v.logo,now),auditStatement(org,actor,'profile_updated','Identidade e configuração inicial atualizadas.')]);return {};
 }
 throw new TenantError('Ação não reconhecida.');
}
