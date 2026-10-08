'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapInstance, Marker } from 'maplibre-gl';
import { Button } from '@/components/ui/button';
import type { TerritoryRecord } from '@/lib/territory-types';
export function TerritoryCanvas({records,onSelect,onPick,focus,fitToken=0}:{records:TerritoryRecord[];onSelect:(items:TerritoryRecord[])=>void;onPick?:(lat:number,lng:number)=>void;focus?:TerritoryRecord|null;fitToken?:number}){
 const host=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),markers=useRef<Marker[]>([]);
 const props=useRef({records,onSelect,onPick});
 useEffect(()=>{props.current={records,onSelect,onPick};},[records,onSelect,onPick]);
 const [error,setError]=useState(''),[loaded,setLoaded]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false;let observer:ResizeObserver|undefined;
  import('maplibre-gl').then(m=>{
   if(cancelled||!host.current)return;
   const instance=new m.Map({container:host.current,center:[-44.18,-19.86],zoom:10,attributionControl:false,
    style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'}},layers:[{id:'streets',type:'raster',source:'osm'}]},maxPitch:60});
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
    for(const group of groups){const first=group.items[0],loc=first.location!;
     const el=document.createElement('button');el.type='button';el.className='territory-pin';el.dataset.kind=first.kind;
     el.textContent=group.items.length>1?String(group.items.length):({city:'C',person:'P',partner:'◆',event:'E',action:'A'}[first.kind]);
     el.title=group.items.length>1?`${group.items.length} registros neste local`:first.name;el.setAttribute('aria-label',el.title);
     el.onclick=()=>{props.current.onSelect(group.items);if(group.items.length>1&&instance.getZoom()<16)instance.easeTo({center:[loc.longitude!,loc.latitude!],zoom:instance.getZoom()+2});};
     markers.current.push(new m.Marker({element:el}).setLngLat([loc.longitude!,loc.latitude!]).addTo(instance));
    }
   }
   instance.on('load',()=>{setLoaded(true);paint();});instance.on('moveend',paint);
   instance.on('click',e=>props.current.onPick?.(e.lngLat.lat,e.lngLat.lng));
   instance.on('error',()=>setError('O mapa não carregou completamente. Os cadastros continuam disponíveis na lista.'));
   observer=new ResizeObserver(()=>instance.resize());observer.observe(host.current);
  }).catch(()=>setError('Não foi possível abrir o mapa neste dispositivo. Use a lista de registros.'));
  return()=>{cancelled=true;observer?.disconnect();markers.current.forEach(m=>m.remove());map.current?.remove();map.current=null;};
 },[retry]);
 useEffect(()=>{if(loaded)map.current?.fire('moveend');},[records,loaded]);
 useEffect(()=>{const l=focus?.location;if(l?.latitude!=null&&l.longitude!=null)map.current?.easeTo({center:[l.longitude,l.latitude],zoom:l.precision==='Cidade'?11:14});},[focus]);
 useEffect(()=>{if(!loaded)return;const coords=props.current.records.flatMap(r=>r.location?.latitude!=null&&r.location.longitude!=null?[[r.location.longitude,r.location.latitude]]:[]);if(!coords.length)return;const lng=coords.map(p=>p[0]),lat=coords.map(p=>p[1]);map.current?.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],{padding:65,maxZoom:13});},[fitToken,loaded]); // explicit fit action preserves manual exploration
 return <div className="territory-canvas-wrap"><div ref={host} className="territory-canvas" aria-label="Mapa geográfico navegável" />{!loaded&&!error&&<p className="territory-map-message" role="status">Carregando mapa de ruas…</p>}{error&&<div className="territory-map-message" role="alert">{error}<Button variant="outline" onClick={()=>{setError('');setLoaded(false);setRetry(v=>v+1);}}>Carregar mapa novamente</Button></div>}</div>;
}
