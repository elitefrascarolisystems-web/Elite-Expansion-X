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

const hooks=()=>vite.ssrLoadModule('/db/hooks.ts');
const lib=()=>vite.ssrLoadModule('/lib/hooks.ts');
const accessOf=async(email,org=1)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const addUser=(email,role,org=1)=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(?,?,?,?,1,1,'t','2026-01-01')").run(org,email,'Pessoa',role);

test('ganchos: a gestão cadastra e aprova; o Comercial só vê e usa os aprovados',async()=>{
 const h=await hooks();const admin=await accessOf(OWNER);addUser('vendas@elite.invalid','Comercial');const seller=await accessOf('vendas@elite.invalid');
 const draft=await h.saveHook(admin,{title:'Abertura por indicação',situation:'Indicação',body:'Oi {primeiro_nome}, quem me passou seu contato foi…'});
 await h.saveHook(admin,{title:'Retomada',situation:'Retomada',body:'Oi {nome}, passando para retomar nossa conversa.',status:'Aprovado'});
 assert.equal((await h.listHooks(admin)).hooks.length,2,'gestão vê rascunhos');
 const seen=await h.listHooks(seller);assert.deepEqual(seen.hooks.map(x=>x.title),['Retomada'],'Comercial vê só aprovados');assert.equal(seen.canEdit,false);
 await assert.rejects(h.saveHook(seller,{title:'Meu gancho',situation:'Retomada',body:'Texto qualquer com tamanho'}),/Somente a gestão/);
 await assert.rejects(h.saveHook(admin,{title:'Curto',situation:'Retomada',body:'curto'}),/pelo menos 10/);
 await h.saveHook(admin,{id:draft.id,title:'Abertura por indicação',situation:'Indicação',body:'Oi {primeiro_nome}, quem me passou seu contato foi…',status:'Aprovado'});
 assert.equal((await h.listHooks(seller)).hooks.length,2,'aprovado aparece para a equipe');
});

test('ganchos: cada empresa tem o próprio banco',async()=>{
 const h=await hooks();const admin=await accessOf(OWNER);
 sqlite.prepare("INSERT INTO organizations(id,name,owner_email,active,created_at) VALUES(7,'Outra','dona@outra.invalid',1,'2026-01-01')").run();
 addUser('dona@outra.invalid','Administrador',7);const other=await accessOf('dona@outra.invalid',7);
 const mine=await h.saveHook(admin,{title:'Da Elite',situation:'Evento',body:'Texto do evento da Elite.',status:'Aprovado'});
 assert.equal((await h.listHooks(other)).hooks.length,0,'não vê os ganchos da Elite');
 await assert.rejects(h.saveHook(other,{id:mine.id,title:'Hack',situation:'Evento',body:'Tentando alterar o da Elite.'}),/fora do seu acesso/);
});

test('ganchos: importação em lote e preenchimento das variáveis',async()=>{
 const h=await hooks(),l=await lib();const admin=await accessOf(OWNER);
 const lines=l.parseHookLines('Abertura | Primeiro contato | Oi {primeiro_nome}, sou {responsavel} da {empresa}.\nSem situação | Qualquer | Texto\n\nObjeção preço | objeção | Entendo, {nome}. | Ligação');
 assert.deepEqual(lines.map(x=>x.error?'erro':x.input.situation),['Primeiro contato','erro','Objeção']);
 const bad=await h.importHooks(admin,{rows:[{title:'Gancho ok',situation:'Retomada',body:'Texto ok com tamanho'},{title:'X',situation:'Retomada',body:'curto'}]});
 assert.equal(bad.saved,0);assert.equal(bad.errors[0].line,2,'nada é salvo se uma linha falhar');
 const ok=await h.importHooks(admin,{rows:lines.filter(x=>x.input).map(x=>x.input)});
 assert.equal(ok.saved,2);assert.ok((await h.listHooks(admin)).hooks.every(x=>x.status==='Rascunho'),'importados entram como rascunho');
 assert.equal(l.fillHook('Oi {primeiro_nome}, sou {responsavel} da {empresa} em {cidade}.',{name:'Maria Souza',owner:'Flávia',organization:'Elite',city:''}),'Oi Maria, sou Flávia da Elite em ….');
});
