import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'cloudflare:workers',replacement:root+'tests/fixtures/cloudflare.mjs'},{find:'@/app/auth',replacement:root+'tests/fixtures/auth.mjs'},{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
let sqlite;
function adapter(db){return {prepare(sql){let args=[];const stmt={bind(...values){args=values.map(v=>typeof v==='boolean'?Number(v):v);return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};}};return stmt;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});
const ORG=(id=1)=>({'X-Elite-Organization':String(id)});
const request=(action,data)=>new Request('https://test.invalid/api/territory',{method:'POST',headers:{origin:'https://test.invalid','Content-Type':'application/json',...ORG()},body:JSON.stringify({action,data})});
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
 await modules();const api=await vite.ssrLoadModule('/app/api/territory/geocode/route.ts');const r=await api.POST(new Request('https://test.invalid/api/territory/geocode',{method:'POST',headers:{origin:'https://test.invalid',...ORG()},body:JSON.stringify({query:'Centro',cityId:1,kind:'partner'})}));assert.equal(r.status,503);assert.match((await r.json()).error,/pendente/);
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
 const api=await vite.ssrLoadModule('/app/api/territory/geocode/route.ts');const response=await api.POST(new Request('https://test.invalid/api/territory/geocode',{method:'POST',headers:{origin:'https://test.invalid',...ORG()},body:JSON.stringify({query:'Dados pessoais',cityId:1,kind:'person'})}));assert.equal(response.status,400);
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

test('organizations isolate dashboard, settings, map counts and writes including globals',async()=>{
 const m=await modules();const {createOrganization,listOrganizations}=await vite.ssrLoadModule('/db/organizations.ts');const {getUserAccess}=await vite.ssrLoadModule('/db/access.ts');const {getDashboardData}=await vite.ssrLoadModule('/db/queries.ts');
 const payload={name:'Empresa isolada de teste',ownerEmail:'cliente@example.invalid',ownerName:'Cliente teste',requestId:crypto.randomUUID()};const org=await createOrganization(m.access,payload);assert.equal(await createOrganization(m.access,payload),org);
 const a=await getUserAccess(m.access.email,'Teste',org);assert.equal(a.organizationId,org);assert.equal(a.isPlatformOwner,false);assert.equal(a.isAdvisory,true);
 assert.equal((await m.getTerritory(a,new URLSearchParams())).total,0);assert.equal((await getDashboardData(a)).cities.length,0);
 const run=(action,data,access=a)=>m.executeAction(action,m.parseActionPayload(action,data),access);
 await run('create_city',{name:'Esmeraldas',state:'MG',phase:'Piloto',leaderName:'',targetCacCents:0,ambassadorGoal:1,salesGoal:1,status:'Ativa',budgetCents:0,trackingMode:'Detalhado'});
 const cityId=Number(sqlite.prepare('SELECT id FROM cities WHERE organization_id=?').get(org).id);
 const p=await m.mutateTerritory(a,'person',person('Pessoa exclusiva',cityId));
 await run('create_content',{title:'Material exclusivo',type:'Mensagem',channel:'WhatsApp',version:'1',status:'Aprovado',url:'',instructions:'Somente esta empresa'});
 await run('create_task',{title:'Tarefa exclusiva',category:'Missão'});
 const data=await getDashboardData(a);assert.equal(data.cities.length,1);assert.equal(data.people[0].id,p.id);assert.equal(data.contents.length,1);assert.equal(data.tasks.length,1);assert.deepEqual(data.users.map(u=>u.email),['cliente@example.invalid']);
 const original=await getDashboardData(m.access);assert.equal(original.cities.length,4);assert.equal(original.contents.length,0);assert.equal(original.tasks.length,0);assert.equal(original.people.length,0);assert.ok(!JSON.stringify(original).includes('Pessoa exclusiva'));
 assert.equal((await m.getTerritory(m.access,new URLSearchParams('city='+cityId))).total,0);
 await assert.rejects(m.mutateTerritory(m.access,'person',{...person('Ataque',cityId),id:p.id}),/Cidade não encontrada/);
 await assert.rejects(run('create_partner',{cityId:1,name:'Ataque',type:'Comércio',status:'Ativo'}),/fora do seu acesso/);
 const taskId=data.tasks[0].id;await assert.rejects(run('complete_task',{taskId},m.access),/não encontrada/);
 await assert.rejects(createOrganization(a,{name:'Sem acesso',requestId:crypto.randomUUID()}),/permissão/);
 assert.equal((await listOrganizations('sem-acesso@example.invalid')).length,0);assert.equal(await getUserAccess('sem-acesso@example.invalid','Teste',org),null);
});

test('organization selection validates membership and rejects forged organization context in direct API',async()=>{
 const m=await modules();const {createOrganization}=await vite.ssrLoadModule('/db/organizations.ts');const org=await createOrganization(m.access,{name:'Organização de teste',ownerEmail:'isolado@example.invalid',ownerName:'Teste',requestId:crypto.randomUUID()});
 globalThis.__eliteTestUser={email:'isolado@example.invalid',displayName:'Teste'};
 const api=await vite.ssrLoadModule('/app/api/organizations/route.ts');
 const req=(id)=>new Request('https://test.invalid/api/organizations',{method:'POST',headers:{origin:'https://test.invalid','Content-Type':'application/json'},body:JSON.stringify({action:'switch',organizationId:id})});
 assert.equal((await api.POST(req(1))).status,403);
 const allowed=await api.POST(req(org));assert.equal(allowed.status,200);assert.equal(allowed.headers.get('set-cookie'),null);assert.equal((await allowed.json()).organizationId,org);
 const map=await vite.ssrLoadModule('/app/api/territory/route.ts');assert.equal((await map.GET(new Request('https://test.invalid/api/territory',{headers:ORG(1)}))).status,403);
 assert.equal((await map.GET(new Request('https://test.invalid/api/territory',{headers:ORG(org)}))).status,200);
 const list=await api.GET(new Request('https://test.invalid/api/organizations',{headers:ORG(org)}));const body=await list.json();assert.equal(body.organizations.length,1);assert.equal(body.organizations[0].id,org);
});

test('dashboard fails safely on malformed organization and storage outage',async()=>{
 await modules();const api=await vite.ssrLoadModule('/app/api/dashboard/route.ts');
 const invalid=await api.GET(new Request('https://test.invalid/api/dashboard',{headers:{'X-Elite-Organization':'not-a-number'}}));assert.equal(invalid.status,403);assert.ok(!(await invalid.text()).includes('SELECT'));
 globalThis.__eliteTestD1={prepare(){throw new Error('D1_ERROR SELECT secret_table private@example.invalid');}};
 const r=await api.POST(new Request('https://test.invalid/api/dashboard',{method:'POST',headers:{origin:'https://test.invalid',...ORG()},body:JSON.stringify({action:'create_city',data:{}})}));assert.equal(r.status,503);const body=await r.json();assert.ok(body.error);assert.ok(!body.data);assert.ok(!JSON.stringify(body).includes('secret_table'));assert.ok(!JSON.stringify(body).includes('private@example.invalid'));
});

test('commercial lifecycle: business, opportunity, history, goals, payment and privacy',async()=>{
 const m=await modules();const {saveCommercial,getCommercial}=await vite.ssrLoadModule('/db/commercial.ts');
 const business={id:crypto.randomUUID(),cityId:1,name:'Empresa teste',segment:'Salão',source:'Cadastro manual autorizado',ownerEmail:m.access.email,status:'Identificada',publicBusiness:true};
 await saveCommercial(m.access,'business',business);await saveCommercial(m.access,'business',business);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM businesses').get().n,1);assert.equal((await m.getTerritory(m.access,new URLSearchParams('category=business'))).total,1);
 await assert.rejects(saveCommercial(m.access,'business',{...business,id:crypto.randomUUID()}),/UNIQUE/);
 const p=await m.mutateTerritory(m.access,'person',person());await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(p.id)),m.access);
 const o={id:crypto.randomUUID(),leadId:1,businessId:business.id,ownerEmail:m.access.email,temperature:'Quente',stage:'Novo',nextAction:'Reunião inicial',dueDate:'2026-10-10'};
 await saveCommercial(m.access,'opportunity',o);await saveCommercial(m.access,'opportunity',o);
 await saveCommercial(m.access,'opportunity',{...o,version:1,stage:'Ganho'});assert.equal(sqlite.prepare('SELECT count(*) n FROM sales').get().n,0);
 await assert.rejects(saveCommercial(m.access,'opportunity',{...o,version:1,stage:'Contato'}),/atualizado/);
 await saveCommercial(m.access,'activity',{id:crypto.randomUUID(),opportunityId:o.id,kind:'Contato',note:'Conversa realizada em ambiente de teste',day:'2026-10-09'});
 await saveCommercial(m.access,'goal',{cityId:1,ownerEmail:m.access.email,day:'2026-10-09',cold:3,hot:2,contacts:5});
 await saveCommercial(m.access,'report',{cityId:1,day:'2026-10-09',blockers:'',nextPlan:'Retomar proposta'});
 const d=await getCommercial(m.access,new URLSearchParams('day=2026-10-09'));assert.equal(d.businesses.length,1);assert.equal(d.opportunities[0].stage,'Ganho');assert.equal(d.goals[0].hot,2);assert.equal(d.reports.length,1);assert.equal(d.pipelineTotals[0].payments,0);
 await m.executeAction('update_lead',m.parseActionPayload('update_lead',{leadId:1,status:'Cancelado',consentRevoked:true,consentRevocationReason:'Pedido teste'}),m.access);
 assert.equal((await getCommercial(m.access,new URLSearchParams('day=2026-10-09'))).opportunities.length,0);
});

