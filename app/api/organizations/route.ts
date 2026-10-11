import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getUserAccess} from '@/db/access';
import {createOrganization,listOrganizations} from '@/db/organizations';
import {organizationFromRequest} from '@/lib/tenant-request';
import {ZodError} from 'zod';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 try{const u=await getChatGPTUser();if(!u)return Response.json({error:'Entre para acessar.'},{status:401,headers});
 const a=await getUserAccess(u.email,u.displayName,organizationFromRequest(request));
 if(!a)return Response.json({error:'Organização fora do seu acesso.'},{status:403,headers});
 return Response.json({organizations:await listOrganizations(u.email),currentId:a.organizationId,canCreate:a.isPlatformOwner},{headers});
 }catch{return Response.json({error:'Não foi possível consultar as organizações.'},{status:503,headers});}
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem não permitida.'},{status:403,headers});
 try{const u=await getChatGPTUser();if(!u)return Response.json({error:'Entre para acessar.'},{status:401,headers});
 const body=await request.json();
 if(body.action==='switch'){
  if(!Number.isSafeInteger(body.organizationId)||body.organizationId<1)return Response.json({error:'Organização inválida.'},{status:400,headers});
  const target=await getUserAccess(u.email,u.displayName,body.organizationId);
  if(!target)return Response.json({error:'Organização fora do seu acesso.'},{status:403,headers});
  // Só confirma o vínculo. A troca acontece no cliente, abrindo ?org= nesta aba,
  // para não mudar a organização das outras abas abertas.
  return Response.json({ok:true,organizationId:target.organizationId},{headers});
 }
 const a=await getUserAccess(u.email,u.displayName,organizationFromRequest(request));
 if(!a?.isPlatformOwner)return Response.json({error:'Sem permissão.'},{status:403,headers});
 if(body.action!=='create')return Response.json({error:'Ação inválida.'},{status:400,headers});
 return Response.json({ok:true,id:await createOrganization(a,body.data)},{headers});
 }catch(e){return Response.json({error:e instanceof ZodError?e.issues[0]?.message:'Não foi possível salvar a organização. Tente novamente.'},{status:e instanceof ZodError?400:503,headers});}
}
