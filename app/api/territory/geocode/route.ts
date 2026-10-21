import {organizationFromRequest} from '@/lib/tenant-request';
import { env } from 'cloudflare:workers';
import {getCurrentUser} from '@/app/auth';
import { getTeamAccess } from '@/db/access';
import { canAccessCity } from '@/lib/expansion-permissions';
import { database } from '@/db/runtime';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem não permitida.'},{status:403,headers});
  const u=await getCurrentUser();if(!u)return Response.json({error:'Entre para acessar.'},{status:401,headers});
  const a=await getTeamAccess(u.email,u.displayName,organizationFromRequest(request));if(!a||!['Administrador','Coordenação','Líder','Comercial'].includes(a.role))return Response.json({error:'Acesso não autorizado.'},{status:403,headers});
  const body=await request.json();if(!Number.isInteger(body.cityId)||!canAccessCity(a,body.cityId))return Response.json({error:'Cidade fora do seu acesso.'},{status:403,headers});
  if(body.kind==='person')return Response.json({error:'Pessoas usam somente o centro da cidade. Não envie dados pessoais para geocodificação.'},{status:400,headers});
  const query=String(body.query??'').trim();if(query.length<3||query.length>160)return Response.json({error:'Informe um bairro ou local comercial de 3 a 160 caracteres.'},{status:400,headers});
  const key=(env as unknown as {MAPTILER_GEOCODING_KEY?:string}).MAPTILER_GEOCODING_KEY;
  const c=(await database().prepare('SELECT name,state FROM cities WHERE id=? AND organization_id=?').bind(body.cityId,a.organizationId).all()).results[0];if(!c)return Response.json({error:'Cidade não encontrada.'},{status:404,headers});
  if(!key){
   // Sem chave do MapTiler: busca gratuita do OpenStreetMap (Nominatim), uma consulta por clique,
   // dentro da política de uso deles (identificação do sistema, sem buscas em massa).
   const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=5&accept-language=pt-BR&q=${encodeURIComponent(`${query}, ${c.name}, ${c.state}, Brasil`)}`;
   const osm=await fetch(url,{headers:{'User-Agent':'EliteExpansionX/1.0 (mapa territorial)','Referer':new URL(request.url).origin},signal:AbortSignal.timeout(7000)});
   if(!osm.ok)throw new Error('provider');
   const found=await osm.json() as Array<{display_name?:string;lat?:string;lon?:string}>;
   const results=found.map(f=>({name:f.display_name??'Local encontrado',latitude:Number(f.lat),longitude:Number(f.lon)})).filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude));
   return Response.json({results,attribution:'© OpenStreetMap'},{headers});
  }
  const suffix=body.kind==='person'?'&types=neighbourhood,locality,municipality':'';
  const upstream=await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(`${query}, ${c.name}, ${c.state}, Brasil`)}.json?key=${encodeURIComponent(key)}&country=br&limit=5&language=pt${suffix}`,{signal:AbortSignal.timeout(7000)});
  if(!upstream.ok)throw new Error('provider');
  const result=await upstream.json() as {features?:Array<{place_name?:string;text?:string;geometry?:{coordinates:number[]}}>};
  const results=(result.features??[]).filter(f=>f.geometry?.coordinates?.length===2&&f.geometry.coordinates.every(Number.isFinite)).map(f=>({name:f.place_name??f.text??'Local encontrado',longitude:f.geometry!.coordinates[0],latitude:f.geometry!.coordinates[1]}));
  return Response.json({results,attribution:'MapTiler / OpenStreetMap'},{headers});
 }catch{return Response.json({error:'Serviço de busca indisponível. Os campos permanecem preenchidos; ajuste o pino ou salve como pendente.'},{status:503,headers});}
}
