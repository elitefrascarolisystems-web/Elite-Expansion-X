import {getCurrentUser} from '@/app/auth';
import {getTeamAccess} from '@/db/access';
import {createOrganization,listAdvisors,listOrganizations,OrganizationError,setAdvisor} from '@/db/organizations';
import {organizationFromRequest} from '@/lib/tenant-request';
import {saveIdentity} from '@/db/identity';
import {TenantError} from '@/db/tenant-admin';
import {ZodError} from 'zod';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};

export async function GET(request:Request){
 try{const u=await getCurrentUser();if(!u)return Response.json({error:'Sua sessão terminou. Entre de novo para continuar.'},{status:401,headers});
 const a=await getTeamAccess(u.email,u.displayName,organizationFromRequest(request));
 if(!a)return Response.json({error:'Organização fora do seu acesso.'},{status:403,headers});
 return Response.json({
  organizations:await listOrganizations(u.email),currentId:a.organizationId,canCreate:a.isPlatformOwner,isAdvisory:a.isAdvisory===true,
  advisors:a.isPlatformOwner?await listAdvisors(a):undefined,
 },{headers});
 }catch{return Response.json({error:'Não foi possível consultar as organizações.'},{status:503,headers});}
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo.'},{status:403,headers});
 try{const u=await getCurrentUser();if(!u)return Response.json({error:'Sua sessão terminou. Entre de novo para continuar.'},{status:401,headers});
 const body=await request.json();
 if(body.action==='switch'){
  if(!Number.isSafeInteger(body.organizationId)||body.organizationId<1)return Response.json({error:'Organização inválida.'},{status:400,headers});
  const target=await getTeamAccess(u.email,u.displayName,body.organizationId);
  if(!target)return Response.json({error:'Organização fora do seu acesso.'},{status:403,headers});
  // Só confirma o vínculo (próprio ou de assessoria). A troca acontece no cliente,
  // abrindo ?org= nesta aba, para não mudar a organização das outras abas abertas.
  return Response.json({ok:true,organizationId:target.organizationId,isAdvisory:target.isAdvisory===true},{headers});
 }
 const a=await getTeamAccess(u.email,u.displayName,organizationFromRequest(request));
 // Identidade (nome e logo): o administrador da própria empresa.
 if(body.action==='identity'){if(!a)return Response.json({error:'Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar.'},{status:403,headers});return Response.json({ok:true,...await saveIdentity(a,body.data)},{headers});}
 if(!a?.isPlatformOwner)return Response.json({error:'Somente os donos da plataforma podem fazer isso.'},{status:403,headers});
 if(body.action==='create')return Response.json({ok:true,id:await createOrganization(a,body.data)},{headers});
 if(body.action==='advisor')return Response.json({ok:true,advisors:await setAdvisor(a,body.data)},{headers});
 return Response.json({error:'Ação inválida.'},{status:400,headers});
 }catch(e){
  if(e instanceof ZodError)return Response.json({error:e.issues[0]?.message??'Dados inválidos.'},{status:400,headers});
  // Só mensagens escritas de propósito chegam ao usuário; erros do banco nunca.
  if(e instanceof OrganizationError||e instanceof TenantError)return Response.json({error:e.message},{status:e.status,headers});
  return Response.json({error:'Não foi possível salvar. Tente novamente.'},{status:503,headers});
 }
}
