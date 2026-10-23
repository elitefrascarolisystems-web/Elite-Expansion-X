import {organizationFromRequest} from '@/lib/tenant-request';
import {getCurrentUser} from '@/app/auth';
import {getTeamAccess} from '@/db/access';
import {getTerritoryPlaces,TerritoryError} from '@/db/territory';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
/** Locais e centros de cidade para os modos do mapa (calor, cobertura, funil, linha do tempo e cidade acesa). */
export async function GET(request:Request){try{
 const u=await getCurrentUser();if(!u)throw new TerritoryError('Sua sessão terminou. Entre de novo para continuar.',401);
 const a=await getTeamAccess(u.email,u.displayName,organizationFromRequest(request));if(!a)throw new TerritoryError('Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar.',403);
 return Response.json(await getTerritoryPlaces(a,new URL(request.url).searchParams),{headers});
}catch(e){return Response.json({error:e instanceof TerritoryError?e.message:'Não foi possível carregar os locais do mapa. Tente novamente.'},{status:e instanceof TerritoryError?e.status:503,headers});}}
