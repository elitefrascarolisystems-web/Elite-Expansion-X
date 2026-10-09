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
 r=await api.POST(request('location',{key:`person:${id}`,latitude:-19.76543,longitude:-44.31678,region:'Centro',precision:'Região aproximada',source:'Conferência no mapa',validated:true,authorized:true,visibility:'Equipe'}));assert.equal(r.status,400);
 map=await m.getTerritory(m.access,new URLSearchParams('q=Pessoa teste'));assert.equal(map.records[0].location.latitude,-19.7628);assert.equal(map.records[0].location.longitude,-44.3131);
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
 // Simulate a legacy stored personal point. Neither admins nor leaders may receive it.
 sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,1,-20.123456,-45.876543,'Região restrita','Região aproximada','Conferido',1,'Admin','test','2026-10-09','2026-10-09')").run(`person:${id}`);
 const leader={...m.access,role:'Líder',cityId:1};for(const access of [leader,m.access]){const map=await m.getTerritory(access,new URLSearchParams('category=person'));assert.equal(map.records[0].location.precision,'Cidade');assert.equal(map.records[0].location.latitude,-19.7628);assert.ok(!JSON.stringify(map).includes('-45.876543'));assert.equal((await m.getTerritory(access,new URLSearchParams('q=Região restrita'))).total,0);}
 await assert.rejects(m.mutateTerritory(leader,'location',{key:`person:${id}`,latitude:1,longitude:1,region:'',precision:'Cidade',source:'Teste',validated:true,authorized:true,visibility:'Equipe'}),/centro da cidade/);
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
 await modules();const api=await vite.ssrLoadModule('/app/api/territory/geocode/route.ts');const r=await api.POST(new Request('https://test.invalid/api/territory/geocode',{method:'POST',headers:{origin:'https://test.invalid'},body:JSON.stringify({query:'Centro',cityId:1,kind:'partner'})}));assert.equal(r.status,503);assert.match((await r.json()).error,/pendente/);
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

test('v7 roles are separate from access, multi-role people remain unique, role status is specific',async()=>{
 const m=await modules(),p=await m.mutateTerritory(m.access,'person',person());
 await m.mutateTerritory(m.access,'role',{personId:p.id,role:'Mentorado',status:'Ativo',responsible:'Responsável teste',source:'Cadastro autorizado',authorized:true});
 await m.mutateTerritory(m.access,'role',{personId:p.id,role:'Mentor',status:'Pausado',responsible:'',source:'Cadastro autorizado',authorized:true});
 const all=await m.getTerritory(m.access,new URLSearchParams('category=person'));assert.equal(all.people,1);assert.equal(all.records.length,1);assert.ok(all.records[0].roles.includes('Mentorado'));assert.equal(all.records[0].roleDetails.length,2);assert.equal(all.records[0].lastActivity,'');
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=Mentor&status=Ativo'))).total,0);
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=Mentorado&status=Ativo'))).total,1);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM app_users').get().n,1);
 await assert.rejects(m.mutateTerritory({...m.access,role:'Líder',cityId:2},'role',{personId:p.id,role:'Mentor',status:'Ativo',responsible:'',source:'Teste',authorized:true}),/fora do seu acesso/);
});
test('v7 all-filter map totals exceed one list page and viewport respects privacy',async()=>{
 const m=await modules();const stmt=sqlite.prepare('INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES(?,1,?,?,?,?)');for(let i=0;i<250;i++)stmt.run(crypto.randomUUID(),'Registro '+i,m.access.email,'2026-10-08','2026-10-08');
 let map=await m.getTerritory(m.access,new URLSearchParams('category=person'));assert.equal(map.total,250);assert.equal(map.records.length,200);assert.equal(map.points.reduce((n,p)=>n+p.count,0),250);assert.equal(map.people,250);
 map=await m.getTerritory(m.access,new URLSearchParams('category=person&viewport=-1,-1,1,1'));assert.equal(map.points.length,0);assert.equal(map.inView,0);assert.equal(map.total,250);
 const leader={...m.access,role:'Líder',cityId:2};map=await m.getTerritory(leader,new URLSearchParams('category=person'));assert.equal(map.people,0);assert.equal(map.points.length,0);
 await assert.rejects(m.getTerritory(m.access,new URLSearchParams('viewport=nan,1,2,3')),/inválida/);
});

