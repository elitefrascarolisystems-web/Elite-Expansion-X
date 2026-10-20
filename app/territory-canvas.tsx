'use client';
import {tenantFetch} from '@/lib/tenant-request';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapInstance, Marker } from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerritoryIcon } from '@/app/territory-icons';
import { mapStyle, type TerritoryTheme } from '@/lib/territory-appearance';
import {applyBuildings,buildingLayer} from '@/lib/building-layer';
import { Button } from '@/components/ui/button';
import type { TerritoryRecord } from '@/lib/territory-types';
export function TerritoryCanvas({records,onSelect,onPick,focus,fitToken=0,theme='mixed',roleFilter='',onViewport}:{onViewport?:(bounds:string)=>void;theme?:TerritoryTheme;roleFilter?:string;records:TerritoryRecord[];onSelect:(items:TerritoryRecord[])=>void;onPick?:(lat:number,lng:number)=>void;focus?:TerritoryRecord|null;fitToken?:number}){
 const host=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),markers=useRef<Marker[]>([]);
 const props=useRef({records,onSelect,onPick,theme,roleFilter,focus,onViewport});
 useEffect(()=>{props.current={records,onSelect,onPick,theme,roleFilter,focus,onViewport};},[records,onSelect,onPick,theme,roleFilter,focus,onViewport]);
 const [mapConfig,setMapConfig]=useState<{satellite:string|null;hybrid:string|null}|null>(null),[base,setBase]=useState<'streets'|'satellite'|'hybrid'>('streets');
 useEffect(()=>{const c=new AbortController();tenantFetch('/api/map-config',{signal:c.signal}).then(r=>r.ok?r.json():null).then(v=>{if(v)setMapConfig(v);}).catch(()=>{});return()=>c.abort();},[]);
 const buildingMode=useRef(false);const [coverage,setCoverage]=useState('');
 const [fallback,setFallback]=useState(false),[perspective,setPerspective]=useState(false);
 const [error,setError]=useState(''),[loaded,setLoaded]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false;let observer:ResizeObserver|undefined;
  import('maplibre-gl').then(m=>{
   if(cancelled||!host.current)return;
   const instance=new m.Map({container:host.current,center:[-44.18,-19.86],zoom:10,renderWorldCopies:false,attributionControl:false,
    style:mapStyle(props.current.theme),maxPitch:60});
   map.current=instance;
   instance.addControl(new m.NavigationControl({visualizePitch:true}),'top-right');
   instance.addControl(new m.AttributionControl({compact:false}),'bottom-right');
   instance.addControl(new m.ScaleControl({unit:'metric'}),'bottom-left');
   function paint(){
    markers.current.forEach(marker=>marker.remove());markers.current=[];
    const groups:{point:{x:number;y:number};items:TerritoryRecord[]}[]=[];
    for(const record of props.current.records){const l=record.location;if(l?.latitude==null||l.longitude==null||!l.validated)continue;
     if(!instance.getBounds().contains([l.longitude,l.latitude]))continue;
     const point=instance.project([l.longitude,l.latitude]);let g=groups.find(g=>Math.hypot(g.point.x-point.x,g.point.y-point.y)<42);if(!g){g={point,items:[]};groups.push(g);}g.items.push(record);
    }
    for(const group of groups){const first=group.items[0],loc=first.location!,count=group.items.reduce((n,r)=>n+(r.aggregateCount??1),0),people=group.items.reduce((n,r)=>n+(r.aggregatePeople??Number(r.kind==='person')),0);
     const el=document.createElement('button');el.type='button';el.className='territory-pin';el.dataset.kind=first.kind;
     if(count>1)el.textContent=String(count);else {el.innerHTML=renderToStaticMarkup(<TerritoryIcon roles={first.roles} kind={first.kind} filter={props.current.roleFilter}/>);if(first.roles.length>2){const badge=document.createElement('span');badge.className='territory-role-count';badge.textContent='+';el.append(badge);}}el.dataset.selected=String(group.items.some(r=>r.key===props.current.focus?.key||(props.current.focus?.location?.latitude===r.location?.latitude&&props.current.focus?.location?.longitude===r.location?.longitude)));
     el.title=count>1?`${count} registros · ${people} pessoas únicas neste agrupamento`:`${first.name} · ${first.roles.join(', ')} · ${first.status}`;el.setAttribute('aria-label',el.title);if(count===1){const status=document.createElement('span');status.className='territory-pin-status';status.textContent=({Ativo:'AT',Ativa:'AT',Pausado:'PA',Inativo:'IN','Em treinamento':'TR',Convidado:'CO',Cliente:'PG'} as Record<string,string>)[first.status]??'•';status.setAttribute('aria-hidden','true');el.append(status);}
     el.onclick=()=>{props.current.onSelect(group.items);if(count>1&&instance.getZoom()<16)instance.easeTo({center:[loc.longitude!,loc.latitude!],zoom:instance.getZoom()+2});};
     markers.current.push(new m.Marker({element:el}).setLngLat([loc.longitude!,loc.latitude!]).addTo(instance));
    }
   }
   function reportViewport(){const b=instance.getBounds();props.current.onViewport?.([Math.min(180,Math.max(-180,b.getWest())),Math.max(-85,b.getSouth()),Math.max(-180,Math.min(180,b.getEast())),Math.min(85,b.getNorth())].map(n=>n.toFixed(6)).join(','));}
   instance.on('load',()=>{setLoaded(true);paint();reportViewport();});instance.on('style.load',()=>{setError('');applyBuildings(instance,buildingMode.current);paint();});instance.on('idle',()=>{if(buildingMode.current)setCoverage(instance.getZoom()<15?'Aproxime o mapa para ver os edifícios disponíveis.':instance.getLayer(buildingLayer.id)&&instance.queryRenderedFeatures({layers:[buildingLayer.id]}).length?'Volumes do provedor; alturas podem ser estimadas. Não é imagem fotográfica.':'Sem edifícios 3D disponíveis nesta área ou neste nível de aproximação.');});instance.on('moveend',()=>{paint();reportViewport();});
   instance.on('elite-data',paint);
   instance.on('click',e=>props.current.onPick?.(e.lngLat.lat,e.lngLat.lng));
   instance.on('error',()=>setError('O mapa não carregou completamente. Os cadastros continuam disponíveis na lista.'));
   observer=new ResizeObserver(()=>instance.resize());observer.observe(host.current);
  }).catch(()=>setError('Não foi possível abrir o mapa neste dispositivo. Use a lista de registros.'));
  return()=>{cancelled=true;observer?.disconnect();markers.current.forEach(m=>m.remove());map.current?.remove();map.current=null;};
 },[retry]);
 useEffect(()=>{if(loaded)map.current?.fire('elite-data');},[records,loaded,roleFilter,focus]);
 useEffect(()=>{if(map.current)map.current.setStyle(fallback?{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm-fallback',type:'raster',source:'osm'}]}:(base!=='streets'&&mapConfig?.[base])||mapStyle(theme));},[theme,fallback,base,mapConfig]);
 const focusLat=focus?.location?.latitude,focusLng=focus?.location?.longitude,focusPrecision=focus?.location?.precision;
 useEffect(()=>{if(focusLat!=null&&focusLng!=null)map.current?.easeTo({center:[focusLng,focusLat],zoom:focusPrecision==='Cidade'?11:14});},[focus?.key,focusLat,focusLng,focusPrecision]);
 useEffect(()=>{if(!loaded)return;const coords=props.current.records.flatMap(r=>r.location?.latitude!=null&&r.location.longitude!=null?[[r.location.longitude,r.location.latitude]]:[]);if(!coords.length)return;const lng=coords.map(p=>p[0]),lat=coords.map(p=>p[1]);map.current?.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],{padding:65,maxZoom:13});},[fitToken,loaded]); // explicit fit action preserves manual exploration
 useEffect(()=>{buildingMode.current=perspective;if(loaded&&map.current?.isStyleLoaded())applyBuildings(map.current,perspective);if(loaded)map.current?.easeTo({pitch:perspective?50:0,...perspective?{}:{bearing:0},duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:300});},[perspective,loaded]);
 return <div className="territory-canvas-wrap"><div className="territory-perspective">{(mapConfig?.satellite||mapConfig?.hybrid)&&<label className="block rounded bg-black/85 p-2 text-sm text-white">Mapa-base<select className="ml-2 bg-zinc-900 p-1" value={base} onChange={e=>{setFallback(false);setBase(e.target.value as typeof base);}}><option value="streets">Ruas</option>{mapConfig?.satellite&&<option value="satellite">Satélite</option>}{mapConfig?.hybrid&&<option value="hybrid">Híbrido</option>}</select></label>}<Button variant="outline" disabled={!loaded} aria-pressed={perspective} title="Volumes de edifícios conforme a cobertura do provedor. Alturas podem ser estimadas." onClick={()=>setPerspective(v=>!v)}>{perspective?'Voltar para 2D':'Edifícios em 3D'}</Button>{perspective&&<p className="max-w-60 rounded bg-black/85 p-2 text-xs text-white">{coverage||'Carregando edifícios disponíveis…'}</p>}</div>{fallback&&<p className="territory-fallback-notice">Cartografia alternativa clara · aparência dos painéis preservada</p>}<div ref={host} className="territory-canvas" aria-label="Mapa geográfico navegável" />{!loaded&&!error&&<p className="territory-map-message" role="status">Carregando cartografia…</p>}{error&&<div className="territory-map-message" role="alert">{error}<Button variant="outline" onClick={()=>{setError('');setLoaded(false);setFallback(false);setRetry(v=>v+1);}}>Carregar mapa novamente</Button><Button variant="outline" onClick={()=>{setError('');setFallback(v=>!v);}}>{fallback?'Voltar ao estilo escolhido':'Usar ruas padrão'}</Button></div>}</div>;
}
