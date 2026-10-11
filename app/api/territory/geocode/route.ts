import {organizationFromRequest} from '@/lib/tenant-request';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getUserAccess } from '@/db/access';
import { canAccessCity } from '@/lib/expansion-permissions';
import { database } from '@/db/runtime';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem não permitida.'},{status:403,headers});
  const u=await getChatGPTUser();if(!u)return Response.json({error:'Entre para acessar.'},{status:401,headers});
  const a=await getUserAccess(u.email,u.displayName,organizationFromRequest(request));if(!a||!['Administrador','Coordenação','Líder'].includes(a.role))return Response.json({error:'Acesso não autorizado.'},{status:403,headers});
  const body=await request.json();if(!Number.isInteger(body.cityId)||!canAccessCity(a,body.cityId))return Response.json({error:'Cidade fora do seu acesso.'},{status:403,headers});
  if(body.kind==='person')return Response.json({error:'Pessoas usam somente o centro da cidade. Não envie dados pessoais para geocodificação.'},{status:400,headers});
  const query=String(body.query??'').trim();if(query.length<3||query.length>160)return Response.json({error:'Informe um bairro ou local comercial de 3 a 160 caracteres.'},{status:400,headers});
  const key=(env as unknown as {MAPTILER_GEOCODING_KEY?:string}).MAPTILER_GEOCODING_KEY;
  if(!key)return Response.json({error:'Busca de endereços ainda não configurada. Ajuste o pino manualmente ou salve como localização pendente.'},{status:503,headers});
  const c=(await database().prepare('SELECT name,state FROM cities WHERE id=? AND organization_id=?').bind(body.cityId,a.organizationId).all()).results[0];if(!c)return Response.json({error:'Cidade não encontrada.'},{status:404,headers});
  const suffix=body.kind==='person'?'&types=neighbourhood,locality,municipality':'';
  const upstream=await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(`${query}, ${c.name}, ${c.state}, Brasil`)}.json?key=${encodeURIComponent(key)}&country=br&limit=5&language=pt${suffix}`,{signal:AbortSignal.timeout(7000)});
  if(!upstream.ok)throw new Error('provider');
  const result=await upstream.json() as {features?:Array<{place_name?:string;text?:string;geometry?:{coordinates:number[]}}>};
  const results=(result.features??[]).filter(f=>f.geometry?.coordinates?.length===2&&f.geometry.coordinates.every(Number.isFinite)).map(f=>({name:f.place_name??f.text??'Local encontrado',longitude:f.geometry!.coordinates[0],latitude:f.geometry!.coordinates[1]}));
  return Response.json({results,attribution:'MapTiler / OpenStreetMap'},{headers});
 }catch{return Response.json({error:'Serviço de busca indisponível. Os campos permanecem preenchidos; ajuste o pino ou salve como pendente.'},{status:503,headers});}
}
