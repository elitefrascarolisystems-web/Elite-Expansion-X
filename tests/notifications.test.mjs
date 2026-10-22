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
const n=()=>vite.ssrLoadModule('/db/notifications.ts');
const lib=()=>vite.ssrLoadModule('/lib/notifications.ts');
const accessOf=async(email,org=1)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const SELLER='vendas@elite.invalid';
const CONFIG={configured:true,missing:[],from:'Elite <avisos@elite.invalid>',appUrl:'https://app.elite.invalid',key:'x'};
// Segunda-feira, 26/10/2026, 7h30 em Brasília.
const MONDAY=Date.parse('2026-10-26T10:30:00Z'),TUESDAY=MONDAY+86_400_000;
function outbox(fail){const sent=[];return {sent,send:async(to,content)=>{if(fail)throw new Error('Serviço fora do ar');sent.push({to,...content});}};}
async function seed(){
 await accessOf(OWNER);const city=sqlite.prepare('SELECT id FROM cities WHERE organization_id=1').get().id;
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,?,'Paula Vendas','Comercial',?,1,'t','2026-01-01')").run(SELLER,city);
 const lead=sqlite.prepare("INSERT INTO leads(city_id,name,channel,consent_at,consent_source,consent_purpose,assigned_to_email,created_at) VALUES(?,'Bruno <b>Cliente</b>','WhatsApp','2026-10-01','Conversa','Contato comercial',?,'2026-10-20')").run(city,SELLER).lastInsertRowid;
 sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,1,?,?,?,'Quente','Contato','Ligar para fechar proposta','2026-10-24',?,'2026-10-20','2026-10-20')").run(crypto.randomUUID(),city,lead,SELLER,SELLER);
 sqlite.prepare("INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES(?,?,'Nova pessoa','t','2026-10-21','2026-10-21')").run(crypto.randomUUID(),city);
 // A venda é de outro contato: contato já pago não gera lembrete de retorno.
 const buyer=sqlite.prepare("INSERT INTO leads(city_id,name,channel,consent_at,consent_source,consent_purpose,assigned_to_email,created_at) VALUES(?,'Cliente Pago','WhatsApp','2026-10-01','Conversa','Contato comercial',?,'2026-10-20')").run(city,SELLER).lastInsertRowid;
 sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at,created_at) VALUES(?,?,'Mentoria',99700,'Pagamento confirmado','2026-10-22','2026-10-22')").run(buyer,city);
 sqlite.prepare("INSERT INTO subscription_requests(id,company,contact_name,email,whatsapp,city,team_size,consent_at,ip_hash,created_at,updated_at) VALUES(?,'Academia X','Carla','c@x.invalid','31988887777','BH','2 a 5 pessoas','2026-10-23','h','2026-10-23','2026-10-23')").run(crypto.randomUUID());
 return {city};
}

test('avisos: o conteúdo do e-mail é seguro e só sai quando há o que fazer',async()=>{
 const l=await lib();
 assert.equal(l.dailyEmail({name:'Ana',organization:'Elite',organizationId:1,appUrl:'',unsubscribeUrl:'',late:0,today:0,upcoming:3,items:[]}),null,'sem retorno no dia, sem e-mail');
 const mail=l.dailyEmail({name:'Ana Souza',organization:'Elite',organizationId:1,appUrl:'https://app.invalid',unsubscribeUrl:'https://app.invalid/avisos/sair?t=abc&tipo=diario',late:1,today:1,upcoming:0,items:[{leadName:'<script>x</script>',cityName:'BH',nextAction:'Ligar',dueAt:'2026-10-20T15:00:00-03:00',late:true}]});
 assert.match(mail.subject,/1 retorno atrasado e 1 para hoje/);
 assert.ok(!mail.html.includes('<script>x'),'nome escapado');assert.ok(mail.html.includes('&lt;script&gt;'));
 assert.ok(mail.html.includes('https://app.invalid/?org=1&amp;area=vendas&amp;ver=agenda'));assert.ok(mail.text.includes('Parar de receber: https://app.invalid/avisos/sair?t=abc&tipo=diario'));
 assert.equal(l.weekdayInBrazil(MONDAY),1);assert.equal(l.weekdayInBrazil(Date.parse('2026-10-26T02:00:00Z')),7,'domingo à noite em Brasília ainda é domingo');
});

