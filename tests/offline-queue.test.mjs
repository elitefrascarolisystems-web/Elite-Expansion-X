import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const q=await vite.ssrLoadModule('/lib/offline-queue.ts');

const base=(id,extra={})=>({id,organizationId:7,email:'campo@elite.com',cityId:3,label:id,createdAt:'2026-10-22T10:00:00.000Z',status:'pendente',...extra});
const place=(id,extra)=>({...base(id,extra),kind:'place',placeType:'Empresa',data:{id,cityId:3,name:id}});
const person=(id,placeId=null,extra)=>({...base(id,extra),kind:'person',placeId,data:{requestId:id,cityId:3,name:id,placeId},role:'',responsible:'Campo'});
// Servidor de mentira: registra as chamadas e responde conforme a regra do teste.
function server(rule=()=>({ok:true})){
 const calls=[];
 const post=async(url,body,org)=>{calls.push({url,action:body.action,data:body.data,org});const r=rule(url,body,calls.length);if(r instanceof Error)throw r;return r.ok===false?Promise.reject(Object.assign(new Error(r.error),r.meta)):{ok:true,result:{id:body.data.requestId??body.data.id}};};
 return {calls,post};
}

test('fila sem internet: envia local, depois pessoa e papel, na organização de cada cadastro',async()=>{
 const items=[place('padaria'),{...person('ana','padaria'),role:'Embaixador'},person('bia',null,{organizationId:9})];
 const s=server();
 const r=await q.flushQueue(items,'Campo@Elite.com',s.post);
 assert.equal(r.sent,3);assert.deepEqual(r.items,[]);assert.equal(r.offline,false);
 assert.deepEqual(s.calls.map(c=>[c.url,c.action,c.org]),[['/api/commercial','business',7],['/api/territory','person',7],['/api/territory','role',7],['/api/territory','person',9]]);
 assert.equal(s.calls[2].data.personId,'ana','o papel vai para a pessoa criada');
 assert.equal(s.calls[1].data.confirmDuplicate,false);
});

test('fila sem internet: sem conexão para tudo e guarda; outra pessoa no aparelho não envia',async()=>{
 const items=[person('ana'),person('bia'),person('outro',null,{email:'outra@elite.com'})];
 const s=server((url,body,n)=>n===2?q.offlineError():{ok:true});
 const r=await q.flushQueue(items,'campo@elite.com',s.post);
 assert.equal(r.offline,true);assert.equal(r.sent,1);
 assert.deepEqual(r.items.map(i=>[i.id,i.status]),[['bia','pendente'],['outro','pendente']]);
 assert.ok(!s.calls.some(c=>c.data.name==='outro'),'cadastro de outra pessoa fica intocado');
 assert.deepEqual(q.itemsFor(r.items,7,'CAMPO@elite.com').map(i=>i.id),['bia']);
});

test('fila sem internet: duplicado vai para revisão; "é outra pessoa" reenvia confirmando',async()=>{
 const s=server((url,body)=>body.action==='person'&&!body.data.confirmDuplicate?{ok:false,error:'Já existe Ana nesta cidade.',meta:{duplicate:true,status:409}}:{ok:true});
 let r=await q.flushQueue([person('ana')],'campo@elite.com',s.post);
 assert.deepEqual(r.items.map(i=>[i.status,i.duplicate,i.message]),[['revisar',true,'Já existe Ana nesta cidade.']]);
 const again=await q.flushQueue(r.items,'campo@elite.com',s.post);
 assert.equal(again.sent,0,'em revisão não é reenviado sozinho');
 r=await q.flushQueue(q.confirmDuplicate(r.items,'ana'),'campo@elite.com',s.post);
 assert.equal(r.sent,1);assert.equal(s.calls.at(-1).data.confirmDuplicate,true);
});

test('fila sem internet: pessoa espera o local; erro do servidor tenta de novo; descartar leva as pessoas do local',async()=>{
 const s=server((url,body)=>body.action==='business'?{ok:false,error:'Serviço indisponível.',meta:{status:503}}:{ok:true});
 const items=[place('loja'),person('ana','loja'),person('bia')];
 const r=await q.flushQueue(items,'campo@elite.com',s.post);
 assert.equal(r.sent,1,'só a pessoa sem local foi');
 assert.deepEqual(r.items.map(i=>[i.id,i.status]),[['loja','pendente'],['ana','pendente']]);
 assert.equal(r.items[0].message,'Serviço indisponível.');
 assert.equal(q.waitingPlace(r.items[1],r.items)?.id,'loja');
 assert.ok(!s.calls.some(c=>c.data.name==='ana'),'pessoa não foi enviada antes do local');
 const recusado=await q.flushQueue(items,'campo@elite.com',server((url,body)=>body.action==='business'?{ok:false,error:'Empresa já cadastrada.',meta:{status:400}}:{ok:true}).post);
 assert.equal(recusado.items[0].status,'revisar');
 assert.deepEqual(q.discard(recusado.items,'loja'),[]);
});

test('fila sem internet: armazenamento corrompido vira fila vazia',()=>{
 assert.deepEqual(q.parseQueue(null),[]);assert.deepEqual(q.parseQueue('{x'),[]);assert.deepEqual(q.parseQueue('{"a":1}'),[]);
 assert.deepEqual(q.parseQueue(JSON.stringify([person('ana'),{kind:'outro',id:'x'},null])).map(i=>i.id),['ana']);
});
