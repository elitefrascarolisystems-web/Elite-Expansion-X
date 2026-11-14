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

// Tema claro e cor da empresa: contraste conferido, script do tema igual à regra, cor salva só pela empresa.
import vm from 'node:vm';
const OWNER='teamfrascaroli@gmail.com';
const load=async()=>{const m={...await vite.ssrLoadModule('/db/access.ts'),...await vite.ssrLoadModule('/db/identity.ts'),...await vite.ssrLoadModule('/lib/accent.ts'),...await vite.ssrLoadModule('/lib/app-theme.ts')};await m.getUserAccess(OWNER,'Dono',1);return m;};
const member=(org,email,role='Administrador')=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,?,?,?,1,'teste','2026-01-01')").run(org,email,'Pessoa '+email,role);
const clientOrg=(name)=>Number(sqlite.prepare("INSERT INTO organizations(name,owner_email,active,created_at) VALUES(?,'dono@cliente.invalid',1,'2026-01-01')").run(name).lastInsertRowid);
// Fundos da plataforma: escuro (fundo, painel, painel elevado, painel alto) e claro (papel, branco, painel alto).
const DARK=['#050504','#0d0c0a','#14130f','#1c1a14'],LIGHT=['#f4f3ee','#ffffff','#f1efe8'];

test('toda cor da empresa passa no contraste AA (4,5:1) nos dois temas', async()=>{
 const m=await load();
 for(const key of m.ACCENT_KEYS){
  const {dark,light}=m.ACCENTS[key];
  for(const tone of ['gold','hover','soft','light','pale'])for(const bg of DARK)assert.ok(m.contrast(dark[tone],bg)>=4.5,`${key}: ${tone} no fundo escuro ${bg}`);
  for(const tone of ['gold','hover','deep'])assert.ok(m.contrast(dark[tone],'#000000')>=4.5,`${key}: botão escuro (${tone}) com texto preto`);
  for(const tone of ['gold','hover','soft','light','pale','deep'])for(const bg of LIGHT)assert.ok(m.contrast(light[tone],bg)>=4.5,`${key}: ${tone} no fundo claro ${bg}`);
  for(const tone of ['gold','hover','light','deep'])assert.ok(m.contrast(light[tone],'#ffffff')>=4.5,`${key}: botão claro (${tone}) com texto branco`);
 }
 assert.equal(m.accentCss('dourado'),'','dourado é o padrão do CSS');
 assert.equal(m.accentCss('qualquer'),'');
 const css=m.accentCss('azul');
 assert.ok(css.startsWith(':root{--elite-gold:#60a5fa;')&&css.includes('html[data-theme="light"]{--elite-gold:#1d4ed8;'),'as duas versões da cor');
 assert.match(css,/--elite-gold-rgb:96 165 250;/);
});

test('o script do <head> escolhe o tema como a regra (e só nas telas de trabalho)', async()=>{
 const m=await load();
 for(const path of ['/','/guia','/entrar','/imprimir/relatorio'])for(const stored of [null,'escuro','claro','aparelho','x'])for(const prefersLight of [false,true]){
  const dataset={};
  const ctx={location:{pathname:path},localStorage:{getItem:()=>stored},matchMedia:()=>({matches:prefersLight}),document:{documentElement:{dataset}}};
  vm.runInNewContext(m.THEME_SCRIPT,ctx);
  const expected=m.THEMED_PATHS.includes(path)&&m.resolveTheme(stored,prefersLight)==='light'?'light':undefined;
  assert.equal(dataset.theme,expected,`${path} ${stored} ${prefersLight}`);
 }
 assert.equal(m.resolveTheme(null,true),'dark','sem escolha: escuro, como sempre foi');
});

test('cor da empresa: o administrador escolhe da lista; vale no painel; a Elite fica no dourado', async()=>{
 const m=await load();const org=clientOrg('Cores');member(org,'admin@c.invalid');member(org,'vendas@c.invalid','Comercial');
 const admin=await m.getTeamAccess('admin@c.invalid','Admin',org);
 assert.equal(await m.organizationAccent(org),'dourado');
 const saved=await m.saveIdentity(admin,{name:'Cores',accent:'verde'});
 assert.equal(saved.accent,'verde');
 assert.equal(sqlite.prepare('SELECT accent FROM organizations WHERE id=?').get(org).accent,'verde');
 assert.match(sqlite.prepare("SELECT summary FROM audit_logs WHERE organization_id=? AND action='organization_identity' ORDER BY id DESC").get(org).summary,/Cor da empresa: verde/);
 await m.saveIdentity(admin,{name:'Cores Novo'});
 assert.equal(await m.organizationAccent(org),'verde','sem cor no pedido, mantém a atual');
 await assert.rejects(m.saveIdentity(admin,{name:'Cores',accent:'#ff0000'}),/cores da lista/);
 await m.saveIdentity(admin,{name:'Cores',accent:'dourado'});
 assert.equal(sqlite.prepare('SELECT accent FROM organizations WHERE id=?').get(org).accent,'','dourado volta ao padrão');
 await assert.rejects(m.saveIdentity(await m.getTeamAccess('vendas@c.invalid','Vendas',org),{name:'Cores',accent:'azul'}),{status:403});
 await assert.rejects(m.saveIdentity(await m.getTeamAccess(OWNER,'Dono',1),{name:'Elite',accent:'azul'}),{status:400});
 assert.equal(await m.organizationAccent(1),'dourado');
});
