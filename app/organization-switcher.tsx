'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {AccessView} from '@/lib/expansion-types';
import {tenantFetch} from '@/lib/tenant-request';

type OrganizationItem={id:number;name:string;role:string};
type Advisor={email:string;name:string;active:boolean;eliteMember:boolean;grantedAt:string;revokedAt:string|null};

/** Abre a organização escolhida nesta aba. Outras abas continuam onde estão. */
function openOrganization(id:number){const url=new URL(window.location.href);url.searchParams.set('org',String(id));window.location.assign(url.toString());}

const inputClass='rounded border border-white/20 bg-zinc-900 p-3';

export function OrganizationSwitcher({access}:{access:AccessView}){
 const [items,setItems]=useState<OrganizationItem[]>([]);
 const [advisors,setAdvisors]=useState<Advisor[]|null>(null);
 const [dialog,setDialog]=useState<'create'|'advisors'|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState({name:'',ownerName:'',ownerEmail:''}),[advisorEmail,setAdvisorEmail]=useState('');
 const lock=useRef(false),requestId=useRef<string|null>(null);

 useEffect(()=>{
  const controller=new AbortController();
  tenantFetch('/api/organizations',{signal:controller.signal})
   .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);return body;})
   .then(body=>{setItems(body.organizations);if(body.advisors)setAdvisors(body.advisors);})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[]);

 async function act(body:unknown){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const response=await tenantFetch('/api/organizations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||'Não foi possível salvar.');
   return result;
  }catch(e){setError(e instanceof Error?e.message:'Falha na solicitação.');}
  finally{lock.current=false;setBusy(false);}
 }

 const own=items.filter(o=>o.role!=='Assessoria Elite'),advised=items.filter(o=>o.role==='Assessoria Elite');
 const closeDialog=(value:boolean)=>{if(!busy&&!value){setDialog(null);setError('');}};

 return <div className="flex flex-col items-start gap-1">
  <label className="text-xs text-zinc-400">Organização
   <select aria-label="Organização atual" className="ml-2 max-w-52 rounded-md border border-white/20 bg-zinc-950 p-2 text-white" value={access.organizationId} disabled={busy||!items.length}
    onChange={async e=>{const result=await act({action:'switch',organizationId:Number(e.target.value)});if(result)openOrganization(result.organizationId);}}>
    {!items.length&&<option value={access.organizationId}>{access.organizationName}</option>}
    {own.length>0&&<optgroup label="Minhas organizações">{own.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>}
    {advised.length>0&&<optgroup label="Assessoria Elite">{advised.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>}
   </select>
  </label>

  {access.isPlatformOwner&&<div className="flex gap-1">
   <Button size="sm" variant="ghost" onClick={()=>{requestId.current=crypto.randomUUID();setForm({name:'',ownerName:'',ownerEmail:''});setDialog('create');setError('');}}>Nova organização</Button>
   <Button size="sm" variant="ghost" onClick={()=>{setDialog('advisors');setError('');}}>Assessores</Button>
  </div>}
  {error&&!dialog&&<p role="alert" className="max-w-64 text-xs text-amber-200">{error}</p>}

  <Dialog open={dialog==='create'} onOpenChange={closeDialog}>
   <DialogContent className="bg-zinc-950 text-white">
    <DialogHeader>
     <DialogTitle>Criar organização de cliente</DialogTitle>
     <DialogDescription>O ambiente começa vazio. O responsável indicado vira o dono e administrador da empresa. O time Elite não entra como membro: acompanha pela Assessoria Elite, de forma visível para o cliente. Nenhum convite, assinatura ou cobrança é ativado.</DialogDescription>
    </DialogHeader>
    <form className="grid gap-4" onSubmit={async e=>{e.preventDefault();const result=await act({action:'create',data:{...form,requestId:requestId.current}});if(result){setDialog(null);openOrganization(result.id);}}}>
     <label className="grid gap-2">Nome da empresa<input required minLength={2} maxLength={120} className={inputClass} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="grid gap-2">Nome do responsável<input required minLength={2} maxLength={120} className={inputClass} value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})}/></label>
     <label className="grid gap-2">E-mail do responsável<input required type="email" maxLength={254} className={inputClass} value={form.ownerEmail} onChange={e=>setForm({...form,ownerEmail:e.target.value})}/></label>
     {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
     <Button disabled={busy} type="submit">{busy?'Criando…':'Criar ambiente do cliente'}</Button>
    </form>
   </DialogContent>
  </Dialog>

  <Dialog open={dialog==='advisors'} onOpenChange={closeDialog}>
   <DialogContent className="bg-zinc-950 text-white">
    <DialogHeader>
     <DialogTitle>Assessoria Elite</DialogTitle>
     <DialogDescription>Assessores podem ver e editar as organizações clientes para mentoria e suporte. Os clientes veem quem tem esse acesso, e cada alteração fica registrada. Só membros ativos da Elite Frascaroli Academy podem ser assessores; quem sair do time perde o acesso automaticamente.</DialogDescription>
    </DialogHeader>
    <ul className="grid gap-2">
     {(advisors??[]).map(a=><li key={a.email} className="flex items-center justify-between gap-3 rounded border border-white/10 p-3">
      <div><p className="font-medium">{a.name||a.email}</p><p className="text-xs text-zinc-500">{a.email}{!a.active?' · acesso retirado':!a.eliteMember?' · fora do time Elite (sem acesso)':''}</p></div>
      {a.email===access.email.toLowerCase()
       ?<span className="text-xs text-zinc-500">Dono da plataforma</span>
       :<Button size="sm" variant="outline" disabled={busy} className="border-white/10 bg-white/5 text-white"
         onClick={async()=>{const result=await act({action:'advisor',data:{email:a.email,active:!a.active}});if(result)setAdvisors(result.advisors);}}>{a.active?'Retirar':'Reativar'}</Button>}
     </li>)}
    </ul>
    <form className="grid gap-2" onSubmit={async e=>{e.preventDefault();const result=await act({action:'advisor',data:{email:advisorEmail,active:true}});if(result){setAdvisors(result.advisors);setAdvisorEmail('');}}}>
     <label className="grid gap-2">Adicionar assessor (e-mail de um membro da Elite)<input required type="email" maxLength={254} className={inputClass} value={advisorEmail} onChange={e=>setAdvisorEmail(e.target.value)}/></label>
     {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
     <Button disabled={busy} type="submit">{busy?'Salvando…':'Conceder assessoria'}</Button>
    </form>
   </DialogContent>
  </Dialog>
 </div>;
}
