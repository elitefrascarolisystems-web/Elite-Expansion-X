import {env} from 'cloudflare:workers';
import {getCurrentUser} from '@/app/auth';
import {getTeamAccess} from '@/db/access';
import {organizationFromRequest} from '@/lib/tenant-request';
import {getPlan} from '@/db/plan';
export const dynamic='force-dynamic';const headers={'Cache-Control':'no-store'};
export async function GET(r:Request){try{const u=await getCurrentUser();if(!u)return Response.json({error:'Sua sessão terminou. Entre de novo para continuar.'},{status:401,headers});const a=await getTeamAccess(u.email,u.displayName,organizationFromRequest(r));if(!a)return Response.json({error:'Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar.'},{status:403,headers});const e=env as unknown as Record<string,string>;const approved=e.MAPS_EXTERNAL_ENABLED==='true'&&(await getPlan(a.organizationId)).externalMaps,key=e.PUBLIC_MAPTILER_KEY;const style=(id?:string)=>approved&&key&&id&&/^[a-zA-Z0-9_-]+$/.test(id)?`https://api.maptiler.com/maps/${id}/style.json?key=${encodeURIComponent(key)}`:null;return Response.json({satellite:style(e.PUBLIC_MAPTILER_SATELLITE_ID),hybrid:style(e.PUBLIC_MAPTILER_HYBRID_ID),streetView:approved&&!!e.PUBLIC_GOOGLE_EMBED_KEY&&!!e.GOOGLE_STREETVIEW_SERVER_KEY,provider:'MapTiler / Google',externalEnabled:approved},{headers});}catch{return Response.json({error:'Configuração indisponível.'},{status:503,headers});}}
