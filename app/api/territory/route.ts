import {organizationFromRequest} from '@/lib/tenant-request';
import {getCurrentUser} from '@/app/auth';
import { getUserAccess } from '@/db/access';
import { getTerritory, mutateTerritory, TerritoryError } from '@/db/territory';
import { ZodError } from 'zod';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function access(request:Request){const u=await getCurrentUser();if(!u) throw new TerritoryError('Entre para acessar.',401);const a=await getUserAccess(u.email,u.displayName,organizationFromRequest(request));if(!a)throw new TerritoryError('Acesso não autorizado.',403);return a;}
function failure(e:unknown){return Response.json({error:e instanceof ZodError?e.issues[0]?.message:e instanceof TerritoryError?e.message:'Não foi possível acessar o território. Tente novamente.'},{status:e instanceof TerritoryError?e.status:e instanceof ZodError?400:503,headers});}
export async function GET(request:Request){try{return Response.json(await getTerritory(await access(request),new URL(request.url).searchParams),{headers});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin) throw new TerritoryError('Origem não permitida.',403);
 const a=await access(request);const payload=await request.json();const result=await mutateTerritory(a,payload.action,payload.data);return Response.json({ok:true,result},{headers});
}catch(e){return failure(e);}}