test('avisos: a rodada manda o diário de quem atende e o resumo de segunda para o administrador, uma vez só',async()=>{
 const m=await n();await seed();const box=outbox();
 const r=await m.runNotifications(MONDAY,box.send,CONFIG);
 const byTo=Object.groupBy(box.sent,(x)=>x.to);
 // Os dois donos da plataforma são administradores da Elite: os dois recebem o resumo.
 assert.deepEqual(Object.keys(byTo).sort(),['elitefrascarolisystems@gmail.com',OWNER,SELLER].sort());
 assert.match(byTo[SELLER][0].subject,/1 retorno atrasado/);assert.ok(byTo[SELLER][0].html.includes('Bruno &lt;b&gt;Cliente&lt;/b&gt;'));
 const weekly=byTo[OWNER].find((x)=>x.subject.startsWith('Resumo da semana'));
 assert.ok(weekly,'administrador recebe o resumo');assert.match(weekly.subject,/19\/10 a 25\/10/);
 assert.ok(weekly.text.includes('Pessoas mapeadas: 1'));assert.ok(weekly.text.includes('Vendas confirmadas: 1'));assert.ok(weekly.text.includes('- Paula Vendas: 1'));
 assert.ok(weekly.text.includes('1 pedido(s) de assinatura novo(s)'),'dono da plataforma vê os pedidos');
 assert.equal(byTo[OWNER].length,1,'dono sem retorno no dia não recebe o diário');
 assert.deepEqual([r.sent,r.failed],[3,0]);
 const again=await m.runNotifications(MONDAY+3_600_000,box.send,CONFIG);
 assert.equal(again.sent,0,'não repete no mesmo dia');
 const tuesday=await m.runNotifications(TUESDAY,box.send,CONFIG);
 assert.equal(tuesday.sent,1,'terça: só o diário de quem tem retorno');
});

test('avisos: sem serviço configurado nada sai; falha do serviço fica registrada',async()=>{
 const m=await n();await seed();const box=outbox();
 const off=await m.runNotifications(MONDAY,box.send,{...CONFIG,configured:false,missing:['RESEND_API_KEY']});
 assert.equal(box.sent.length,0);assert.equal(off.configured,false);
 assert.match(sqlite.prepare('SELECT detail FROM notification_runs').get().detail,/RESEND_API_KEY/);
 const broken=await m.runNotifications(MONDAY,outbox(true).send,CONFIG);
 assert.equal(broken.failed,3);
 assert.deepEqual(sqlite.prepare("SELECT DISTINCT status FROM notification_log").all().map(r=>r.status),['falhou']);
});

test('avisos: cada pessoa escolhe; o administrador ajusta a equipe; o link do e-mail desliga sem login',async()=>{
 const m=await n();await seed();const owner=await accessOf(OWNER),seller=await accessOf(SELLER);
 assert.deepEqual(await m.myPrefs(seller),{daily:true,weekly:false,canWeekly:false,configured:false});
 await m.setPrefs(seller,{daily:false,weekly:true});
 assert.deepEqual(await m.myPrefs(seller),{daily:false,weekly:false,canWeekly:false,configured:false},'semanal é só para administrador');
 await assert.rejects(m.setPrefs(seller,{email:OWNER,daily:false,weekly:false}),/Só o administrador/);
 await m.setPrefs(owner,{email:SELLER,daily:true,weekly:false});
 const box=outbox();await m.runNotifications(TUESDAY,box.send,CONFIG);
 assert.deepEqual(box.sent.map(x=>x.to),[SELLER]);
 const link=box.sent[0].text.match(/sair\?t=([0-9a-f]{32})&tipo=diario/);assert.ok(link,'e-mail traz o link de saída');
 assert.deepEqual(await m.unsubscribe(link[1],'diario'),{organization:'Elite Frascaroli Academy',kind:'diario'});
 assert.equal((await m.myPrefs(seller)).daily,false);
 assert.equal(await m.unsubscribe('0'.repeat(32),'diario'),null);assert.equal(await m.unsubscribe(link[1],'outro'),null);
 await assert.rejects(m.notificationsOverview(seller,'https://x.invalid'),/Somente o administrador/);
 const overview=await m.notificationsOverview(owner,'https://x.invalid',TUESDAY);
 assert.equal(overview.configured,false);assert.ok(overview.people.some(p=>p.email===SELLER&&p.daily===false));assert.ok(overview.preview.weekly.subject);
});
