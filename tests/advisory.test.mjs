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

// Acesso da Assessoria Elite decidido pela empresa: liberado, com prazo ou desligado.
const OWNER='teamfrascaroli@gmail.com';
const ADVISOR='assessor@elite.invalid';
/** Carrega os módulos e cria a organização principal (id 1) antes das empresas clientes. */
const load=async()=>{const m={...await vite.ssrLoadModule('/db/access.ts'),...await vite.ssrLoadModule('/db/advisory.ts'),...await vite.ssrLoadModule('/db/organizations.ts')};await m.getUserAccess(OWNER,'Dono',1);return m;};
const member=(org,email,role='Administrador')=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,?,?,?,1,'teste','2026-01-01')").run(org,email,'Pessoa '+email,role);
const clientOrg=(name)=>Number(sqlite.prepare("INSERT INTO organizations(name,owner_email,active,created_at) VALUES(?,'dono@cliente.invalid',1,'2026-01-01')").run(name).lastInsertRowid);
const advisor=()=>{member(1,ADVISOR,'Coordenação');sqlite.prepare("INSERT INTO platform_advisors(email,name,active,granted_by,granted_at) VALUES(?,'Assessor',1,?,'2026-01-01')").run(ADVISOR,OWNER);};
const day=(offset)=>{const d=new Date(Date.now()+offset*86400000);return d.toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});};
const accesses=(org)=>sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE organization_id=? AND action='advisory_access'").get(org).n;

test('padrão liberado: a assessoria entra e a entrada fica no Histórico uma vez por dia', async()=>{
 const m=await load();advisor();const org=clientOrg('Cliente A');
 const a=await m.getTeamAccess(ADVISOR,'Assessor',org);
 assert.ok(a?.isAdvisory,'assessoria entra');
 await m.getTeamAccess(ADVISOR,'Assessor',org);
 assert.equal(accesses(org),1,'uma linha por dia, não uma por página');
 assert.ok((await m.listOrganizations(ADVISOR)).some(o=>o.id===org),'empresa aparece na lista da assessoria');
});

test('desligado: a assessoria não entra e a empresa some da lista dela', async()=>{
 const m=await load();advisor();const org=clientOrg('Cliente B');member(org,'admin@cliente.invalid');
 const admin=await m.getTeamAccess('admin@cliente.invalid','Admin',org);
 await m.setAdvisoryPolicy(admin,{mode:'desligado'});
 assert.equal(await m.getTeamAccess(ADVISOR,'Assessor',org),null);
 assert.equal(accesses(org),0,'sem entrada, sem registro');
 assert.ok(!(await m.listOrganizations(ADVISOR)).some(o=>o.id===org));
 const p=await m.getAdvisoryPolicy(admin);
 assert.equal(p.mode,'desligado');assert.equal(p.allowed,false);assert.equal(p.changedBy,'admin@cliente.invalid');
 assert.ok(p.events.some(e=>e.action==='advisory_policy'),'a mudança fica no Histórico');
 await m.setAdvisoryPolicy(admin,{mode:'liberado'});
 assert.ok(await m.getTeamAccess(ADVISOR,'Assessor',org),'liberado de novo, entra de novo');
});

test('prazo: vale até a data (inclusive); vencido, bloqueia; data no passado é recusada', async()=>{
 const m=await load();advisor();const org=clientOrg('Cliente C');member(org,'admin@cliente.invalid');
 const admin=await m.getTeamAccess('admin@cliente.invalid','Admin',org);
 await m.setAdvisoryPolicy(admin,{mode:'prazo',until:day(0)});
 assert.ok(await m.getTeamAccess(ADVISOR,'Assessor',org),'hoje ainda vale');
 assert.match((await m.getAdvisoryPolicy(admin)).label,/^Liberado até \d{2}\/\d{2}\/\d{4}$/);
 await assert.rejects(m.setAdvisoryPolicy(admin,{mode:'prazo',until:day(-2)}),/hoje em diante/);
 await assert.rejects(m.setAdvisoryPolicy(admin,{mode:'prazo'}),/até quando/);
 sqlite.prepare("UPDATE organizations SET advisory_until=? WHERE id=?").run(day(-1),org);
 assert.equal(await m.getTeamAccess(ADVISOR,'Assessor',org),null,'prazo vencido bloqueia');
 assert.match((await m.getAdvisoryPolicy(admin)).label,/^Prazo encerrado em /);
});

test('só o administrador da própria empresa decide; a assessoria vê a regra, mas não muda', async()=>{
 const m=await load();advisor();const org=clientOrg('Cliente D');member(org,'admin@cliente.invalid');member(org,'vendas@cliente.invalid','Comercial');
 const seller=await m.getTeamAccess('vendas@cliente.invalid','Vendas',org);
 await assert.rejects(m.setAdvisoryPolicy(seller,{mode:'desligado'}),{status:403});
 await assert.rejects(m.getAdvisoryPolicy(seller),{status:403});
 const adv=await m.getTeamAccess(ADVISOR,'Assessor',org);
 await assert.rejects(m.setAdvisoryPolicy(adv,{mode:'liberado'}),{status:403},'assessoria não muda a regra');
 assert.equal((await m.getAdvisoryPolicy(adv)).mode,'liberado','mas vê a regra');
 const owner=await m.getTeamAccess(OWNER,'Dono',1);
 await assert.rejects(m.setAdvisoryPolicy(owner,{mode:'desligado'}),{status:404},'a organização principal não tem assessoria');
 await assert.rejects(m.setAdvisoryPolicy(await m.getTeamAccess('admin@cliente.invalid','Admin',org),{mode:'qualquer'}));
});
