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
const OWNER='teamfrascaroli@gmail.com',CLIENT='dona@cliente.invalid';
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:OWNER,displayName:'Dono'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

const privacy=()=>vite.ssrLoadModule('/db/privacy.ts');
const accessOf=async(email,org=1)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const one=(sql,...args)=>sqlite.prepare(sql).get(...args);
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const PERSON='11111111-1111-4111-8111-111111111111',OPP='22222222-2222-4222-8222-222222222222',PLACE='33333333-3333-4333-8333-333333333333';

/** Uma pessoa completa: no mapa (com local, papel e ponto), contato autorizado, atendimento, venda e embaixador. */
async function seed(){
 const admin=await accessOf(OWNER);const city=one('SELECT id FROM cities WHERE organization_id=1').id;
 sqlite.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,created_by,created_at,updated_at) VALUES(?,1,?,'Padaria Central','Padaria','Teste','padaria central',?,'Identificada','t','2026-10-01','2026-10-01')").run(PLACE,city,OWNER);
 sqlite.prepare("INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at,place_id,place_link,leader) VALUES(?,?,'Maria Titular Souza',?,'2026-10-01','2026-10-01',?,'Sócio / dono',1)").run(PERSON,city,OWNER,PLACE);
 sqlite.prepare("INSERT INTO territory_roles(id,person_id,city_id,role,status,source,authorized_by,created_at,updated_at) VALUES(?,?,?,'Mentorado','Ativo','Teste',?,'2026-10-01','2026-10-01')").run(crypto.randomUUID(),PERSON,city,OWNER);
 sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,precision,source,authorized_by,authorized_at,updated_at) VALUES(?,?,-19.9,-44.1,'Local comercial','Teste',?,'2026-10-01','2026-10-01')").run('person:'+PERSON,city,OWNER);
 sqlite.prepare("INSERT INTO territory_actions(id,city_id,person_id,name,category,status,responsible,due_date,created_by,created_at,updated_at) VALUES(?,?,?,'Ligar para Maria sobre a mentoria','Contato','Pendente','Equipe','2026-10-30',?,'2026-10-01','2026-10-01')").run(crypto.randomUUID(),city,PERSON,OWNER);
 const lead=sqlite.prepare("INSERT INTO leads(person_id,city_id,name,email,whatsapp,normalized_email,normalized_whatsapp,channel,consent_at,consent_source,consent_purpose,assigned_to_email,created_at) VALUES(?,?,'Maria Titular Souza','maria@exemplo.invalid','(31) 99999-1234','maria@exemplo.invalid','31999991234','WhatsApp','2026-10-01','Conversa','Contato comercial',?,'2026-10-01')").run(PERSON,city,OWNER).lastInsertRowid;
 sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,business_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at,followup_json) VALUES(?,1,?,?,?,?,'Quente','Proposta','Mandar proposta para Maria','2026-10-25',?,'2026-10-01','2026-10-01','{\"nota\":\"Maria prefere à tarde\"}')").run(OPP,city,lead,PLACE,OWNER,OWNER);
 sqlite.prepare("INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at) VALUES(?,1,?,?,?,'Follow-up','Maria pediu desconto','2026-10-02','2026-10-02')").run(crypto.randomUUID(),city,OPP,OWNER);
 sqlite.prepare("INSERT INTO followup_events(id,organization_id,opportunity_id,actor_email,request_json,action,note,before_json,after_json,created_at) VALUES(?,1,?,?,'{\"note\":\"Maria\"}','contact','Falei com Maria','{}','{\"nextAction\":\"Maria\"}','2026-10-02')").run(crypto.randomUUID(),OPP,OWNER);
 sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at,created_at) VALUES(?,?,'Mentoria',150000,'Pagamento confirmado','2026-10-05','2026-10-05')").run(lead,city);
 const amb=sqlite.prepare("INSERT INTO ambassadors(person_id,city_id,name,code,email,whatsapp,whatsapp_authorized_at,status,level,created_by,created_at,updated_at) VALUES(?,?,'Maria Titular Souza','MARIA1','maria@exemplo.invalid','31999991234','2026-10-01','Ativo','Indicador','t','2026-10-01','2026-10-01')").run(PERSON,city).lastInsertRowid;
 sqlite.prepare("INSERT INTO ambassador_updates(ambassador_id,period,note) VALUES(?,'2026-10','Maria trouxe 3 indicações')").run(amb);
 sqlite.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(1,?,'create_ambassador','ambassador',?,'Embaixador Maria Titular Souza cadastrado.','2026-10-01')").run(OWNER,amb);
 return {admin,city,lead:Number(lead),amb:Number(amb)};
}
const req=(subject,extra={})=>({subject,channel:'E-mail',receivedAt:today,note:'',...extra});

