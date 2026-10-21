import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getUserAccess} from '@/db/access';
import {ActionError} from '@/db/mutations';
import {getProspects,saveProspects,ProspectError} from '@/db/prospects';
import {organizationIdFromCookie} from '@/lib/organization-selection';
import {ZodError} from 'zod';
export const dynamic='force-dynamic';const headers={'Cache-Control':'no-store'};
async function access(r:Request){const u=await getChatGPTUser();if(!u)throw new ProspectError('Entre para acessar.',401);const a=await getUserAccess(u.email,u.displayName,organizationIdFromCookie(r.headers.get('cookie')));if(!a)throw new ProspectError('Acesso não autorizado.',403);return a;}
function failure(e:unknown){const duplicate=e instanceof Error&&e.message.includes('UNIQUE constraint');const status=e instanceof ProspectError?e.status:e instanceof ZodError||e instanceof ActionError?400:duplicate?409:503;return Response.json({error:e instanceof ZodError?e.issues[0]?.message:e instanceof ProspectError||e instanceof ActionError?e.message:duplicate?'Contato já cadastrado.':'Não foi possível concluir. Atualize a lista antes de tentar novamente.'},{status,headers});}
export async function GET(r:Request){try{const a=await access(r);return Response.json(await getProspects(a,new URL(r.url).searchParams),{headers});}catch(e){return failure(e);}}
export async function POST(r:Request){try{if(r.headers.get('origin')!==new URL(r.url).origin)throw new ProspectError('Origem não permitida.',403);if(Number(r.headers.get('content-length')||0)>300000)throw new ProspectError('Lote excede o limite. Envie menos contatos por vez.');const a=await access(r),body=await r.json();return Response.json({ok:true,result:await saveProspects(a,body.action,body.data)},{headers});}catch(e){return failure(e);}}
