import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'cloudflare:workers',replacement:root+'tests/fixtures/cloudflare.mjs'},{find:'@/app/auth',replacement:root+'tests/fixtures/auth.mjs'},{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
let sqlite;
function adapter(db){return {prepare(sql){let args=[];const stmt={bind(...values){if(values.length>100)throw new Error('D1_ERROR: too many SQL variables (limite de 100 do D1)');args=values.map(v=>typeof v==='boolean'?Number(v):v);return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};}};return stmt;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});
const request=(action,data)=>new Request('https://test.invalid/api/territory',{method:'POST',headers:{origin:'https://test.invalid','Content-Type':'application/json','X-Elite-Organization':'1'},body:JSON.stringify({action,data})});
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/mutations.ts'),...await vite.ssrLoadModule('/lib/expansion-validation.ts')};}
const person=(name='Pessoa teste',cityId=1)=>({cityId,name,authorized:true,leader:false,referrerId:null});
const leadData=(personId,cityId=1)=>({personId,cityId,name:'Nome informado',email:'contato@example.invalid',whatsapp:'',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Formulário de teste',consentPurpose:'Atendimento de teste'});
const ambassadorData=(personId)=>({personId,cityId:1,name:'Nome informado',code:'TEST001',status:'Convidado',level:'Indicador'});


async function setup(){
 const m={...await modules(),...await vite.ssrLoadModule('/db/commercial.ts'),...await vite.ssrLoadModule('/db/followup.ts')};
 const p=await m.mutateTerritory(m.access,'person',person('Pessoa integrada'));
 await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(p.id)),m.access);
 const id=crypto.randomUUID();
 await m.saveCommercial(m.access,'opportunity',{id,leadId:1,ownerEmail:m.access.email,temperature:'Quente',stage:'Proposta',nextAction:'Retomar conversa',dueDate:'2099-10-20'});
 return {...m,id,personId:p.id};
}
const cmd=(m,action='contact',version=1,extra={})=>({requestId:crypto.randomUUID(),opportunityId:m.id,version,action,note:'Pessoa pediu para entrar e combinar retorno.',nextAction:'Conferir retorno combinado',channel:'WhatsApp',dueAt:new Date(Date.now()+3600000).toISOString(),...extra});
const read=m=>m.getFollowup(m.access,new URLSearchParams('id='+m.id));
test('shared identity, atomic followup, existing team history and map next step',async()=>{
 const m=await setup();const v=cmd(m);await m.saveFollowup(m.access,v);
 const r=await read(m);assert.equal(r.records[0].person_id,m.personId);assert.equal(r.records[0].version,2);assert.equal(r.history.length,1);assert.equal(r.records[0].dueAt,v.dueAt);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM territory_people').get().n,1);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM commercial_activities WHERE kind='Follow-up'").get().n,1);
 const map=await m.getTerritory(m.access,new URLSearchParams('key=person:'+m.personId));assert.equal(map.records[0].nextAction,v.nextAction);assert.equal(map.records[0].dueDate,v.dueAt);
});
test('retry is idempotent, stale version and reused request with changed payload are rejected',async()=>{
 const m=await setup(),v=cmd(m);await m.saveFollowup(m.access,v);await m.saveFollowup(m.access,v);
 await assert.rejects(m.saveFollowup(m.access,{...v,note:'Changed payload'}),/Identificador/);
 await assert.rejects(m.saveFollowup(m.access,cmd(m)),/Registro alterado/);
 assert.equal((await read(m)).history.length,1);assert.equal((await read(m)).records[0].version,2);
});
test('FECHA enforces start, confirmed blocker, resolution and 72h; date can extend and future can resume',async()=>{
 const m=await setup();await m.saveFollowup(m.access,cmd(m,'start',1,{unpaid:true}));
 await assert.rejects(m.saveFollowup(m.access,cmd(m,'link',2)),/Resolva/);
 await m.saveFollowup(m.access,cmd(m,'identify',2,{blocker:'Dúvida'}));
 await m.saveFollowup(m.access,cmd(m,'resolve',3));
 await m.saveFollowup(m.access,cmd(m,'link',4));
 await assert.rejects(m.saveFollowup(m.access,cmd(m,'wait',5,{dueAt:'2099-10-20T13:00:00Z'})),/72 horas/);
 await m.saveFollowup(m.access,cmd(m,'date',5,{dueAt:'2099-10-20T13:00:00Z'}));
 await m.saveFollowup(m.access,cmd(m,'future',6));assert.equal((await read(m)).records[0].dueAt,null);
 await m.saveFollowup(m.access,cmd(m,'resume',7,{dueAt:'2099-10-21T13:00:00Z'}));assert.equal((await read(m)).records[0].fechaStatus,'resolved');
});
test('expired FECHA is outside agenda and map without a browser or scheduler write',async()=>{
 const m=await setup();await m.saveFollowup(m.access,cmd(m,'start',1,{unpaid:true}));
 sqlite.prepare("UPDATE opportunities SET followup_json=json_set(followup_json,'$.fecha.deadlineAt','2020-01-01T00:00:00Z') WHERE id=?").run(m.id);
 const r=(await read(m)).records[0];assert.equal(r.fechaStatus,'future');assert.equal(r.dueAt,null);
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('key=person:'+m.personId))).records[0].nextAction,'');
 await assert.rejects(m.saveFollowup(m.access,cmd(m,'wait',2)),/rodada terminou/);
 // A equipe comercial conta atrasos com a mesma regra da agenda: rodada vencida não é atraso.
 sqlite.prepare("UPDATE opportunities SET due_date='2020-01-01' WHERE id=?").run(m.id);
 const team=await m.getCommercial(m.access,new URLSearchParams('mode=team&day=2026-10-20'));
 assert.equal(team.pipelineTotals.reduce((n,t)=>n+Number(t.overdue),0),0);
 sqlite.prepare("UPDATE opportunities SET followup_json='{}' WHERE id=?").run(m.id);
 const again=await m.getCommercial(m.access,new URLSearchParams('mode=team&day=2026-10-20'));
 assert.equal(again.pipelineTotals.reduce((n,t)=>n+Number(t.overdue),0),1,'sem FECHA vencido, o atraso continua contando');
});
test('existing payment drives FECHA and post-sale; no duplicate sale or person',async()=>{
 const m=await setup();await assert.rejects(m.saveFollowup(m.access,cmd(m,'aftercare',1,{aftercare:'Boas-vindas'})),/pagamento confirmado/);
 await m.saveFollowup(m.access,cmd(m,'start',1,{unpaid:true}));
 await m.executeAction('record_sale',m.parseActionPayload('record_sale',{leadId:1,product:'Formação',amountCents:150000,status:'Pagamento confirmado'}),m.access);
 assert.equal((await read(m)).records[0].fechaStatus,'paid');assert.equal((await read(m)).records[0].dueAt,null);
 // Pagamento confirmado fecha a oportunidade (nova versão do registro).
 assert.equal((await read(m)).records[0].stage,'Ganho');assert.equal((await read(m)).records[0].version,3);
 await m.saveFollowup(m.access,cmd(m,'aftercare',3,{aftercare:'Boas-vindas'}));
 await m.saveFollowup(m.access,cmd(m,'aftercare',4,{aftercare:'Concluído'}));assert.equal((await read(m)).records[0].dueAt,null);
 await m.saveFollowup(m.access,cmd(m,'contact',5));assert.equal((await read(m)).records[0].followup.aftercare,'Acompanhamento');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM sales').get().n,1);
});
test('seller, city and organization scopes apply to reads and direct writes',async()=>{
 const m=await setup(),other={...m.access,role:'Comercial',email:'other@example.invalid'};
 assert.equal((await m.getFollowup(other,new URLSearchParams())).total,0);await assert.rejects(m.saveFollowup(other,cmd(m)),/fora do seu acesso/);
 for(const a of [{...m.access,role:'Líder',cityId:2},{...m.access,organizationId:99}]){assert.equal((await m.getFollowup(a,new URLSearchParams())).total,0);assert.equal((await m.getNetwork(a,new URLSearchParams())).total,0);await assert.rejects(m.saveFollowup(a,cmd(m)),/fora do seu acesso/);}
 await assert.rejects(m.getFollowup({...m.access,role:'Embaixador'},new URLSearchParams()),/perfil/);
});
test('revocation removes the person from followup and network and denies contact',async()=>{
 const m=await setup();sqlite.prepare("UPDATE leads SET consent_revoked_at='2026-10-16',status='Cancelado' WHERE id=1").run();
 assert.equal((await read(m)).total,0);assert.equal((await m.getNetwork(m.access,new URLSearchParams())).total,0);await assert.rejects(m.saveFollowup(m.access,cmd(m)),/autorização/);
});
test('referrals use existing people, reject cycles and second origin, preserve sales attribution',async()=>{
 const m=await setup(),b=await m.mutateTerritory(m.access,'person',person('Bruno')),c=await m.mutateTerritory(m.access,'person',person('Carla'));
 const link=(personId,referrerId)=>m.linkReferral(m.access,{personId,referrerId,note:'Relação confirmada'});
 await link(b.id,m.personId);await link(b.id,m.personId);await link(c.id,b.id);
 await assert.rejects(link(m.personId,c.id),/ciclo/);await assert.rejects(link(c.id,m.personId),/origem principal/);
 const root=await m.getNetwork(m.access,new URLSearchParams());assert.equal(root.total,1);assert.equal(root.records[0].children_count,1);
 const branch=await m.getNetwork(m.access,new URLSearchParams('parent='+b.id));assert.equal(branch.records[0].id,c.id);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM territory_people').get().n,3);
 assert.equal(sqlite.prepare('SELECT ambassador_id FROM leads WHERE id=1').get().ambassador_id,null);
});
test('network hides unauthorized ancestors and refuses direct parent traversal',async()=>{
 const m=await setup(),p=await m.mutateTerritory(m.access,'person',person('Private ancestor'));
 await m.linkReferral(m.access,{personId:m.personId,referrerId:p.id,note:'Indicação confirmada'});
 const seller={...m.access,role:'Comercial'};const result=await m.getNetwork(seller,new URLSearchParams());
 assert.equal(result.total,1);assert.equal(result.records[0].referrer_id,null);assert.equal(result.records[0].referrer_name,null);assert.ok(!JSON.stringify(result).includes('Private ancestor'));
 await assert.rejects(m.getNetwork(seller,new URLSearchParams('parent='+p.id)),/fora do seu acesso/);
});
test('API requires login and same origin, and migration preserves preexisting opportunity fields',async()=>{
 const m=await setup(),api=await vite.ssrLoadModule('/app/api/followup/route.ts');globalThis.__eliteTestUser=null;
 assert.equal((await api.GET(new Request('https://test.invalid/api/followup'))).status,401);
 assert.equal((await api.POST(new Request('https://test.invalid/api/followup',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'}))).status,403);
 const o=sqlite.prepare('SELECT * FROM opportunities WHERE id=?').get(m.id);assert.equal(o.stage,'Proposta');assert.equal(o.followup_json,'{}');
});
