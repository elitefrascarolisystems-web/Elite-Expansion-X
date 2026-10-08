import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'cloudflare:workers',replacement:root+'tests/fixtures/cloudflare.mjs'},{find:'@/app/chatgpt-auth',replacement:root+'tests/fixtures/auth.mjs'},{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
let sqlite;
function adapter(db){return {prepare(sql){let args=[];const stmt={bind(...values){args=values.map(v=>typeof v==='boolean'?Number(v):v);return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};}};return stmt;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});
const request=(action,data)=>new Request('https://test.invalid/api/territory',{method:'POST',headers:{origin:'https://test.invalid','Content-Type':'application/json'},body:JSON.stringify({action,data})});
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/mutations.ts'),...await vite.ssrLoadModule('/lib/expansion-validation.ts')};}
const person=(name='Pessoa teste',cityId=1)=>({cityId,name,authorized:true,leader:false,referrerId:null});
const leadData=(personId,cityId=1)=>({personId,cityId,name:'Nome informado',email:'contato@example.invalid',whatsapp:'',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Formulário de teste',consentPurpose:'Atendimento de teste'});
const ambassadorData=(personId)=>({personId,cityId:1,name:'Nome informado',code:'TEST001',status:'Convidado',level:'Indicador'});

test('full lifecycle: shared identity, CRM, referral, follow-up and map refresh',async()=>{
 const m=await modules(),api=await vite.ssrLoadModule('/app/api/territory/route.ts');
 let r=await api.POST(request('person',person()));assert.equal(r.status,200);const id=(await r.json()).result.id;
 await m.executeAction('create_ambassador',m.parseActionPayload('create_ambassador',ambassadorData(id)),m.access);
 await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(id)),m.access);
 let map=await m.getTerritory(m.access,new URLSearchParams('category=person'));assert.equal(map.records.length,1);assert.deepEqual(map.records[0].roles,['Pessoa','Embaixador','Lead']);assert.equal(map.records[0].name,'Pessoa teste');
 const child=await m.mutateTerritory(m.access,'person',{...person('Pessoa indicada'),referrerId:id});assert.ok(child.id);
 await m.mutateTerritory(m.access,'activity',{cityId:1,personId:id,name:'Retomar conversa',category:'Follow-up',status:'Programado',responsible:'Responsável teste',dueDate:'2026-10-10'});
 map=await m.getTerritory(m.access,new URLSearchParams('q=Pessoa teste'));assert.equal(map.records[0].nextAction,'Retomar conversa');
 r=await api.POST(request('location',{key:`person:${id}`,latitude:-19.76543,longitude:-44.31678,region:'Centro',precision:'Região aproximada',source:'Conferência no mapa',validated:true,authorized:true,visibility:'Equipe'}));assert.equal(r.status,200);
 map=await m.getTerritory(m.access,new URLSearchParams('q=Pessoa teste'));assert.equal(map.records[0].location.latitude,-19.77);assert.equal(map.records[0].location.longitude,-44.32);
 assert.ok(sqlite.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n>=5);
});
test('direct API denies anonymous requests and cross-origin writes',async()=>{
 await modules();const api=await vite.ssrLoadModule('/app/api/territory/route.ts');globalThis.__eliteTestUser=null;
 assert.equal((await api.GET(new Request('https://test.invalid/api/territory'))).status,401);
 assert.equal((await api.POST(new Request('https://test.invalid/api/territory',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'}))).status,403);
});
test('coordinator and leader are scoped in reads, counts and direct writes',async()=>{
 const m=await modules();await m.mutateTerritory(m.access,'person',person('Cidade um',1));const other=await m.mutateTerritory(m.access,'person',person('Cidade dois',2));
 for(const role of ['Coordenação','Líder']){const a={...m.access,role,cityId:1};const map=await m.getTerritory(a,new URLSearchParams());assert.ok(map.records.every(r=>r.cityId===1));assert.equal((await m.getTerritory(a,new URLSearchParams('city=2'))).total,0);await assert.rejects(m.mutateTerritory(a,'person',{...person('Ataque',2),id:other.id}),/fora do seu acesso/);}
 assert.equal((await m.getTerritory({...m.access,role:'Coordenação',cityId:null},new URLSearchParams())).total,0);
});
test('admin-only coordinates never reach leaders, searches or geographic filters',async()=>{
 const m=await modules();const {id}=await m.mutateTerritory(m.access,'person',person());
 await m.mutateTerritory(m.access,'location',{key:`person:${id}`,latitude:-20.123456,longitude:-45.876543,region:'Região restrita',precision:'Região aproximada',source:'Conferido',validated:true,authorized:true,visibility:'Admin'});
 const leader={...m.access,role:'Líder',cityId:1};let map=await m.getTerritory(leader,new URLSearchParams('category=person'));assert.equal(map.records[0].location.precision,'Cidade');assert.ok(!JSON.stringify(map).includes('-45.88'));
 assert.equal((await m.getTerritory(leader,new URLSearchParams('q=Região restrita'))).total,0);
 await assert.rejects(m.mutateTerritory(leader,'location',{key:`person:${id}`,latitude:1,longitude:1,region:'',precision:'Cidade',source:'Teste',validated:true,authorized:true,visibility:'Equipe'}),/restrita/);
});
test('ambassador receives only own person; commercial receives assigned contacts only',async()=>{
 const m=await modules();const {id}=await m.mutateTerritory(m.access,'person',person());await m.executeAction('create_ambassador',m.parseActionPayload('create_ambassador',ambassadorData(id)),m.access);await m.executeAction('create_lead',m.parseActionPayload('create_lead',{...leadData(id),assignedToEmail:'sales@example.invalid'}),m.access);
 const amb={...m.access,role:'Embaixador',cityId:1,ambassadorId:1};const map=await m.getTerritory(amb,new URLSearchParams());assert.equal(map.total,1);assert.equal(map.records[0].leadId,null);assert.ok(!JSON.stringify(map).includes('contato@example.invalid'));await assert.rejects(m.mutateTerritory(amb,'person',person()),/não pode/);
 assert.equal((await m.getTerritory({...m.access,role:'Comercial',email:'other@example.invalid'},new URLSearchParams())).total,0);
 assert.equal((await m.getTerritory({...m.access,role:'Comercial',email:'sales@example.invalid'},new URLSearchParams())).total,1);
});
test('event dates, partner and event pins, status refresh, pending coordinates and invalid input',async()=>{
 const m=await modules();await m.executeAction('create_partner',m.parseActionPayload('create_partner',{cityId:1,name:'Parceiro teste',type:'Comércio',status:'Ativo'}),m.access);
 const parsed=m.parseActionPayload('create_event',{cityId:1,name:'Evento teste',eventDate:'2026-10-10',status:'Planejado',ownerName:'Equipe teste',costCents:0,reach:0,leads:0,sales:0});await m.executeAction('create_event',parsed,m.access);
 assert.ok((await m.getTerritory(m.access,new URLSearchParams('category=event'))).records.length===1);
 await m.mutateTerritory(m.access,'event_status',{id:1,status:'Realizado'});assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=event'))).records[0].status,'Realizado');
 await m.mutateTerritory(m.access,'location',{key:'partner:1',latitude:null,longitude:null,region:'',precision:'Local comercial',source:'Pendente de conferência',validated:false,authorized:true,visibility:'Equipe'});assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=partner'))).records[0].location.latitude,null);
 await assert.rejects(m.mutateTerritory(m.access,'location',{key:'event:1',latitude:100,longitude:0,region:'',precision:'Local comercial',source:'Teste',validated:true,authorized:true,visibility:'Equipe'}));
});
test('duplicate CRM linkage and referral cycles are rejected without extra people',async()=>{
 const m=await modules();const p=await m.mutateTerritory(m.access,'person',person());await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(p.id)),m.access);await assert.rejects(m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(p.id)),m.access),/cadastrado/);
 const child=await m.mutateTerritory(m.access,'person',{...person('Segundo'),referrerId:p.id});await assert.rejects(m.mutateTerritory(m.access,'person',{...person(),id:p.id,referrerId:child.id}),/ciclo/);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM territory_people').get().n,2);
});
test('geocoding outage preserves an actionable response, no key exposure',async()=>{
 await modules();const api=await vite.ssrLoadModule('/app/api/territory/geocode/route.ts');const r=await api.POST(new Request('https://test.invalid/api/territory/geocode',{method:'POST',headers:{origin:'https://test.invalid'},body:JSON.stringify({query:'Centro',cityId:1,kind:'person'})}));assert.equal(r.status,503);assert.match((await r.json()).error,/pendente/);
});
test('new schema preserves original rows and foreign keys; isolated migration rollback',async()=>{
 const m=await modules();assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM cities').get().n,4);assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
 const before=sqlite.prepare('SELECT * FROM cities ORDER BY id').all();sqlite.exec('DROP TABLE territory_actions; DROP TABLE territory_locations; DROP TABLE territory_people; DROP INDEX ambassadors_person_unique; DROP INDEX leads_person_unique; ALTER TABLE ambassadors DROP COLUMN person_id; ALTER TABLE leads DROP COLUMN person_id;');assert.deepEqual(sqlite.prepare('SELECT * FROM cities ORDER BY id').all(),before);assert.ok(m.access);
});

 test('repeated person submission is idempotent and cannot overwrite another actor',async()=>{
 const m=await modules(),requestId=crypto.randomUUID();await m.mutateTerritory(m.access,'person',{...person(),requestId});await m.mutateTerritory(m.access,'person',{...person(),requestId});assert.equal(sqlite.prepare('SELECT count(*) AS n FROM territory_people').get().n,1);
 await assert.rejects(m.mutateTerritory({...m.access,email:'other@example.invalid'},'person',{...person(),requestId}),/utilizado/);
 });
 test('activation requires actual readiness in mutation, not just UI validation',async()=>{
 const m=await modules();await assert.rejects(m.executeAction('create_ambassador',m.parseActionPayload('create_ambassador',{...ambassadorData(undefined),status:'Ativo'}),m.access),/antes de ativar/);
 });
 test('pagination and combined filters keep list counts bounded and isolated',async()=>{
 const m=await modules();const insert=sqlite.prepare('INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES(?,1,?,?,?,?)');for(let i=0;i<230;i++)insert.run(crypto.randomUUID(),'Pessoa '+i,m.access.email,'2026-10-08','2026-10-08');
 const page=await m.getTerritory(m.access,new URLSearchParams('category=person&city=1&period=2026-10'));assert.equal(page.records.length,200);assert.equal(page.total,230);assert.equal(page.nextOffset,200);
 const next=await m.getTerritory(m.access,new URLSearchParams('category=person&city=1&period=2026-10&offset=200'));assert.equal(next.records.length,30);assert.equal(next.hasMore,false);
 });

test('operational flow: approval, own consent, training, unpaid/paid sale, costs, cancellation and city isolation',async()=>{
 const m=await modules();const run=(action,input,access=m.access)=>m.executeAction(action,m.parseActionPayload(action,input),access);
 const city={name:'Município de teste',state:'MG',phase:'Piloto',leaderName:'',targetCacCents:5000,ambassadorGoal:2,salesGoal:2,status:'Ativa',budgetCents:100000,trackingMode:'Detalhado'};
 await run('create_city',city);const cityId=Number(sqlite.prepare('SELECT max(id) AS id FROM cities').get().id);
 const {id}=await m.mutateTerritory(m.access,'person',{...person('Responsável teste',cityId),leader:true});
 await run('create_ambassador',{...ambassadorData(id),cityId});const ambassadorId=Number(sqlite.prepare('SELECT max(id) AS id FROM ambassadors').get().id);
 const amb={...m.access,role:'Embaixador',cityId,ambassadorId,email:'ambassador@example.invalid'};
 await run('update_ambassador',{ambassadorId,status:'Aprovado',level:'Indicador',onboardingStatus:'Pendente',trainingProgress:0,whatsappAuthorized:false});
 await run('accept_terms',{ambassadorId,accepted:true},amb);await run('complete_training',{ambassadorId},amb);
 const period=new Date().toISOString().slice(0,7);
 await run('record_ambassador',{ambassadorId,period,leads:0,sales:0,actions:1,contents:0,events:0,costCents:0},amb);
 assert.equal(sqlite.prepare('SELECT status FROM ambassadors WHERE id=?').get(ambassadorId).status,'Ativo');
 await run('create_lead',{...leadData(undefined,cityId),ambassadorId});const leadId=Number(sqlite.prepare('SELECT max(id) AS id FROM leads').get().id);
 await run('update_lead',{leadId,status:'Oportunidade'});
 const sale={leadId,product:'Produto de teste',amountCents:20000,status:'Venda confirmada'};await run('record_sale',sale);
 const {getDashboardData}=await vite.ssrLoadModule('/db/queries.ts');const {buildDashboardView,EMPTY_FILTERS}=await vite.ssrLoadModule('/lib/expansion-domain.ts');
 const summary=async()=>buildDashboardView(await getDashboardData(m.access),{...EMPTY_FILTERS,cityId}).summary;
 assert.equal((await summary()).confirmedPayments,0);assert.equal((await summary()).cacCents,null);
 await run('record_sale',{...sale,status:'Pagamento confirmado'});await run('create_cost',{cityId,category:'Material',channel:'Orgânico',period,amountCents:2000});
 let s=await summary();assert.equal(s.confirmedPayments,1);assert.equal(s.revenueCents,20000);assert.equal(s.cacCents,2000);assert.equal(s.roi,9);
 const map=await m.getTerritory(m.access,new URLSearchParams('city='+cityId));assert.ok(map.records.some(r=>r.status==='Cliente'&&r.roles.includes('Cliente')));assert.equal(map.records.find(r=>r.kind==='city').location,null);
 assert.equal((await m.getTerritory({...m.access,role:'Líder',cityId:1},new URLSearchParams('city='+cityId))).total,0);
 await run('record_sale',{...sale,status:'Cancelada'});assert.equal((await summary()).confirmedPayments,0);
 await run('update_lead',{leadId,status:'Cancelado',consentRevoked:true,consentRevocationReason:'Solicitação de teste'});assert.equal((await m.getTerritory(m.access,new URLSearchParams('leadId='+leadId))).total,0);
 assert.throws(()=>m.parseActionPayload('create_event',{cityId,name:'Data inválida',eventDate:'2026-02-31',status:'Planejado',costCents:0,reach:0,leads:0,sales:0}));
});
test('database failure returns no success and rolls back territorial write with audit',async()=>{
 const m=await modules(),api=await vite.ssrLoadModule('/app/api/territory/route.ts');
 sqlite.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'simulated database failure'); END;");
 const response=await api.POST(request('person',person()));assert.equal(response.status,503);const body=await response.json();assert.equal(body.ok,undefined);assert.ok(!body.error.includes('simulated'));
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM territory_people').get().n,0);assert.ok(m.access);
});
