'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapInstance, Marker } from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerritoryIcon } from '@/app/territory-icons';
import { mapStyle, type TerritoryTheme } from '@/lib/territory-appearance';
import { Button } from '@/components/ui/button';
import type { TerritoryRecord } from '@/lib/territory-types';
export function TerritoryCanvas({records,onSelect,onPick,focus,fitToken=0,theme='mixed',roleFilter='',onViewport}:{onViewport?:(bounds:string)=>void;theme?:TerritoryTheme;roleFilter?:string;records:TerritoryRecord[];onSelect:(items:TerritoryRecord[])=>void;onPick?:(lat:number,lng:number)=>void;focus?:TerritoryRecord|null;fitToken?:number}){
 const host=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),markers=useRef<Marker[]>([]);
 const props=useRef({records,onSelect,onPick,theme,roleFilter,focus,onViewport});
 useEffect(()=>{props.current={records,onSelect,onPick,theme,roleFilter,focus,onViewport};},[records,onSelect,onPick,theme,roleFilter,focus,onViewport]);
 const [fallback,setFallback]=useState(false);
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
     if(count>1)el.textContent=String(count);else {el.innerHTML=renderToStaticMarkup(<TerritoryIcon roles={first.roles} kind={first.kind} filter={props.current.roleFilter}/>);if(first.roles.length>2){const badge=document.createElement('span');badge.className='territory-role-count';badge.textContent='+';el.append(badge);}}el.dataset.selected=String(group.items.some(r=>r.key===props.current.focus?.key));
     el.title=count>1?`${count} registros · ${people} pessoas únicas neste agrupamento`:`${first.name} · ${first.roles.join(', ')} · ${first.status}`;el.setAttribute('aria-label',el.title);if(count===1){const status=document.createElement('span');status.className='territory-pin-status';status.textContent=({Ativo:'AT',Ativa:'AT',Pausado:'PA',Inativo:'IN','Em treinamento':'TR',Convidado:'CO',Cliente:'PG'} as Record<string,string>)[first.status]??'•';status.setAttribute('aria-hidden','true');el.append(status);}
     el.onclick=()=>{props.current.onSelect(group.items);if(count>1&&instance.getZoom()<16)instance.easeTo({center:[loc.longitude!,loc.latitude!],zoom:instance.getZoom()+2});};
     markers.current.push(new m.Marker({element:el}).setLngLat([loc.longitude!,loc.latitude!]).addTo(instance));
    }
   }
   instance.on('load',()=>{setLoaded(true);paint();});instance.on('style.load',()=>{setError('');paint();});instance.on('moveend',()=>{paint();const b=instance.getBounds();props.current.onViewport?.([Math.min(180,Math.max(-180,b.getWest())),Math.max(-85,b.getSouth()),Math.max(-180,Math.min(180,b.getEast())),Math.min(85,b.getNorth())].map(n=>n.toFixed(6)).join(','));});
   instance.on('elite-data',paint);
   instance.on('click',e=>props.current.onPick?.(e.lngLat.lat,e.lngLat.lng));
   instance.on('error',()=>setError('O mapa não carregou completamente. Os cadastros continuam disponíveis na lista.'));
   observer=new ResizeObserver(()=>instance.resize());observer.observe(host.current);
  }).catch(()=>setError('Não foi possível abrir o mapa neste dispositivo. Use a lista de registros.'));
  return()=>{cancelled=true;observer?.disconnect();markers.current.forEach(m=>m.remove());map.current?.remove();map.current=null;};
 },[retry]);
 useEffect(()=>{if(loaded)map.current?.fire('elite-data');},[records,loaded,roleFilter,focus]);
 useEffect(()=>{if(map.current)map.current.setStyle(fallback?{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm-fallback',type:'raster',source:'osm'}]}:mapStyle(theme));},[theme,fallback]);
 useEffect(()=>{const l=focus?.location;if(l?.latitude!=null&&l.longitude!=null)map.current?.easeTo({center:[l.longitude,l.latitude],zoom:l.precision==='Cidade'?11:14});},[focus]);
 useEffect(()=>{if(!loaded)return;const coords=props.current.records.flatMap(r=>r.location?.latitude!=null&&r.location.longitude!=null?[[r.location.longitude,r.location.latitude]]:[]);if(!coords.length)return;const lng=coords.map(p=>p[0]),lat=coords.map(p=>p[1]);map.current?.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],{padding:65,maxZoom:13});},[fitToken,loaded]); // explicit fit action preserves manual exploration
 return <div className="territory-canvas-wrap">{fallback&&<p className="territory-fallback-notice">Cartografia alternativa clara · aparência dos painéis preservada</p>}<div ref={host} className="territory-canvas" aria-label="Mapa geográfico navegável" />{!loaded&&!error&&<p className="territory-map-message" role="status">Carregando cartografia…</p>}{error&&<div className="territory-map-message" role="alert">{error}<Button variant="outline" onClick={()=>{setError('');setLoaded(false);setFallback(false);setRetry(v=>v+1);}}>Carregar mapa novamente</Button><Button variant="outline" onClick={()=>{setError('');setFallback(v=>!v);}}>{fallback?'Voltar ao estilo escolhido':'Usar ruas padrão'}</Button></div>}</div>;
}
