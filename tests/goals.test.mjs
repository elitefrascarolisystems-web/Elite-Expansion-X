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
const OWNER='teamfrascaroli@gmail.com';
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of migrations)sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:OWNER,displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

const TODAY='2026-11-02';
const goals=()=>vite.ssrLoadModule('/db/goals.ts');
const accessFor=async(email=OWNER,org)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const member=(email,role,city,org=1)=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(?,?,?,?,?,1,'t','2026-01-01')").run(org,email,'Pessoa '+role,role,city);
const city=(name,mode='Detalhado',org=1)=>Number(sqlite.prepare("INSERT INTO cities(organization_id,name,state,tracking_mode) VALUES(?,?,'MG',?)").run(org,name,mode).lastInsertRowid);
let seq=0;
function lead({cityId=1,day='2026-11-01',assigned='',label='',status='Lead válido'}={}){const at=`${day}T10:00:00-03:00`;return Number(sqlite.prepare("INSERT INTO leads(city_id,name,status,channel,source_label,assigned_to_email,consent_at,consent_source,consent_purpose,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(cityId,'Cliente '+(++seq),status,'Outro',label,assigned,at,'teste','teste',at).lastInsertRowid);}
function sale(leadId,{cityId=1,day='2026-11-01',cents=120000}={}){sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at,created_at,updated_at) VALUES(?,?,'Mentoria',?,'Pagamento confirmado',?,?,?)").run(leadId,cityId,cents,`${day}T11:00:00-03:00`,day,day);}
function opportunity(leadId,owner,cityId=1){sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,1,?,?,?,'Quente','Negociação','Ligar','2026-11-10','t','2026-11-01','2026-11-01')").run(crypto.randomUUID(),cityId,leadId,owner);}
const assumptions={ticketCents:{value:120000,source:'real'},c:{value:0.2,source:'real'},m:{value:14,source:'real'},a:{value:0.25,source:'real'},N:{value:15,source:'real'},cplCents:{value:5000,source:'real'},kv:{value:10,source:'estimativa'}};
const applyBody=(over={})=>({cityId:1,metric:'Vendas pagas',target:40,periodStart:'2026-11-01',periodEnd:'2026-12-28',assumptions,plan:{leads:150,people:432,startBy:'2026-12-14'},replace:[],...over});
const active=()=>sqlite.prepare("SELECT scope,city_id,owner_email,metric,target,period_start,period_end,status,version FROM goals WHERE status='Ativa' ORDER BY scope,metric,owner_email").all();

test('aplicar como meta: Administrador em qualquer cidade, Coordenação só na dela, Líder e Comercial não aplicam; o plano vai de hoje até a data de começar',async()=>{
 const {applyGoal}=await goals();const admin=await accessFor();const c2=city('Cidade Dois');
 member('coord@x.invalid','Coordenação',1);member('lider@x.invalid','Líder',1);member('vend@x.invalid','Comercial',1);
 await applyGoal(admin,applyBody(),TODAY);
 const rows=active();
 assert.deepEqual(rows.map(r=>[r.metric,r.target,r.period_start,r.period_end]),[['Atendimentos',150,'2026-11-02','2026-12-14'],['Pessoas mapeadas',432,'2026-11-02','2026-12-14'],['Vendas pagas',40,'2026-11-01','2026-12-28']]);
 const coord=await accessFor('coord@x.invalid',1);
 await assert.rejects(applyGoal(coord,applyBody({cityId:c2}),TODAY),/fora do seu acesso/);
 await applyGoal(coord,applyBody({cityId:1,target:45,plan:null,replace:sqlite.prepare("SELECT id,version FROM goals WHERE metric='Vendas pagas'").all().map(r=>({id:r.id,version:r.version}))}),TODAY);
 await assert.rejects(applyGoal(await accessFor('lider@x.invalid',1),applyBody({cityId:1}),TODAY),/O Líder divide/);
 await assert.rejects(applyGoal(await accessFor('vend@x.invalid',1),applyBody(),TODAY),/Somente a gestão define metas/);
 // A meta antiga virou "Substituída", com versão nova; nada de tarefa, missão, mensagem ou rotina.
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM goals WHERE status='Substituída' AND metric='Vendas pagas' AND version=2").get().n,1);
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM seller_goals").get().n,0,'aplicar nunca grava a rotina do dia');
 // Rota: Comercial 403 também pelo POST; Origin obrigatório.
 const route=await vite.ssrLoadModule('/app/api/calculator/route.ts');
 globalThis.__eliteTestUser={email:'vend@x.invalid',displayName:'V'};
 const post=(origin)=>route.POST(new Request('https://e.invalid/api/calculator',{method:'POST',headers:{'X-Elite-Organization':'1','content-type':'application/json',...(origin?{origin:'https://e.invalid'}:{})},body:JSON.stringify({action:'apply',data:applyBody()})}));
 assert.equal((await post(true)).status,403);assert.equal((await post(false)).status,403);
});

test('meta sobreposta: sem confirmar a substituição nada é gravado; versão velha devolve 409 e nenhuma meta nova sobra',async()=>{
 const {applyGoal}=await goals();const admin=await accessFor();
 await applyGoal(admin,applyBody({plan:null}),TODAY);
 const before=active();
 await assert.rejects(applyGoal(admin,applyBody({plan:null,target:30}),TODAY),e=>e.status===409);
 const old=sqlite.prepare("SELECT id,version FROM goals WHERE status='Ativa'").get();
 // Outra pessoa mudou a meta nesse meio-tempo (versão 2): o pedido com a versão 1 não grava nada.
 sqlite.prepare("UPDATE goals SET version=2 WHERE id=?").run(old.id);
 await assert.rejects(applyGoal(admin,applyBody({plan:null,target:30,replace:[{id:old.id,version:1}]}),TODAY),e=>e.status===409&&/Outra pessoa alterou/.test(e.message));
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM goals").get().n,1,'nenhuma meta nova sobrou');
 assert.equal(active()[0].target,before[0].target);
 await applyGoal(admin,applyBody({plan:null,target:30,replace:[{id:old.id,version:2}]}),TODAY);
 assert.deepEqual(active().map(r=>r.target),[30]);
 // Período sem sobreposição: convive com a atual.
 await applyGoal(admin,applyBody({plan:null,target:50,periodStart:'2027-01-01',periodEnd:'2027-01-31'}),TODAY);
 assert.equal(active().length,2);
 // Período passado e plano fora do prazo são recusados.
 await assert.rejects(applyGoal(admin,applyBody({periodStart:'2026-10-01',periodEnd:'2026-10-31',plan:null}),TODAY),/já terminou/);
 await assert.rejects(applyGoal(admin,applyBody({periodStart:'2027-02-01',periodEnd:'2027-02-28',plan:{leads:1,people:null,startBy:'2027-03-10'}}),TODAY),/data de começar/);
});

test('dividir pela equipe: a soma fecha com a meta; Líder divide; "Semana" com 25 até a data de começar e some depois',async()=>{
 const {applyGoal,splitGoal,goalProgress,splitBase}=await goals();const admin=await accessFor();
 member('lider@x.invalid','Líder',1);member('vend@x.invalid','Comercial',1);member('vend2@x.invalid','Comercial',1);member('fora@x.invalid','Comercial',null);
 const c2=city('Outra');member('outra@x.invalid','Comercial',c2);
 await applyGoal(admin,applyBody(),TODAY);
 const parent=sqlite.prepare("SELECT id FROM goals WHERE metric='Vendas pagas'").get().id;
 const lider=await accessFor('lider@x.invalid',1);
 const base=await splitBase(lider,1,TODAY);
 assert.ok(base.some(r=>r.email==='vend@x.invalid'));assert.ok(!base.some(r=>r.email==='outra@x.invalid'),'só a equipe da cidade');
 await assert.rejects(splitGoal(lider,{goalId:parent,rows:[{email:'vend@x.invalid',sales:30,leads:150,people:null}],replace:[]},TODAY),/precisa fechar com a meta da cidade \(40\)/);
 await assert.rejects(splitGoal(lider,{goalId:parent,rows:[{email:'outra@x.invalid',sales:40,leads:null,people:null}],replace:[]},TODAY),/pessoas ativas da equipe desta cidade/);
 await assert.rejects(splitGoal(await accessFor('vend@x.invalid',1),{goalId:parent,rows:[{email:'vend@x.invalid',sales:40,leads:null,people:null}],replace:[]},TODAY),/Somente a gestão/);
 await splitGoal(lider,{goalId:parent,rows:[{email:'vend@x.invalid',sales:25,leads:150,people:null},{email:'vend2@x.invalid',sales:15,leads:60,people:72}],replace:[]},TODAY);
 const mine=sqlite.prepare("SELECT metric,target,period_start,period_end FROM goals WHERE scope='Pessoa' AND owner_email='vend@x.invalid' ORDER BY metric").all();
 assert.deepEqual(mine.map(r=>[r.metric,r.target,r.period_start,r.period_end]),[['Atendimentos',150,'2026-11-02','2026-12-14'],['Vendas pagas',25,'2026-11-01','2026-12-28']]);
 // Semana de 02/11 (segunda) a 08/11: 2 atendimentos novos dele; meta da semana 150 ÷ 6 semanas = 25.
 lead({day:'2026-11-02',assigned:'vend@x.invalid'});lead({day:'2026-11-03',assigned:'vend@x.invalid'});lead({day:'2026-11-01',assigned:'vend@x.invalid'});
 const seller=await accessFor('vend@x.invalid',1);
 const p=await goalProgress(seller,{today:'2026-11-04'});
 assert.equal(p.people.length,1,'o Comercial vê só a linha dele');
 assert.deepEqual(p.people[0].week,{done:2,target:25});
 assert.equal(p.people[0].sales.target,25);
 const after=await goalProgress(seller,{today:'2026-12-15'});
 assert.equal(after.people[0].week,null,'depois da data de começar a linha "Semana" some');
 // Dividir de novo substitui as metas por pessoa da cidade (com confirmação, pela versão).
 const replace=sqlite.prepare("SELECT id,version FROM goals WHERE scope='Pessoa' AND status='Ativa'").all().map(r=>({id:r.id,version:r.version}));
 await assert.rejects(splitGoal(lider,{goalId:parent,rows:[{email:'vend@x.invalid',sales:40,leads:null,people:null}],replace:[]},TODAY),e=>e.status===409);
 await splitGoal(lider,{goalId:parent,rows:[{email:'vend@x.invalid',sales:40,leads:null,people:null}],replace},TODAY);
 assert.deepEqual(sqlite.prepare("SELECT owner_email,metric,target FROM goals WHERE scope='Pessoa' AND status='Ativa'").all().map(r=>[r.owner_email,r.metric,r.target]),[['vend@x.invalid','Vendas pagas',40]]);
 // Auditoria sem nomes nem e-mails.
 const logs=sqlite.prepare("SELECT action,summary FROM audit_logs WHERE action IN ('goal_apply','goal_split')").all();
 assert.deepEqual([...new Set(logs.map(l=>l.action))].sort(),['goal_apply','goal_split']);
 for(const l of logs){assert.ok(!l.summary.includes('@'),l.summary);assert.ok(!/Pessoa |Cliente /.test(l.summary));}
});

test('progresso: venda sem responsável conta na cidade e na empresa e fica fora das pessoas; cidade em Consolidado; isolamento',async()=>{
 const {applyGoal,splitGoal,goalProgress}=await goals();const admin=await accessFor();
 member('vend@x.invalid','Comercial',1);member('ex@x.invalid','Comercial',1);sqlite.prepare("UPDATE app_users SET active=0 WHERE email='ex@x.invalid'").run();
 await applyGoal(admin,applyBody({plan:null}),TODAY);
 const parent=sqlite.prepare("SELECT id FROM goals WHERE metric='Vendas pagas'").get().id;
 await splitGoal(admin,{goalId:parent,rows:[{email:'vend@x.invalid',sales:40,leads:null,people:null}],replace:[]},TODAY);
 // Dele pela oportunidade (mesmo com outro na Agenda), dele pela Agenda, importada sem ninguém, de quem saiu da equipe.
 const l1=lead({assigned:'ex@x.invalid'});opportunity(l1,'vend@x.invalid');sale(l1);
 sale(lead({assigned:'vend@x.invalid'}),{day:'2026-11-02'});
 sale(lead({label:'Importação da rede por planilha'}));
 sale(lead({assigned:'ex@x.invalid'}));
 sale(lead({assigned:'vend@x.invalid'}),{day:'2026-10-31'});// antes do período
 const consolidated=city('Consolidada','Consolidado');
 sqlite.prepare("INSERT INTO city_updates(city_id,period,sales) VALUES(?,'2026-11',7)").run(consolidated);
 await applyGoal(admin,applyBody({cityId:consolidated,target:10,plan:null}),TODAY);
 const p=await goalProgress(admin,{today:TODAY});
 const c1=p.cities.find(c=>c.cityId===1);
 assert.equal(c1.goal.realized,4,'cidade: as 4 vendas do período');
 assert.equal(p.people.find(x=>x.email==='vend@x.invalid').sales.realized,2,'pessoa: só as 2 dela');
 assert.equal(p.unowned,2,'sem responsável: a importada e a de quem não é mais da equipe');
 const cc=p.cities.find(c=>c.cityId===consolidated);
 assert.equal(cc.goal.realized,7);assert.equal(cc.goal.consolidated,true);
 assert.deepEqual(p.company.sum&&[p.company.sum.target,p.company.sum.realized,p.company.sum.withGoal],[50,11,2],'empresa: soma das metas das cidades');
 // Meta da empresa, quando existe, vem antes da soma.
 await applyGoal(admin,applyBody({cityId:null,target:60,plan:null}),TODAY);
 const q=await goalProgress(admin,{today:TODAY});
 assert.equal(q.company.goal.target,60);assert.equal(q.company.goal.realized,11);
 // Outra empresa: não vê nada desta, nem com cidade de mesmo nome.
 const {createOrganization}=await vite.ssrLoadModule('/db/organizations.ts');
 const org=await createOrganization(admin,{name:'Outra',ownerEmail:'dona@outra.invalid',ownerName:'Dona',requestId:crypto.randomUUID()});
 const other=await accessFor('dona@outra.invalid',org);
 const o=await goalProgress(other,{today:TODAY});
 assert.equal(o.company.goal,null);assert.equal(o.company.sum,null);assert.equal(o.cities.length,0);
 assert.equal((await (await goals()).listGoals(other)).length,0);
 // A Assessoria grava como Administrador e aparece marcada no Histórico (autor assessor que não é membro).
 const advisory=await accessFor(OWNER,org);assert.equal(advisory.isAdvisory,true);
 sqlite.prepare("INSERT OR IGNORE INTO platform_advisors(email,name,active,granted_by,granted_at) VALUES(?,'Assessor',1,?,'2026-01-01')").run(OWNER,OWNER);
 const c3=city('Cidade da outra','Detalhado',org);
 await applyGoal(advisory,applyBody({cityId:c3,plan:null}),TODAY);
 const mark=sqlite.prepare(`SELECT (EXISTS(SELECT 1 FROM platform_advisors adv WHERE lower(adv.email)=lower(a.actor_email)) AND NOT EXISTS(SELECT 1 FROM app_users m WHERE m.organization_id=a.organization_id AND lower(m.email)=lower(a.actor_email))) AS advisory FROM audit_logs a WHERE a.action='goal_apply' AND a.organization_id=?`).get(org);
 assert.equal(mark.advisory,1);
});

test('Comercial recebe da foto só as premissas que usa, sem base, sem números da cidade e sem custo',async()=>{
 const {applyGoal}=await goals();const admin=await accessFor();
 member('vend@x.invalid','Comercial',1);
 await applyGoal(admin,applyBody({plan:null}),TODAY);
 const route=await vite.ssrLoadModule('/app/api/calculator/route.ts');
 globalThis.__eliteTestUser={email:'vend@x.invalid',displayName:'V'};
 const r=await route.GET(new Request('https://e.invalid/api/calculator',{headers:{'X-Elite-Organization':'1'}}));
 assert.equal(r.status,200);const body=await r.json();
 assert.deepEqual(Object.keys(body.goals.premises).sort(),['a','c','m','ticketCents']);
 assert.equal(body.goals.premises.c,0.2);
 const text=JSON.stringify(body.goals);
 for(const word of ['cplCents','"N"','kv','base','assumptions'])assert.ok(!text.includes(word),word);
 assert.deepEqual(body.goals.active,[],'a meta da cidade não vai para o Comercial');
 assert.deepEqual(body.goals.history,[]);
});

test('trocar o responsável em "Etapa e autorização" troca também o da oportunidade, na mesma gravação',async()=>{
 const admin=await accessFor();member('vend@x.invalid','Comercial',1);member('vend2@x.invalid','Comercial',1);
 const l=lead({assigned:'vend@x.invalid'});opportunity(l,'vend@x.invalid');
 const {executeAction}=await vite.ssrLoadModule('/db/mutations.ts');
 await executeAction('update_lead',{leadId:l,status:'Lead válido',assignedToEmail:'vend2@x.invalid',consentRevoked:false,consentRevocationReason:null},admin);
 const o=sqlite.prepare("SELECT owner_email,version FROM opportunities WHERE lead_id=?").get(l);
 assert.equal(o.owner_email,'vend2@x.invalid');assert.equal(o.version,2);
 assert.equal(sqlite.prepare("SELECT assigned_to_email FROM leads WHERE id=?").get(l).assigned_to_email,'vend2@x.invalid');
});

test('regras puras: semana, divisão proporcional, texto da confirmação e da lista de metas anteriores',async()=>{
 const g=await vite.ssrLoadModule('/lib/goals.ts');
 assert.deepEqual(g.weekOf('2026-11-04'),{start:'2026-11-02',end:'2026-11-08'});
 assert.deepEqual(g.weekOf('2026-11-08'),{start:'2026-11-02',end:'2026-11-08'});
 assert.equal(g.weeklyTarget({periodStart:'2026-11-02',periodEnd:'2026-12-14',target:150},'2026-11-02'),25);
 assert.equal(g.weeklyTarget({periodStart:'2026-11-02',periodEnd:'2026-12-14',target:150},'2026-12-15'),null);
 assert.deepEqual(g.proportionalSplit(40,[6,3,1]),[24,12,4]);
 assert.deepEqual(g.proportionalSplit(10,[0,0,0]),[4,3,3]);
 assert.equal(g.proportionalSplit(7,[1,1,1]).reduce((s,x)=>s+x,0),7);
 assert.equal(g.applySummary({scopeName:'da Cidade Exemplo',metric:'Vendas pagas',target:40,periodStart:'2026-11-01',periodEnd:'2026-12-28',plan:{leads:150,people:432,from:'2026-11-02',startBy:'2026-12-14'},replaced:[{metric:'Vendas pagas',target:30}]}),
  'Meta da Cidade Exemplo: 40 vendas pagas de 01/11 a 28/12. Plano de 02/11 até 14/12: 150 atendimentos e 432 pessoas mapeadas. Substitui a meta atual (30).');
 assert.equal(g.historyLine({metric:'Vendas pagas',target:30,periodStart:'2026-10-01',periodEnd:'2026-10-31'},27),'out/2026: 30 → 27 (90%)');
});
