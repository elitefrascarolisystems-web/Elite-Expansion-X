import {getCurrentUser} from '@/app/auth';
import {getUserAccess} from '@/db/access';
import {organizationFromRequest} from '@/lib/tenant-request';
import {CommercialError} from '@/db/commercial';
import {getFollowup,saveFollowup,getNetwork,linkReferral} from '@/db/followup';
import {ZodError} from 'zod';
export const dynamic='force-dynamic';const headers={'Cache-Control':'no-store'};
async function access(r:Request){const u=await getCurrentUser();if(!u)throw new CommercialError('Entre para acessar.',401);const a=await getUserAccess(u.email,u.displayName,organizationFromRequest(r));if(!a)throw new CommercialError('Acesso não autorizado.',403);return a;}
function failure(e:unknown){return Response.json({error:e instanceof ZodError?e.issues[0]?.message:e instanceof CommercialError?e.message:'Não foi possível concluir. Recarregue a ficha antes de repetir.'},{status:e instanceof CommercialError?e.status:e instanceof ZodError?400:503,headers});}
export async function GET(r:Request){try{const a=await access(r),p=new URL(r.url).searchParams;return Response.json(p.get('mode')==='network'?await getNetwork(a,p):await getFollowup(a,p),{headers});}catch(e){return failure(e);}}
export async function POST(r:Request){try{if(r.headers.get('origin')!==new URL(r.url).origin)throw new CommercialError('Origem não permitida.',403);const text=await r.text();if(text.length>12000)throw new CommercialError('Solicitação muito grande.');const a=await access(r),body=JSON.parse(text);return Response.json({ok:true,result:body.action==='referral'?await linkReferral(a,body.data):body.action==='followup'?await saveFollowup(a,body.data):(()=>{throw new CommercialError('Ação inválida.');})()},{headers});}catch(e){return failure(e);}}
