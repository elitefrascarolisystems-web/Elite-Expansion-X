import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,logLevel:'silent',resolve:{alias:[{find:'cloudflare:workers',replacement:root+'tests/fixtures/cloudflare.mjs'},{find:'@/app/auth',replacement:root+'tests/fixtures/auth.mjs'},{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
let sqlite;
function adapter(db){return {prepare(sql){let args=[];const stmt={bind(...values){if(values.length>100)throw new Error('D1_ERROR: too many SQL variables (limite de 100 do D1)');args=values.map(v=>typeof v==='boolean'?Number(v):v);return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};}};return stmt;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
const migrations=readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort();
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of migrations)sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

const TODAY='2026-11-02';
const OWNER='teamfrascaroli@gmail.com';
const calc=()=>vite.ssrLoadModule('/db/calculator.ts');
const accessFor=async(email=OWNER,org)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const day=(n)=>{const d=new Date(Date.UTC(2026,10,2)-n*86400000);return d.toISOString().slice(0,10);};
let seq=0;
function lead({city=1,daysAgo=10,status='Lead válido',channel='Outro',label='',assigned='',revoked=null,person=null,fmt='tz'}={}){
 const d=day(daysAgo);const created=fmt==='tz'?`${d}T10:00:00-03:00`:fmt==='utc'?`${d} 15:00:00`:fmt==='noon'?`${d} 12:00:00`:d;
 return Number(sqlite.prepare("INSERT INTO leads(city_id,name,status,channel,source_label,assigned_to_email,consent_at,consent_source,consent_purpose,consent_revoked_at,person_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(city,'Pessoa '+(++seq),status,channel,label,assigned,created,'teste','teste',revoked,person,created).lastInsertRowid);
}
function sale(leadId,{city=1,paidDaysAgo=5,status='Pagamento confirmado',cents=120000,fmt='tz'}={}){
 const d=day(paidDaysAgo);const paid=status==='Pagamento confirmado'&&paidDaysAgo!==null?(fmt==='tz'?`${d}T11:00:00-03:00`:fmt==='utc'?`${d} 02:00:00`:fmt==='noon'?`${d} 12:00:00`:d):null;
 sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(leadId,city,'Mentoria',cents,status,paid,day(paidDaysAgo??0),day(0));
}

test('realizado, ritmo e ticket: só pagamentos confirmados com data; importação entra; os 4 formatos de data caem no dia certo',async()=>{
 const a=await accessFor();const {getCalculatorBase}=await calc();
 lead({daysAgo:70});// primeiro atendimento: 8 semanas cobertas
 // Dentro do período (desde 01/11): um em cada formato de data.
 sale(lead({daysAgo:30}),{paidDaysAgo:1,fmt:'tz'});
 sale(lead({daysAgo:30}),{paidDaysAgo:0,fmt:'date'});
 sale(lead({daysAgo:30,label:'Importação da rede por planilha'}),{paidDaysAgo:0,fmt:'noon'});
 // UTC 02:00 do dia 02/11 é 01/11 23:00 em Brasília: conta no período.
 sale(lead({daysAgo:30}),{paidDaysAgo:0,fmt:'utc'});
 // Fora: venda confirmada sem pagamento e "pago" sem data.
 sale(lead({daysAgo:30}),{status:'Venda confirmada'});
 sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at) VALUES(?,1,'x',100,'Pagamento confirmado',NULL)").run(lead({daysAgo:30}));
 // Ritmo: mais 2 vendas pagas no fim de outubro.
 sale(lead({daysAgo:40}),{paidDaysAgo:10});sale(lead({daysAgo:40}),{paidDaysAgo:20,cents:0});
 const b=await getCalculatorBase(a,{cityId:null,today:TODAY});
 assert.equal(b.paid,4,'4 vendas pagas desde 01/11');
 assert.equal(b.paidRevenueCents,480000);
 assert.deepEqual(b.series.map(s=>[s.day,s.sales]),[['2026-11-01',2],['2026-11-02',2]]);
 assert.equal(b.rates.v.source,'real');assert.equal(b.rates.v.value,6/8,'6 vendas em 8 semanas');
 assert.equal(b.rates.ticketCents.source,'real');assert.equal(b.rates.ticketCents.value,120000,'venda de R$ 0 fora do ticket');
 assert.ok(!JSON.stringify(b).includes('Pessoa '),'nenhum nome na resposta');
});

test('conversão por coorte madura, tempo até pagar e atendimentos por semana sem a importação',async()=>{
 const a=await accessFor();const {getCalculatorBase}=await calc();
 // Coorte (criados entre 150 e 60 dias atrás): 30 válidos, 3 pagaram em até 60 dias.
 for(let i=0;i<30;i++){const id=lead({daysAgo:100});if(i<3)sale(id,{paidDaysAgo:100-14});}
 // Fora da coorte: revogado, cancelado, importado e um que pagou depois de 60 dias.
 sale(lead({daysAgo:100,revoked:'2026-09-01'}),{paidDaysAgo:90});
 lead({daysAgo:100,status:'Cancelado'});
 sale(lead({daysAgo:100,label:'Importação da rede por planilha'}),{paidDaysAgo:120});
 const b=await getCalculatorBase(a,{cityId:null,today:TODAY});
 assert.equal(b.rates.c.value,3/30);assert.match(b.rates.c.base,/^30 atendimentos/);
 // Tempo até pagar: 3 vendas de 14 dias + a revogada (10) = 4 vendas: abaixo do mínimo de 5.
 assert.equal(b.rates.m.value,null);assert.equal(b.rates.m.source,'sem-dados');
 sale(lead({daysAgo:40}),{paidDaysAgo:20});// 20 dias
 sale(lead({daysAgo:30}),{paidDaysAgo:31});// negativo: fora
 const b2=await getCalculatorBase(a,{cityId:null,today:TODAY});
 assert.equal(b2.rates.m.value,14,'mediana de 10,14,14,14,20');
 // Atendimentos por semana: 4 semanas mínimas; aqui há histórico de 100 dias (8 semanas).
 assert.equal(b2.rates.N.source,'real');
 assert.equal(b2.excluded.importedLeads,1);
});

test('semanas cobertas: 4 a 7 semanas dividem pelos dias ÷ 7; com 3 semanas só o ritmo',async()=>{
 const a=await accessFor();const {getCalculatorBase}=await calc();
 lead({daysAgo:35});for(let i=0;i<4;i++)lead({daysAgo:3,channel:'Indicação'});
 sale(lead({daysAgo:20}),{paidDaysAgo:2});
 let b=await getCalculatorBase(a,{cityId:null,today:TODAY});
 assert.equal(b.rates.N.value,(1+4+1)/5,'6 atendimentos em 35 dias = 5 semanas');
 assert.equal(b.rates.v.value,1/5);
 sqlite.exec("DELETE FROM sales;DELETE FROM leads;");
 lead({daysAgo:21});sale(lead({daysAgo:10}),{paidDaysAgo:2});
 b=await getCalculatorBase(a,{cityId:null,today:TODAY});
 assert.equal(b.rates.v.value,1/3);assert.equal(b.rates.N.value,null,'3 semanas: atendimentos por semana sem dados');
 // Importação recente de vendas antigas não infla o ritmo.
 sale(lead({daysAgo:1,label:'Importação da rede por planilha'}),{paidDaysAgo:200});
 b=await getCalculatorBase(a,{cityId:null,today:TODAY});assert.equal(b.rates.v.value,1/3);
});

test('isolamento: outra empresa com cidade de mesmo nome nunca entra; cidade em Consolidado',async()=>{
 const a=await accessFor();const {getCalculatorBase}=await calc();
 const {createOrganization}=await vite.ssrLoadModule('/db/organizations.ts');
 const org=await createOrganization(a,{name:'Outra',ownerEmail:'dona@outra.invalid',ownerName:'Dona',requestId:crypto.randomUUID()});
 const other=Number(sqlite.prepare("INSERT INTO cities(organization_id,name,state,tracking_mode) VALUES(?,'Esmeraldas','MG','Detalhado')").run(org).lastInsertRowid);
 sale(lead({city:other,daysAgo:30}),{city:other,paidDaysAgo:1});
 const consolidated=Number(sqlite.prepare("INSERT INTO cities(organization_id,name,state,tracking_mode) VALUES(1,'Cidade Consolidada','MG','Consolidado')").run().lastInsertRowid);
 sqlite.prepare("INSERT INTO city_updates(city_id,period,sales) VALUES(?,'2026-11',7)").run(consolidated);
 sale(lead({city:consolidated,daysAgo:30}),{city:consolidated,paidDaysAgo:1});
 const all=await getCalculatorBase(a,{cityId:null,today:TODAY});
 assert.equal(all.paid,7,'só o fechamento consolidado, nada da outra empresa');assert.equal(all.paidSource,'misto');
 assert.equal(all.scope.consolidatedCities,1);
 const city=await getCalculatorBase(a,{cityId:consolidated,today:TODAY});
 assert.equal(city.scope.consolidated,true);assert.equal(city.paid,7);assert.equal(city.rates.v.source,'consolidado');
 await assert.rejects(getCalculatorBase(a,{cityId:other,today:TODAY}),/Cidade não encontrada/);
 // 150 cidades: nenhuma consulta passa de 100 parâmetros.
 for(let i=0;i<150;i++)sqlite.prepare("INSERT INTO cities(organization_id,name,state,tracking_mode) VALUES(1,?,'MG','Detalhado')").run('C'+i);
 await getCalculatorBase(a,{cityId:null,today:TODAY});
});

test('escopo por função: Comercial só os dele e sem custo; Coordenação e Líder só a cidade; Embaixador e Mentorado 403',async()=>{
 await accessFor();const {getCalculatorBase}=await calc();
 const add=(email,role,city)=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,?,?,?,?,1,'t','2026-01-01')").run(email,role,role,city);
 add('vend@x.invalid','Comercial',null);add('coord@x.invalid','Coordenação',1);add('lider@x.invalid','Líder',null);add('emb@x.invalid','Embaixador',1);
 sale(lead({assigned:'vend@x.invalid',daysAgo:20}),{paidDaysAgo:1});
 sale(lead({assigned:'outro@x.invalid',daysAgo:20}),{paidDaysAgo:1});
 const seller=await getCalculatorBase(await accessFor('vend@x.invalid',1),{cityId:null,today:TODAY});
 assert.equal(seller.paid,1);assert.equal(seller.scope.kind,'Pessoa');assert.equal(seller.rates.cplCents.value,null);
 assert.equal((await getCalculatorBase(await accessFor('coord@x.invalid',1),{cityId:999,today:TODAY})).scope.cityId,1,'Coordenação fica na cidade dela');
 await assert.rejects(getCalculatorBase(await accessFor('lider@x.invalid',1),{cityId:null,today:TODAY}),/Sem cidade definida/);
 await assert.rejects(getCalculatorBase(await accessFor('emb@x.invalid',1),{cityId:null,today:TODAY}),/acesso comercial/);
 const route=await vite.ssrLoadModule('/app/api/calculator/route.ts');
 globalThis.__eliteTestUser={email:'emb@x.invalid',displayName:'E'};
 assert.equal((await route.GET(new Request('https://e.invalid/api/calculator',{headers:{'X-Elite-Organization':'1'}}))).status,403);
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,'ment@x.invalid','M','Mentorado',1,1,'t','2026-01-01')").run();
 globalThis.__eliteTestUser={email:'ment@x.invalid',displayName:'M'};
 assert.equal((await route.GET(new Request('https://e.invalid/api/calculator',{headers:{'X-Elite-Organization':'1'}}))).status,403);
 globalThis.__eliteTestUser={email:OWNER,displayName:'Dono'};
 const ok=await route.GET(new Request('https://e.invalid/api/calculator',{headers:{'X-Elite-Organization':'1'}}));
 assert.equal(ok.status,200);assert.equal((await ok.json()).data.scope.kind,'Empresa');
});

test('volume: 1.200 atendimentos e 1.100 vendas com os mesmos totais do SQL direto',async()=>{
 const a=await accessFor();const {getCalculatorBase}=await calc();
 for(let i=0;i<1200;i++){const id=lead({daysAgo:5+(i%50)});if(i<1100)sale(id,{paidDaysAgo:i%30,cents:1000+i});}
 const b=await getCalculatorBase(a,{cityId:null,today:TODAY});
 const direct=sqlite.prepare("SELECT COUNT(*) n, SUM(amount_cents) c FROM sales WHERE status='Pagamento confirmado' AND substr(paid_at,1,10) BETWEEN '2026-11-01' AND '2026-11-02'").get();
 assert.equal(b.paid,direct.n);assert.equal(b.paidRevenueCents,direct.c);
});

test('record_sale mantém a data do pagamento; outra situação zera; importação mantém a data da planilha',async()=>{
 const a=await accessFor();const m=await vite.ssrLoadModule('/db/mutations.ts');const v=await vite.ssrLoadModule('/lib/expansion-validation.ts');
 const id=lead({daysAgo:5});
 const save=(status)=>m.executeAction('record_sale',v.parseActionPayload('record_sale',{leadId:id,product:'Mentoria',amountCents:150000,status}),a);
 await save('Pagamento confirmado');
 sqlite.prepare("UPDATE sales SET paid_at='2026-10-01T10:00:00-03:00' WHERE lead_id=?").run(id);
 await save('Pagamento confirmado');
 assert.equal(sqlite.prepare('SELECT paid_at p FROM sales WHERE lead_id=?').get(id).p,'2026-10-01T10:00:00-03:00','salvar de novo mantém a data');
 await save('Venda confirmada');assert.equal(sqlite.prepare('SELECT paid_at p FROM sales WHERE lead_id=?').get(id).p,null);
 await save('Pagamento confirmado');assert.notEqual(sqlite.prepare('SELECT paid_at p FROM sales WHERE lead_id=?').get(id).p,null,'nova passagem grava a data de hoje');
});

test('origem da pessoa: cada caminho grava a sua, editar não muda, passado só com prova e idempotente, cópia dos dados traz a origem',async()=>{
 const a=await accessFor();const t=await vite.ssrLoadModule('/db/territory.ts');const m=await vite.ssrLoadModule('/db/mutations.ts');const v=await vite.ssrLoadModule('/lib/expansion-validation.ts');
 const src=(id)=>sqlite.prepare('SELECT source s FROM territory_people WHERE id=?').get(id)?.s;
 const mapped=await t.mutateTerritory(a,'person',{requestId:crypto.randomUUID(),cityId:1,name:'Mapeada Pessoa',authorized:true,confirmDuplicate:true});
 assert.equal(src(mapped.id),'Mapeamento');
 await t.mutateTerritory(a,'person',{id:mapped.id,cityId:1,name:'Mapeada Editada',authorized:true});
 assert.equal(src(mapped.id),'Mapeamento','editar não muda a origem');
 const imported=await t.mutateTerritory(a,'import_people',{rows:[{cityId:1,name:'Importada Pessoa',place:'',link:'',role:''}],commit:true});
 assert.equal(imported.rows[0].ok,true);
 assert.equal(sqlite.prepare("SELECT source s FROM territory_people WHERE name='Importada Pessoa'").get().s,'Importação');
 await m.executeAction('create_lead',v.parseActionPayload('create_lead',{cityId:1,name:'Novo Atendimento',email:'novo@x.invalid',whatsapp:'',status:'Lead válido',channel:'Outro',consentAccepted:true,consentSource:'Conversa',consentPurpose:'Contato'}),a);
 assert.equal(sqlite.prepare("SELECT source s FROM territory_people WHERE name='Novo Atendimento'").get().s,'Novo atendimento');
 await m.executeAction('create_ambassador',v.parseActionPayload('create_ambassador',{cityId:1,name:'Embaixadora Nova',code:'EMB77',email:'',whatsapp:'',level:'Indicador',status:'Convidado'}),a);
 assert.equal(sqlite.prepare("SELECT source s FROM territory_people WHERE name='Embaixadora Nova'").get().s,'Embaixador');
 // Passado: pessoa antiga sem origem com atendimento de mapeamento → "Mapeamento"; sem prova, continua vazia.
 const now='2026-01-01T10:00:00-03:00';
 sqlite.prepare("INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES('p-old',1,'Antiga',?,?,?),('p-none',1,'Sem Prova',?,?,?)").run(OWNER,now,now,OWNER,now,now);
 lead({person:'p-old',label:'Mapeamento · Padaria'});
 const backfill=readFileSync(root+'drizzle/0029_person_source.sql','utf8').split('--> statement-breakpoint').slice(2).join(';');
 sqlite.exec(backfill);sqlite.exec(backfill);
 assert.equal(src('p-old'),'Mapeamento');assert.equal(src('p-none'),'');assert.equal(src(mapped.id),'Mapeamento');
 // A pessoa antiga marcada pelo preenchimento fica fora de Pm (criada antes do dia em que a origem passou a ser gravada).
 const {getCalculatorBase}=await calc();
 const b=await getCalculatorBase(a,{cityId:null});
 assert.match(b.rates.Pm.base,/^1 pessoas mapeadas/,'só a mapeada depois do início');
 const privacy=await vite.ssrLoadModule('/db/privacy.ts');
 const copy=JSON.stringify(await privacy.exportSubject(a,{subject:'person:'+mapped.id,channel:'WhatsApp',receivedAt:'2026-01-02',note:''}));
 assert.match(copy,/"origemDoCadastro":"Mapeamento"/);
});