test('LGPD: busca por nome, e-mail ou WhatsApp junta mapa, contato e embaixador; só o administrador',async()=>{
 const p=await privacy();const {admin,city}=await seed();
 sqlite.prepare("INSERT INTO ambassadors(city_id,name,code,whatsapp,status,level,created_by,created_at,updated_at) VALUES(?,'João Outro','JOAO1','31977776666','Ativo','Indicador','t','2026-10-01','2026-10-01')").run(city);
 for(const q of ['Titular Souza','maria@exemplo','99999-1234']){const found=await p.searchSubjects(admin,q);assert.equal(found.length,1,q);assert.equal(found[0].ref,'person:'+PERSON);assert.deepEqual(found[0].sources,['Mapa','Contato','Embaixador']);}
 const d=await p.subjectDetails(admin,'person:'+PERSON);
 assert.equal(d.place,'Padaria Central');assert.equal(d.consent,'vigente');assert.deepEqual(d.counts,{roles:1,actions:1,activities:1,history:1,sale:true,updates:1});
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,'vendas@elite.invalid','V','Comercial',1,1,'t','2026-01-01')").run();
 const seller=await accessOf('vendas@elite.invalid');
 await assert.rejects(p.searchSubjects(seller,'Maria'),/Somente o administrador/);
 sqlite.prepare("INSERT INTO organizations(id,name,owner_email,active,created_at) VALUES(7,'Outra','dona@outra.invalid',1,'2026-01-01')").run();
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(7,'dona@outra.invalid','D','Administrador',1,'t','2026-01-01')").run();
 const other=await accessOf('dona@outra.invalid',7);
 assert.deepEqual(await p.searchSubjects(other,'Maria'),[],'outra empresa não encontra o titular');
 await assert.rejects(p.subjectDetails(other,'person:'+PERSON),/não encontrado/);
});

test('LGPD: cópia dos dados traz tudo o que está guardado e registra o pedido com prazo',async()=>{
 const p=await privacy();const {admin}=await seed();
 const {data}=await p.exportSubject(admin,req('lead:'+one('SELECT id FROM leads').id,{channel:'WhatsApp'}));
 assert.equal(data.titular.nome,'Maria Titular Souza');
 assert.equal(data.mapa.local,'Padaria Central');assert.equal(data.mapa.papeis[0].papel,'Mentorado');assert.equal(data.mapa.acoes.length,1);
 assert.equal(data.mapa.exibidoNoMapa,'No local ligado à pessoa');assert.deepEqual(data.mapa.rede,{foiIndicada:false,pessoasIndicadas:0});assert.equal(data.mapa.bairro,null);
 assert.equal(data.contato.email,'maria@exemplo.invalid');assert.equal(data.contato.autorizacao.finalidade,'Contato comercial');
 assert.equal(data.atendimento.atividades[0].nota,'Maria pediu desconto');assert.equal(data.atendimento.historico.length,1);
 assert.equal(data.venda.valor,1500);assert.equal(data.embaixador.codigo,'MARIA1');assert.equal(data.embaixador.atualizacoes.length,1);
 const list=await p.listRequests(admin);
 assert.equal(list.length,1);assert.equal(list[0].kind,'acesso');assert.equal(list[0].subjectLabel,'Maria Titular Souza');assert.equal(list[0].onTime,true);
 assert.equal(one('SELECT subject_ref FROM privacy_requests').subject_ref,'person:'+PERSON,'pedido fica na referência do mapa');
 await assert.rejects(p.exportSubject(admin,req('person:'+PERSON,{receivedAt:'2999-01-01'})),/futuro/);
});

