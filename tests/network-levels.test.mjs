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
const ADMIN='teamfrascaroli@gmail.com';
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess(ADMIN,'Teste');return {access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/mutations.ts'),...await vite.ssrLoadModule('/lib/expansion-validation.ts'),...await vite.ssrLoadModule('/db/followup.ts'),...await vite.ssrLoadModule('/db/portal.ts')};}
const person=(name,cityId=1)=>({cityId,name,authorized:true,leader:false,referrerId:null});
const leadFor=(personId,referrerId=null,extra={})=>({personId,referrerId,cityId:1,name:'x',email:`${personId.slice(0,8)}@example.invalid`,whatsapp:'',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Teste',consentPurpose:'Teste',...extra});
const roles=async(m,name)=>(await m.getTerritory(m.access,new URLSearchParams({q:name,category:'person'}))).records[0];

test('níveis da rede no mapa: Lead → Cliente → Indicador → Multiplicador, com quem indicou e quem foi indicado',async()=>{
 const m=await modules();
 const ana=await m.mutateTerritory(m.access,'person',person('Ana Mentora'));
 const bia=await m.mutateTerritory(m.access,'person',person('Bia Indicada'));
 const caio=await m.mutateTerritory(m.access,'person',person('Caio Indicado'));
 // Atendimento de Bia com "Quem indicou" = Ana: canal vira Indicação e a rede se atualiza.
 await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadFor(bia.id,ana.id)),m.access);
 assert.equal(sqlite.prepare('SELECT referrer_id r FROM territory_people WHERE id=?').get(bia.id).r,ana.id);
 let r=await roles(m,'Ana Mentora');assert.ok(r.roles.includes('Indicador'),'quem indicou vira Indicador');assert.ok(!r.roles.includes('Cliente'));
 assert.deepEqual(r.referred,[{name:'Bia Indicada',client:false}]);
 r=await roles(m,'Bia Indicada');assert.ok(r.roles.includes('Lead'));assert.equal(r.referrerName,'Ana Mentora');
 // Venda paga de Bia: ela vira Cliente e Ana vira Multiplicador.
 const leadId=sqlite.prepare('SELECT id FROM leads WHERE person_id=?').get(bia.id).id;
 await m.executeAction('record_sale',m.parseActionPayload('record_sale',{leadId,product:'Mentoria',amountCents:150000,status:'Pagamento confirmado'}),m.access);
 r=await roles(m,'Bia Indicada');assert.ok(r.roles.includes('Cliente'));
 r=await roles(m,'Ana Mentora');assert.ok(r.roles.includes('Multiplicador'));assert.deepEqual(r.referred,[{name:'Bia Indicada',client:true}]);
 // Contagens para "onde dominar": aparecem na resposta do mapa.
 const map=await m.getTerritory(m.access,new URLSearchParams('category=person'));
 assert.equal(map.roleCounts.Cliente,1);assert.equal(map.roleCounts.Indicador,1);assert.equal(map.roleCounts.Multiplicador,1);assert.equal(map.roleCounts.Lead,0,'quem comprou não conta mais como lead');
 // Filtro por nível e camada.
 assert.deepEqual((await m.getTerritory(m.access,new URLSearchParams('category=Multiplicador'))).records.map(x=>x.name),['Ana Mentora']);
 assert.deepEqual((await m.getTerritory(m.access,new URLSearchParams('layers=Cliente'))).records.map(x=>x.name),['Bia Indicada']);
 // Iniciar atendimento do mapa também aceita quem indicou; o canal fica como escolhido.
 const j=await vite.ssrLoadModule('/db/journey.ts');
 await j.startAttendance(m.access,{personId:caio.id,referrerId:bia.id,whatsapp:'31999990000',channel:'Indicação',consentAccepted:true,consentSource:'Conversa',consentPurpose:'Contato',ownerEmail:ADMIN,nextAction:'Ligar',dueDate:'2099-01-01'});
 assert.equal(sqlite.prepare('SELECT referrer_id r FROM territory_people WHERE id=?').get(caio.id).r,bia.id);
 r=await roles(m,'Bia Indicada');assert.ok(r.roles.includes('Indicador')&&r.roles.includes('Cliente'));
 // Ciclo e cidade: Ana não pode ser indicada por Caio (descendente); indicador de outra cidade é recusado.
 const dora=await m.mutateTerritory(m.access,'person',person('Dora Outra',2));
 await assert.rejects(m.executeAction('create_lead',m.parseActionPayload('create_lead',leadFor(dora.id,ana.id,{cityId:2})),m.access),/mesma cidade/);
 await assert.rejects(m.executeAction('create_lead',m.parseActionPayload('create_lead',leadFor(ana.id,ana.id)),m.access),/si mesma/);
 // Rede de indicações: nível e nomes dos indicados.
 const net=await m.getNetwork(m.access,new URLSearchParams('view=list'));
 const byName=Object.fromEntries(net.records.map(p=>[p.name,p]));
 assert.equal(byName['Ana Mentora'].role,'Multiplicador');assert.equal(byName['Ana Mentora'].children_names,'Bia Indicada');
 assert.equal(byName['Bia Indicada'].role,'Indicador');assert.equal(byName['Caio Indicado'].role,'Lead');
 // Comercial: "Indicou" conta só quem está no acesso dele.
 const seller={...m.access,role:'Comercial',email:'vendas@example.invalid',cityId:null};
 sqlite.prepare("UPDATE territory_people SET created_by='vendas@example.invalid' WHERE id=?").run(ana.id);
 let anaSeen=(await m.getTerritory(seller,new URLSearchParams({q:'Ana Mentora',category:'person'}))).records[0];
 assert.ok(anaSeen,'o Comercial vê quem ele cadastrou');
 assert.equal(anaSeen.referred?.length??0,0,'Bia está fora do acesso dele e não entra na contagem');
 sqlite.prepare("UPDATE leads SET assigned_to_email='vendas@example.invalid' WHERE person_id=?").run(bia.id);
 anaSeen=(await m.getTerritory(seller,new URLSearchParams({q:'Ana Mentora',category:'person'}))).records[0];
 assert.deepEqual(anaSeen.referred,[{name:'',client:true}],'com Bia no acesso dele, conta (sem o nome)');
 sqlite.prepare("UPDATE leads SET assigned_to_email='' WHERE person_id=?").run(bia.id);
 // Vincular depois, sem observação obrigatória.
 const eva=await m.mutateTerritory(m.access,'person',person('Eva Nova'));
 await m.linkReferral(m.access,{personId:eva.id,referrerId:caio.id});
 assert.equal(sqlite.prepare('SELECT referrer_id r FROM territory_people WHERE id=?').get(eva.id).r,caio.id);
});

test('ícone principal: quem comprou e quem indica aparece na frente dos outros papéis',async()=>{
 const {primaryRole}=await vite.ssrLoadModule('/lib/territory-appearance.ts');
 assert.equal(primaryRole(['Pessoa','Mentorado','Lead']),'Mentorado');
 assert.equal(primaryRole(['Pessoa','Mentorado','Lead','Cliente']),'Cliente');
 assert.equal(primaryRole(['Pessoa','Mentorado','Cliente','Indicador']),'Indicador');
 assert.equal(primaryRole(['Pessoa','Cliente','Indicador','Multiplicador']),'Multiplicador');
 assert.equal(primaryRole(['Pessoa','Embaixador','Multiplicador']),'Embaixador','a estrutura da rede continua na frente');
 assert.equal(primaryRole(['Pessoa','Lead']),'Lead');
 const {pinImageId}=await vite.ssrLoadModule('/app/map-pins.ts');
 assert.equal(pinImageId({kind:'person',roles:['Pessoa','Lead'],status:'Lead válido'}),'pin|person|Lead||');
 assert.equal(pinImageId({kind:'person',roles:['Pessoa','Lead','Cliente'],status:'Cliente'}),'pin|Cliente|Cliente|PG|+','quem comprou acende em dourado');
 assert.equal(pinImageId({kind:'person',roles:['Pessoa','Cliente','Indicador','Multiplicador'],status:'Cliente'}),'pin|Multiplicador|Multiplicador|PG|+');
});

test('mentorado da equipe entra no mapa com o papel Mentorado, e as indicações dele já nascem ligadas',async()=>{
 const m=await modules();
 await m.executeAction('create_user',m.parseActionPayload('create_user',{email:'mentorado@cliente.invalid',name:'Maria Mentorada',role:'Mentorado',cityId:1,title:'',mentorshipCycle:1}),m.access);
 const user=sqlite.prepare("SELECT id,person_id FROM app_users WHERE email='mentorado@cliente.invalid'").get();
 assert.ok(user.person_id,'ganhou uma pessoa no mapa');
 assert.equal(sqlite.prepare("SELECT role FROM territory_roles WHERE person_id=?").get(user.person_id).role,'Mentorado');
 let r=await roles(m,'Maria Mentorada');assert.ok(r.roles.includes('Mentorado'));
 // Já existia uma pessoa com o mesmo nome na cidade: liga a ela em vez de duplicar.
 const joao=await m.mutateTerritory(m.access,'person',person('João Mentorado'));
 await m.executeAction('create_user',m.parseActionPayload('create_user',{email:'joao@cliente.invalid',name:'joão mentorado',role:'Mentorado',cityId:1,title:'',mentorshipCycle:1}),m.access);
 assert.equal(sqlite.prepare("SELECT person_id FROM app_users WHERE email='joao@cliente.invalid'").get().person_id,joao.id);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM territory_people WHERE name LIKE 'Jo%'").get().n,1);
 // Mentorado antigo sem pessoa: "Colocar no mapa" resolve.
 const old=Number(sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,'antigo@cliente.invalid','Antigo Mentorado','Mentorado',1,1,'t','2026-01-01')").run().lastInsertRowid);
 await m.portalAdminAction(m.access,'map_member',{userId:old});
 assert.ok(sqlite.prepare('SELECT person_id FROM app_users WHERE id=?').get(old).person_id);
 const semCidade=Number(sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,'semcidade@cliente.invalid','Sem Cidade','Mentorado',NULL,1,'t','2026-01-01')").run().lastInsertRowid);
 await assert.rejects(m.portalAdminAction(m.access,'map_member',{userId:semCidade}),/cidade/);
 // Indicação pelo portal: já ligada à pessoa do mentorado → ele vira Indicador no mapa.
 globalThis.__eliteTestUser={email:'mentorado@cliente.invalid',displayName:'Maria'};
 const a=await vite.ssrLoadModule('/db/access.ts');const ma=await a.getUserAccess('mentorado@cliente.invalid','Maria',1);
 await m.portalAction(ma,'refer',{name:'Carlos Indicado',whatsapp:'(31) 91111-2222',cityId:1,consent:true});
 globalThis.__eliteTestUser={email:ADMIN,displayName:'Administrador de teste'};
 r=await roles(m,'Maria Mentorada');assert.ok(r.roles.includes('Indicador'));assert.deepEqual(r.referred,[{name:'Carlos Indicado',client:false}]);
});