test('commercial API isolates organization, city and seller; denies unauthorized goals',async()=>{
 const m=await modules();const {saveCommercial,getCommercial}=await vite.ssrLoadModule('/db/commercial.ts');const {createOrganization}=await vite.ssrLoadModule('/db/organizations.ts');const {getUserAccess}=await vite.ssrLoadModule('/db/access.ts');
 const b={id:crypto.randomUUID(),cityId:1,name:'Empresa restrita',segment:'Imobiliária',source:'Cadastro manual',ownerEmail:m.access.email,status:'Identificada',publicBusiness:true};await saveCommercial(m.access,'business',b);
 const org=await createOrganization(m.access,{name:'Outra organização',ownerEmail:'outra@example.invalid',ownerName:'Outra',requestId:crypto.randomUUID()}),other=await getUserAccess(m.access.email,'Teste',org);
 assert.equal((await getCommercial(other,new URLSearchParams())).businesses.length,0);await assert.rejects(saveCommercial(other,'business',{...b,version:1}),/fora do seu acesso/);
 const leader={...m.access,role:'Líder',cityId:2};assert.equal((await getCommercial(leader,new URLSearchParams())).businesses.length,0);await assert.rejects(saveCommercial(leader,'business',{...b,version:1}),/fora do seu acesso/);
 const seller={...m.access,role:'Comercial',email:'other@example.invalid'};assert.equal((await getCommercial(seller,new URLSearchParams())).businesses.length,0);await assert.rejects(saveCommercial(seller,'goal',{cityId:1,ownerEmail:seller.email,day:'2026-10-09',cold:1,hot:1,contacts:1}),/Somente/);
 globalThis.__eliteTestUser=null;const api=await vite.ssrLoadModule('/app/api/commercial/route.ts');assert.equal((await api.GET(new Request('https://test.invalid/api/commercial'))).status,401);assert.equal((await api.POST(new Request('https://test.invalid/api/commercial',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'}))).status,403);
});

test('business import previews duplicates, commits per row and retries without duplication',async()=>{
 const m=await modules();const {saveCommercial}=await vite.ssrLoadModule('/db/commercial.ts');const b={id:crypto.randomUUID(),cityId:1,name:'Empresa importada',segment:'Nails',source:'Arquivo autorizado',ownerEmail:m.access.email,status:'Identificada',publicBusiness:true};
 const preview=await saveCommercial(m.access,'import_preview',{rows:[b,{...b,id:crypto.randomUUID()}]});assert.deepEqual(preview.rows.map(r=>r.ok),[true,false]);assert.equal(sqlite.prepare('SELECT count(*) n FROM businesses').get().n,0);
 await assert.rejects(saveCommercial(m.access,'import_commit',{rows:[b]}),/Confirme/);
 const imported=await saveCommercial(m.access,'import_commit',{rows:[b],confirmed:true});assert.equal(imported.rows[0].ok,true);await saveCommercial(m.access,'import_commit',{rows:[b],confirmed:true});assert.equal(sqlite.prepare('SELECT count(*) n FROM businesses').get().n,1);
 await m.executeAction('create_partner',m.parseActionPayload('create_partner',{cityId:1,name:'Parceiro cadastrado',type:'Comércio',status:'Ativo'}),m.access);
 await saveCommercial(m.access,'link_partner',{id:b.id,partnerId:1});const map=await m.getTerritory(m.access,new URLSearchParams('layers=business|Parceiro'));assert.equal(map.total,1);assert.deepEqual(map.records[0].roles,['Empresa','Parceiro']);
 const {parseCsv}=await vite.ssrLoadModule('/lib/commercial-import.ts');assert.deepEqual(parseCsv('Nome;Fonte\n"Loja; Centro";Manual'),[['Nome','Fonte'],['Loja; Centro','Manual']]);assert.throws(()=>parseCsv('Nome;Fonte\n"Sem fim;Manual'),/Aspas/);const {csvCell}=await vite.ssrLoadModule('/lib/commercial.ts');assert.equal(csvCell('=HYPERLINK("https://example.invalid")'),'"\'=HYPERLINK(""https://example.invalid"")"');
});

test('commercial reassignment immediately removes old seller access and failed updates create no history',async()=>{
 const m=await modules();const {saveCommercial,getCommercial}=await vite.ssrLoadModule('/db/commercial.ts');const p=await m.mutateTerritory(m.access,'person',person());await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(p.id)),m.access);
 const o={id:crypto.randomUUID(),leadId:1,ownerEmail:m.access.email,temperature:'Frio',stage:'Novo',nextAction:'Conversar',dueDate:'2026-10-10'};await saveCommercial(m.access,'opportunity',o);const before=sqlite.prepare('SELECT count(*) n FROM commercial_activities').get().n;
 await assert.rejects(saveCommercial(m.access,'opportunity',{...o,version:999,stage:'Contato'}),/atualizado/);assert.equal(sqlite.prepare('SELECT count(*) n FROM commercial_activities').get().n,before);
 sqlite.prepare("UPDATE leads SET assigned_to_email='new@example.invalid' WHERE id=1").run();const seller={...m.access,role:'Comercial'};assert.equal((await getCommercial(seller,new URLSearchParams())).opportunities.length,0);await assert.rejects(saveCommercial(seller,'activity',{id:crypto.randomUUID(),opportunityId:o.id,kind:'Contato',day:'2026-10-09',note:'Sem acesso'}),/fora do seu acesso/);
});

test('map providers remain disabled without configuration and Street View rejects personal points',async()=>{
 const m=await modules();const config=await vite.ssrLoadModule('/app/api/map-config/route.ts');const r=await config.GET(new Request('https://test.invalid/api/map-config',{headers:ORG()}));const c=await r.json();assert.equal(c.satellite,null);assert.equal(c.hybrid,null);assert.equal(c.streetView,false);
 const street=await vite.ssrLoadModule('/app/api/territory/street-view/route.ts');const personal=await street.POST(new Request('https://test.invalid/api/territory/street-view',{method:'POST',headers:{origin:'https://test.invalid',...ORG()},body:JSON.stringify({key:'person:'+crypto.randomUUID()})}));assert.equal(personal.status,400);
 const {saveCommercial}=await vite.ssrLoadModule('/db/commercial.ts');const id=crypto.randomUUID();await saveCommercial(m.access,'business',{id,cityId:1,name:'Empresa pública',segment:'Comércio',source:'Cadastro autorizado',ownerEmail:m.access.email,status:'Identificada',publicBusiness:true});
 await m.mutateTerritory(m.access,'location',{key:'business:'+id,latitude:-19.7628,longitude:-44.3131,region:'Centro',precision:'Local comercial',source:'Validação de teste',validated:true,authorized:true,visibility:'Equipe'});
 const absent=await street.POST(new Request('https://test.invalid/api/territory/street-view',{method:'POST',headers:{origin:'https://test.invalid',...ORG()},body:JSON.stringify({key:'business:'+id})}));assert.equal(absent.status,503);assert.match((await absent.json()).error,/pendente/);
 const {buildingLayer,applyBuildings}=await vite.ssrLoadModule('/lib/building-layer.ts');let added;const layers=[{id:'existing',type:'fill-extrusion'},{id:'labels',type:'symbol'}];const visible={};const fake={getStyle:()=>({layers}),getSource:()=>false,addSource:()=>{},getLayer:id=>id===added?.id?added:null,addLayer:layer=>{added=layer;},setLayoutProperty:(id,property,value)=>{visible[id]=value;}};applyBuildings(fake,true);assert.equal(added.type,'fill-extrusion');assert.deepEqual(buildingLayer.paint['fill-extrusion-height'],['coalesce',['get','render_height'],0]);assert.equal(visible['elite-buildings-3d'],'visible');applyBuildings(fake,false);assert.equal(visible['elite-buildings-3d'],'none');
});

test('city decisions, draft plans and exports are scoped and audited',async()=>{
 const m=await modules();const {saveCommercial,getCommercial}=await vite.ssrLoadModule('/db/commercial.ts');
 const d={id:crypto.randomUUID(),cityId:1,decision:'Sem dados suficientes',reason:'Ainda não há um período completo.',nextAction:'Concluir primeiro período',reviewDate:'2026-10-30'};await saveCommercial(m.access,'decision',d);await saveCommercial(m.access,'decision',d);assert.equal(sqlite.prepare('SELECT count(*) n FROM city_decisions').get().n,1);
 await saveCommercial(m.access,'plan',{name:'Plano em avaliação',userLimit:10,cityLimit:4});const result=await getCommercial(m.access,new URLSearchParams('city=1'));assert.equal(result.decisions.length,1);assert.equal(result.plan.user_limit,10);
 await assert.rejects(saveCommercial({...m.access,role:'Comercial'},'decision',d),/gestão/);await assert.rejects(saveCommercial({...m.access,role:'Líder',cityId:1},'plan',{name:'Tentativa',userLimit:1,cityLimit:1}),/administrador/);
 const api=await vite.ssrLoadModule('/app/api/commercial/route.ts');const csv=await api.GET(new Request('https://test.invalid/api/commercial?format=csv&mode=businesses',{headers:ORG()}));assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='export_commercial'").get().n,1);
});

test('tenant APIs deny requests without organization context and accept the tab URL context',async()=>{
 await modules();
 const routes={dashboard:'/app/api/dashboard/route.ts',territory:'/app/api/territory/route.ts',commercial:'/app/api/commercial/route.ts','map-config':'/app/api/map-config/route.ts'};
 for(const [path,module] of Object.entries(routes)){
  const api=await vite.ssrLoadModule(module);
  // Sem header nem ?org=: nenhuma organização é escolhida por padrão.
  const none=await api.GET(new Request(`https://test.invalid/api/${path}`));assert.equal(none.status,403,`${path} sem contexto`);
  const body=await none.text();assert.ok(!body.includes('Esmeraldas'),`${path} não pode vazar dados sem contexto`);
  // Header de uma organização da qual a pessoa participa: liberado.
  assert.equal((await api.GET(new Request(`https://test.invalid/api/${path}`,{headers:ORG(1)}))).status,200,`${path} com header`);
  // ?org= na própria URL da API também identifica a aba.
  assert.equal((await api.GET(new Request(`https://test.invalid/api/${path}?org=1`))).status,200,`${path} com ?org=`);
  // Organização inexistente ou sem vínculo: negado.
  assert.equal((await api.GET(new Request(`https://test.invalid/api/${path}`,{headers:ORG(999)}))).status,403,`${path} org sem vínculo`);
 }
});

test('Assessoria Elite: chosen Elite members see and edit client organizations, visibly and audited',async()=>{
 const m=await modules();
 const {createOrganization,listOrganizations}=await vite.ssrLoadModule('/db/organizations.ts');
 const {getUserAccess}=await vite.ssrLoadModule('/db/access.ts');const {getDashboardData}=await vite.ssrLoadModule('/db/queries.ts');
 const orgs=await vite.ssrLoadModule('/app/api/organizations/route.ts'),territory=await vite.ssrLoadModule('/app/api/territory/route.ts');
 const post=(action,data,org=1)=>new Request('https://test.invalid/api/organizations',{method:'POST',headers:{origin:'https://test.invalid','Content-Type':'application/json',...ORG(org)},body:JSON.stringify({action,data})});
 const owner=m.access.email;
 // Criar: o cliente vira dono e administrador; o dono da plataforma NÃO entra como membro.
 const org=await createOrganization(m.access,{name:'Cliente assessorado',ownerEmail:'Dono@Cliente.invalid',ownerName:'Dono do cliente',requestId:crypto.randomUUID()});
 assert.equal(sqlite.prepare('SELECT count(*) n FROM app_users WHERE organization_id=? AND lower(email)=?').get(org,owner).n,0);
 const client=await getUserAccess('dono@cliente.invalid','Dono',org);assert.equal(client.role,'Administrador');assert.equal(client.isOrganizationOwner,true);assert.ok(!client.isAdvisory);
 // Dono da plataforma: entra pela assessoria, só com a organização pedida explicitamente.
 const advised=await getUserAccess(owner,'Teste',org);assert.equal(advised.isAdvisory,true);assert.equal(advised.role,'Administrador');assert.equal(advised.canManageGlobal,true);
 assert.equal((await getUserAccess(owner,'Teste')).organizationId,1,'sem ?org= continua na própria organização');
 assert.equal((await territory.GET(new Request('https://test.invalid/api/territory',{headers:ORG(org)}))).status,200);
 assert.ok((await listOrganizations(owner)).some(o=>o.id===org&&o.role==='Assessoria Elite'));
 assert.ok(!(await listOrganizations('dono@cliente.invalid')).some(o=>o.id===1),'cliente não enxerga a Elite');
 // Membro do time Elite sem assessoria: sem acesso. Com assessoria concedida: acessa.
 sqlite.prepare("INSERT INTO app_users(email,name,role,active,organization_id) VALUES('mentor@elite.invalid','Mentor Elite','Comercial',1,1)").run();
 assert.equal(await getUserAccess('mentor@elite.invalid','Mentor',org),null);
 let r=await orgs.POST(post('advisor',{email:'Mentor@Elite.invalid',active:true}));assert.equal(r.status,200);assert.ok((await r.json()).advisors.some(a=>a.email==='mentor@elite.invalid'&&a.active));
 assert.equal((await getUserAccess('mentor@elite.invalid','Mentor',org)).isAdvisory,true);
 // Só membros da Elite podem ser assessores; o cliente não concede nem se dá assessoria.
 r=await orgs.POST(post('advisor',{email:'dono@cliente.invalid',active:true}));assert.equal(r.status,400);assert.match((await r.json()).error,/time Elite/);
 globalThis.__eliteTestUser={email:'dono@cliente.invalid',displayName:'Dono'};
 assert.equal((await orgs.POST(post('advisor',{email:'dono@cliente.invalid',active:true},org))).status,403);
 // Visível ao cliente: quem administra vê a assessoria; ações da assessoria aparecem marcadas.
 const run=(action,data,access)=>m.executeAction(action,m.parseActionPayload(action,data),access);
 await run('create_city',{name:'Cidade do cliente',state:'MG',phase:'Piloto',leaderName:'',targetCacCents:0,ambassadorGoal:1,salesGoal:1,status:'Ativa',budgetCents:0,trackingMode:'Detalhado'},advised);
 await run('create_task',{title:'Tarefa do cliente',category:'Missão'},client);
 const seen=await getDashboardData(client);
 assert.deepEqual(seen.advisors.map(a=>a.email).sort(),['mentor@elite.invalid',owner].sort());
 const byAdvisor=seen.auditLogs.filter(l=>l.actorEmail===owner);assert.ok(byAdvisor.length>=2,'criação e cidade');assert.ok(byAdvisor.every(l=>l.advisory===true));
 assert.ok(seen.auditLogs.filter(l=>l.actorEmail==='dono@cliente.invalid').every(l=>l.advisory===false));
 // Retirar a assessoria ou sair do time Elite encerra o acesso na hora.
 globalThis.__eliteTestUser={email:owner,displayName:'Teste'};
 r=await orgs.POST(post('advisor',{email:'mentor@elite.invalid',active:false}));assert.equal(r.status,200);
 assert.equal(await getUserAccess('mentor@elite.invalid','Mentor',org),null);
 await orgs.POST(post('advisor',{email:'mentor@elite.invalid',active:true}));assert.ok(await getUserAccess('mentor@elite.invalid','Mentor',org));
 sqlite.prepare("UPDATE app_users SET active=0 WHERE organization_id=1 AND email='mentor@elite.invalid'").run();
 assert.equal(await getUserAccess('mentor@elite.invalid','Mentor',org),null,'fora do time Elite, sem assessoria');
 // O dono não remove a própria assessoria; tudo fica no registro da plataforma.
 r=await orgs.POST(post('advisor',{email:owner,active:false}));assert.equal(r.status,400);
 assert.ok(sqlite.prepare("SELECT count(*) n FROM platform_audit WHERE action IN ('advisor_granted','advisor_revoked')").get().n>=3);
 // A Elite em si não é acessível por assessoria: só por vínculo próprio.
 assert.equal(await getUserAccess('dono@cliente.invalid','Dono',1),null);
});

test('Cloudflare Access login: only correctly signed, current tokens for this app and team are accepted',async()=>{
 const {verifyAccessJwt,normalizeTeamDomain,accessKeyLookup}=await vite.ssrLoadModule('/lib/access-jwt.ts');
 const team='elite-teste.cloudflareaccess.com',aud='aud-da-aplicacao',config={teamDomain:team,aud};
 const alg={name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'};
 const real=await crypto.subtle.generateKey(alg,true,['sign','verify']),attacker=await crypto.subtle.generateKey(alg,true,['sign','verify']);
 const b64=v=>Buffer.from(v).toString('base64url');
 const now=Math.floor(Date.now()/1000);
 const sign=async(payload,{key=real.privateKey,kid='k1',alg='RS256'}={})=>{const h=b64(JSON.stringify({alg,kid,typ:'JWT'})),p=b64(JSON.stringify(payload));const s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+b64(new Uint8Array(s));};
 const good={iss:'https://'+team,aud:[aud],email:'Pessoa@Elite.invalid',exp:now+600,iat:now};
 const getKey=async kid=>kid==='k1'?real.publicKey:null;
 assert.equal(await verifyAccessJwt(await sign(good),config,getKey),'pessoa@elite.invalid');
 // Assinado por outra chave, alterado depois de assinado, ou sem assinatura: recusado.
 assert.equal(await verifyAccessJwt(await sign(good,{key:attacker.privateKey}),config,getKey),null);
 const t=await sign(good),[h,,s]=t.split('.');assert.equal(await verifyAccessJwt(h+'.'+b64(JSON.stringify({...good,email:'outro@elite.invalid'}))+'.'+s,config,getKey),null);
 assert.equal(await verifyAccessJwt(b64(JSON.stringify({alg:'none',kid:'k1'}))+'.'+b64(JSON.stringify(good))+'.x',config,getKey),null);
 // Outro time, outra aplicação, expirado, ainda não válido, sem e-mail, chave desconhecida: recusado.
 for(const bad of [{...good,iss:'https://outro.cloudflareaccess.com'},{...good,aud:['outra-aplicacao']},{...good,exp:now-3600},{...good,nbf:now+3600},{...good,email:undefined}])assert.equal(await verifyAccessJwt(await sign(bad),config,getKey),null,JSON.stringify(bad));
 assert.equal(await verifyAccessJwt(await sign(good,{kid:'desconhecida'}),config,getKey),null);
 for(const v of [null,'','a.b','a.b.c.d'])assert.equal(await verifyAccessJwt(v,config,getKey),null);
 assert.equal(normalizeTeamDomain('https://Elite-Teste.cloudflareaccess.com/'),team);assert.equal(normalizeTeamDomain('nao é domínio'),null);
 // Chaves buscadas no endpoint público do time, uma vez, com cache.
 let calls=0;const jwk={...(await crypto.subtle.exportKey('jwk',real.publicKey)),kid:'k1'};
 const lookup=accessKeyLookup(team,async url=>{calls++;assert.equal(url,`https://${team}/cdn-cgi/access/certs`);return new Response(JSON.stringify({keys:[jwk]}));});
 assert.equal(await verifyAccessJwt(await sign(good),config,lookup),'pessoa@elite.invalid');
 assert.equal(await verifyAccessJwt(await sign(good),config,lookup),'pessoa@elite.invalid');
 assert.equal(await verifyAccessJwt(await sign(good,{kid:'desconhecida'}),config,lookup),null);assert.equal(calls,1,'sem buscas repetidas');
});
