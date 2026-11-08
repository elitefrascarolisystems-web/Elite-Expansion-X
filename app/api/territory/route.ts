import {organizationFromRequest} from '@/lib/tenant-request';
import {getCurrentUser} from '@/app/auth';
import { getTeamAccess } from '@/db/access';
import { getTerritory, listRegions, mutateTerritory, TerritoryError } from '@/db/territory';
import { importNetwork } from '@/db/network-import';
import { makePrimaryPlace, PlaceError, planVisit, registerVisit, removePersonPlace, savePersonPlace } from '@/db/person-places';
import { ZodError } from 'zod';
import { validationMessage } from "@/lib/validation-message";
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function access(request:Request){const u=await getCurrentUser();if(!u) throw new TerritoryError('Sua sessão terminou. Entre de novo para continuar.',401);const a=await getTeamAccess(u.email,u.displayName,organizationFromRequest(request));if(!a)throw new TerritoryError('Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar.',403);return a;}
function failure(e:unknown){if(e instanceof PlaceError)return Response.json({error:e.message},{status:e.status,headers});return Response.json({error:e instanceof ZodError?validationMessage(e):e instanceof TerritoryError?e.message:'Não foi possível acessar o território. Tente novamente.',...(e instanceof TerritoryError&&e.duplicate?{duplicate:true}:{})},{status:e instanceof TerritoryError?e.status:e instanceof ZodError?400:503,headers});}
export async function GET(request:Request){try{const a=await access(request);const params=new URL(request.url).searchParams;const regions=params.get('regions');if(regions)return Response.json({regions:await listRegions(a,Number(regions))},{headers});return Response.json(await getTerritory(a,params),{headers});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin) throw new TerritoryError('Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo.',403);
 const a=await access(request);const payload=await request.json();const places:Record<string,(a:Parameters<typeof savePersonPlace>[0],d:unknown)=>Promise<unknown>>={person_place:savePersonPlace,remove_person_place:removePersonPlace,primary_place:makePrimaryPlace,plant_plan:planVisit,plant_visit:registerVisit};const result=payload.action==='import_network'?await importNetwork(a,payload.data):places[payload.action]?await places[payload.action](a,payload.data):await mutateTerritory(a,payload.action,payload.data);return Response.json({ok:true,result},{headers});
}catch(e){return failure(e);}}