test('LGPD: correção atualiza nome e contatos em todos os cadastros; revogação encerra o contato',async()=>{
 const p=await privacy();const {admin,lead,amb}=await seed();
 await p.correctSubject(admin,req('person:'+PERSON,{name:'Maria T. Souza',email:'maria.nova@exemplo.invalid',whatsapp:'(31) 98888-0000'}));
 assert.equal(one('SELECT name FROM territory_people').name,'Maria T. Souza');
 assert.deepEqual({...one('SELECT name,email,normalized_email,normalized_whatsapp FROM leads')},{name:'Maria T. Souza',email:'maria.nova@exemplo.invalid',normalized_email:'maria.nova@exemplo.invalid',normalized_whatsapp:'31988880000'});
 assert.equal(one('SELECT email FROM ambassadors WHERE id=?',amb).email,'maria.nova@exemplo.invalid');
 await assert.rejects(p.correctSubject(admin,req('person:'+PERSON,{name:'Maria',whatsapp:'123'})),/WhatsApp/);
 await p.revokeSubject(admin,req('ambassador:'+amb));
 const l=one('SELECT status,consent_revoked_at,consent_revocation_reason FROM leads WHERE id=?',lead);
 assert.equal(l.status,'Cancelado');assert.ok(l.consent_revoked_at);assert.equal(l.consent_revocation_reason,'Pedido do titular (LGPD)');
 assert.equal(one('SELECT whatsapp_authorized_at FROM ambassadors').whatsapp_authorized_at,null);
 assert.equal((await p.subjectDetails(admin,'person:'+PERSON)).consent,'revogada');
 assert.deepEqual((await p.listRequests(admin)).map(r=>r.kind).sort(),['correcao','revogacao']);
});

test('LGPD: anonimização tira tudo o que identifica, mantém os números e não pode ser repetida',async()=>{
 const p=await privacy();const {admin,lead,amb}=await seed();
 const reg=crypto.randomUUID();sqlite.prepare("INSERT INTO territory_regions(id,city_id,name,name_key,created_by,created_at,updated_at) VALUES(?,(SELECT city_id FROM territory_people WHERE id=?),'Centro','centro','t','2026-10-01','2026-10-01')").run(reg,PERSON);sqlite.prepare('UPDATE territory_people SET region_id=? WHERE id=?').run(reg,PERSON);
 const copy=(await p.exportSubject(admin,req('person:'+PERSON,{note:'Pedido enviado pela Maria'}))).data;
 assert.equal(copy.mapa.bairro,'Centro','a cópia traz o bairro');
 await assert.rejects(p.anonymizeSubject(admin,req('person:'+PERSON)),/Confirme/);
 const {label}=await p.anonymizeSubject(admin,req('person:'+PERSON,{confirm:true}));
 assert.match(label,/^Titular anonimizado [0-9A-F]{6}$/);
 const dump=JSON.stringify(sqlite.prepare("SELECT * FROM territory_people").all())+JSON.stringify(sqlite.prepare("SELECT * FROM leads").all())+JSON.stringify(sqlite.prepare("SELECT * FROM opportunities").all())
  +JSON.stringify(sqlite.prepare("SELECT * FROM commercial_activities").all())+JSON.stringify(sqlite.prepare("SELECT * FROM followup_events").all())+JSON.stringify(sqlite.prepare("SELECT * FROM ambassadors").all())
  +JSON.stringify(sqlite.prepare("SELECT * FROM ambassador_updates").all())+JSON.stringify(sqlite.prepare("SELECT * FROM territory_actions").all())+JSON.stringify(sqlite.prepare("SELECT * FROM audit_logs").all())+JSON.stringify(sqlite.prepare("SELECT * FROM privacy_requests").all());
 for(const trace of ['Maria','maria@','99999','Sócio','-19.9'])assert.ok(!dump.includes(trace),'sobrou: '+trace);
 assert.equal(one('SELECT place_id FROM territory_people').place_id,null);
 assert.equal(one('SELECT region_id FROM territory_people').region_id,null,'o bairro sai junto com o resto');
 assert.equal(one('SELECT COUNT(*) AS n FROM territory_roles').n,0);assert.equal(one('SELECT COUNT(*) AS n FROM territory_locations').n,0);
 assert.deepEqual({...one('SELECT amount_cents,status FROM sales WHERE lead_id=?',lead)},{amount_cents:150000,status:'Pagamento confirmado'},'a venda fica para a contabilidade');
 assert.equal(one('SELECT status FROM ambassadors WHERE id=?',amb).status,'Desligado');
 assert.equal(one('SELECT status FROM leads').status,'Cancelado');
 assert.deepEqual((await p.listRequests(admin)).map(r=>[r.kind,r.subjectLabel]).sort(),[['acesso',label],['anonimizacao',label]]);
 assert.deepEqual(await p.searchSubjects(admin,'Maria'),[]);
 assert.equal((await p.subjectDetails(admin,'person:'+PERSON)).anonymized,true);
 await assert.rejects(p.anonymizeSubject(admin,req('person:'+PERSON,{confirm:true})),/já foi anonimizado/);
 await assert.rejects(p.correctSubject(admin,req('person:'+PERSON,{name:'Outra'})),/já foi anonimizado/);
});
