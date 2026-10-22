'use client';
import {useEffect,useRef,useState} from 'react';
import type {AccessView} from '@/lib/expansion-types';
import {tenantFetch} from '@/lib/tenant-request';

type OrganizationItem={id:number;name:string;role:string};

/** Abre a organização escolhida nesta aba. Outras abas continuam onde estão. */
function openOrganization(id:number){const url=new URL(window.location.href);url.searchParams.set('org',String(id));url.searchParams.delete('area');url.searchParams.delete('ver');window.location.assign(url.toString());}

export function OrganizationSwitcher({access}:{access:AccessView}){
 const [items,setItems]=useState<OrganizationItem[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);

 useEffect(()=>{
  const controller=new AbortController();
  tenantFetch('/api/organizations',{signal:controller.signal})
   .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);return body;})
   .then(body=>setItems(body.organizations))
   .catch(e=>{if(!controller.signal.aborted&&navigator.onLine)setError(e.message);}); // sem sinal, a faixa de conexão já avisa
  return()=>controller.abort();
 },[]);

 async function change(organizationId:number){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const response=await tenantFetch('/api/organizations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'switch',organizationId})});
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||'Não foi possível trocar de organização.');
   openOrganization(result.organizationId);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir. Confira a conexão e tente de novo.');}
  finally{lock.current=false;setBusy(false);}
 }

 const own=items.filter(o=>o.role!=='Assessoria Elite'),advised=items.filter(o=>o.role==='Assessoria Elite');
 // Com uma organização só, não há o que escolher: o nome já aparece no menu.
 if(items.length<=1&&!error)return null;
 return <div className="flex min-w-0 flex-col items-end gap-1">
  <select aria-label="Organização atual" className="max-w-[11rem] truncate rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-sm text-white sm:max-w-60" value={access.organizationId} disabled={busy||!items.length}
   onChange={e=>change(Number(e.target.value))}>
   {!items.length&&<option value={access.organizationId}>{access.organizationName}</option>}
   {own.length>0&&<optgroup label="Minhas organizações">{own.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>}
   {advised.length>0&&<optgroup label="Assessoria Elite">{advised.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>}
  </select>
  {error&&<p role="alert" className="max-w-64 text-xs text-amber-200">{error}</p>}
 </div>;
}