test('v7 referrals and person lookup reach later pages; operational filters and activity dates',async()=>{
 const m=await modules();const parent=await m.mutateTerritory(m.access,'person',person('Indicador'));
 const child=await m.mutateTerritory(m.access,'person',{...person('Mentorado indicado'),referrerId:parent.id});
 await m.mutateTerritory(m.access,'activity',{cityId:1,personId:child.id,name:'Acompanhamento atrasado',category:'Follow-up',status:'Programado',responsible:'Responsável',dueDate:'2020-01-01'});
 let r=await m.getTerritory(m.access,new URLSearchParams('referrals=1'));assert.equal(r.total,1);assert.equal(r.records[0].referrerName,'Indicador');assert.equal(r.records[0].lastActivity,'');
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=person&activity=overdue'))).total,1);
 await m.mutateTerritory(m.access,'activity',{cityId:1,personId:child.id,name:'Interação concluída',category:'Interação',status:'Realizado',responsible:'Responsável',dueDate:'2026-10-08'});
 r=await m.getTerritory(m.access,new URLSearchParams('key=person:'+child.id));assert.ok(r.records[0].lastActivity);
 const stmt=sqlite.prepare('INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES(?,1,?,?,?,?)');for(let i=0;i<220;i++)stmt.run(crypto.randomUUID(),'AAA '+i,m.access.email,'2026-10-08','2026-10-08');
 r=await m.getTerritory(m.access,new URLSearchParams('category=person&q=Mentorado indicado'));assert.equal(r.total,1);assert.equal(r.records[0].id,child.id);
});

test('municipal reference is shared by people in list and map; legacy personal points cannot leak',async()=>{
 const m=await modules();await m.mutateTerritory(m.access,'person',person());
 await m.mutateTerritory(m.access,'location',{key:'city:1',latitude:-19.76,longitude:-44.31,region:'Sede municipal',precision:'Cidade',source:'Referência municipal conferida',validated:true,authorized:true,visibility:'Equipe'});
 const r=await m.getTerritory(m.access,new URLSearchParams('category=person'));assert.equal(r.records[0].location.latitude,-19.76);assert.equal(r.points[0].latitude,-19.76);assert.equal(r.points[0].count,1);
 const api=await vite.ssrLoadModule('/app/api/territory/geocode/route.ts');const response=await api.POST(new Request('https://test.invalid/api/territory/geocode',{method:'POST',headers:{origin:'https://test.invalid'},body:JSON.stringify({query:'Dados pessoais',cityId:1,kind:'person'})}));assert.equal(response.status,400);
});
test('layer union avoids duplicates, Mentor is not Mentorado, empty layers and role source work',async()=>{
 const m=await modules();const p=await m.mutateTerritory(m.access,'person',person('Ambas funções'));const q=await m.mutateTerritory(m.access,'person',person('Só mentorado'));
 for(const [id,role] of [[p.id,'Mentor'],[p.id,'Mentorado'],[q.id,'Mentorado']])await m.mutateTerritory(m.access,'role',{personId:id,role,status:'Ativo',responsible:'Equipe',source:'Formulário autorizado',authorized:true});
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=Mentor'))).people,1);
 const r=await m.getTerritory(m.access,new URLSearchParams('layers=Mentor|Mentorado&source=Formulário&state=MG'));assert.equal(r.people,2);assert.equal(r.records.length,2);assert.equal(r.points[0].people,2);
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('layers='))).total,0);
 assert.equal((await m.getTerritory({...m.access,active:false},new URLSearchParams())).total,0);
 await assert.rejects(m.getTerritory(m.access,new URLSearchParams('layers=invalid')),/Camada inválida/);
 assert.equal((await m.getTerritory({...m.access,role:'Líder',cityId:2},new URLSearchParams('layers=Mentor|Mentorado'))).total,0);
});
