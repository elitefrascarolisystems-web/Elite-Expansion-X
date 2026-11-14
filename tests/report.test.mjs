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
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Dono'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

// Relatório executivo do mês: só a gestão, mês válido, contagens do mês e escopo da cidade.
const OWNER='teamfrascaroli@gmail.com';
const load=async()=>{const m={...await vite.ssrLoadModule('/db/access.ts'),...await vite.ssrLoadModule('/db/report.ts')};await m.getUserAccess(OWNER,'Dono',1);return m;};
const member=(org,email,role='Administrador',cityId=null)=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(?,?,?,?,?,1,'teste','2026-01-01')").run(org,email,'Pessoa '+email,role,cityId);
const clientOrg=(name)=>Number(sqlite.prepare("INSERT INTO organizations(name,owner_email,active,created_at) VALUES(?,'dono@cliente.invalid',1,'2026-01-01')").run(name).lastInsertRowid);
const city=(org,name)=>Number(sqlite.prepare("INSERT INTO cities(name,state,organization_id) VALUES(?,'SP',?)").run(name,org).lastInsertRowid);
let seq=0;const id=(p)=>`${p}-${++seq}`;
const place=(org,c,at)=>sqlite.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,created_by,created_at,updated_at) VALUES(?,?,?,?,'Comércio','manual',?,'x','Ativo','x',?,?)").run(id('b'),org,c,'Local '+seq,id('k'),at,at);
const person=(c,at)=>sqlite.prepare("INSERT INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES(?,?,?,'x',?,?)").run(id('p'),c,'Pessoa '+seq,at,at);
const lead=(c)=>Number(sqlite.prepare("INSERT INTO leads(city_id,name,channel,consent_at,consent_source,consent_purpose) VALUES(?,'Contato','Indicação','2026-01-01','teste','atendimento')").run(c).lastInsertRowid);
function opportunity(org,c,at,to=null,toAt=at){const o=id('o');sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,?,?,?,'x','Quente',?,'ligar','2026-12-01','x',?,?)").run(o,org,c,lead(c),to??'Novo',at,at);
 if(to)sqlite.prepare("INSERT INTO opportunity_stage_events(id,organization_id,opportunity_id,from_stage,to_stage,actor_email,source,created_at) VALUES(?,?,?,'Novo',?,'x','teste',?)").run(id('e'),org,o,to,toAt);}
const decision=(org,c,at)=>sqlite.prepare("INSERT INTO city_decisions(id,organization_id,city_id,owner_email,decision,reason,next_action,review_date,created_at) VALUES(?,?,?,'admin@r.invalid','Avançar','Meta batida','Abrir bairro novo','2026-12-01',?)").run(id('d'),org,c,at);

test('só a gestão vê; mês inválido ou que não começou é recusado', async()=>{
 const m=await load();const org=clientOrg('Relatório');const c=city(org,'Campinas');
 member(org,'admin@r.invalid');member(org,'vendas@r.invalid','Comercial',c);member(org,'coord@r.invalid','Coordenação',c);
 const admin=await m.getTeamAccess('admin@r.invalid','Admin',org);
 await assert.rejects(m.monthlyReport(await m.getTeamAccess('vendas@r.invalid','Vendas',org),'2026-10'),{status:403});
 await assert.rejects(m.monthlyReport(admin,'2026-13'),/mês válido/);
 await assert.rejects(m.monthlyReport(admin,'outubro'),/mês válido/);
 await assert.rejects(m.monthlyReport(admin,'2999-01'),/já começou/);
 const r=await m.monthlyReport(await m.getTeamAccess('coord@r.invalid','Coord',org),'2026-10');
 assert.equal(r.asOf,'2026-10-31','mês fechado: metas como estavam no último dia');
 assert.ok(r.goals&&Array.isArray(r.goals.cities));
});

test('conta só o que aconteceu no mês, e a coordenação vê só a própria cidade', async()=>{
 const m=await load();const org=clientOrg('Contas');const a=city(org,'Campinas'),b=city(org,'Santos');
 member(org,'admin@r.invalid');member(org,'coord@r.invalid','Coordenação',a);
 place(org,a,'2026-10-05 10:00:00');place(org,a,'2026-10-20 10:00:00');place(org,a,'2026-09-30 23:00:00');place(org,b,'2026-10-07 09:00:00');
 person(a,'2026-10-02 08:00:00');person(b,'2026-10-03 08:00:00');person(b,'2026-11-01 08:00:00');
 opportunity(org,a,'2026-10-01 09:00:00','Ganho','2026-10-15 09:00:00');opportunity(org,a,'2026-09-20 09:00:00','Perdido','2026-10-02 09:00:00');
 opportunity(org,b,'2026-10-10 09:00:00');opportunity(org,b,'2026-10-11 09:00:00','Ganho','2026-11-02 09:00:00');
 decision(org,a,'2026-10-25 17:00:00');decision(org,b,'2026-09-25 17:00:00');
 const all=await m.monthlyReport(await m.getTeamAccess('admin@r.invalid','Admin',org),'2026-10');
 assert.deepEqual(all.mapping.map(x=>[x.name,x.places,x.people]),[['Campinas',2,1],['Santos',1,1]]);
 assert.deepEqual(all.opportunities,{created:3,won:1,lost:1},'abertos em outubro; ganho e perda contam pelo dia da mudança de etapa');
 assert.equal(all.decisions.length,1);assert.equal(all.decisions[0].city,'Campinas');assert.equal(all.decisions[0].nextAction,'Abrir bairro novo');
 const own=await m.monthlyReport(await m.getTeamAccess('coord@r.invalid','Coord',org),'2026-10');
 assert.deepEqual(own.mapping.map(x=>x.name),['Campinas'],'coordenação: só a própria cidade');
 assert.deepEqual(own.opportunities,{created:1,won:1,lost:1});
 assert.equal(own.decisions.length,1);
 const other=clientOrg('Outra');member(other,'admin@o.invalid');
 const none=await m.monthlyReport(await m.getTeamAccess('admin@o.invalid','Admin',other),'2026-10');
 assert.deepEqual([none.mapping.length,none.decisions.length,none.opportunities.created],[0,0,0],'nada de outra empresa');
});
