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
const reqs=()=>vite.ssrLoadModule('/db/subscription-requests.ts');
const accessOf=async(email,org=1)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const form=(extra={})=>({company:'Academia Horizonte',contactName:'Carla Lima',email:'Carla@Horizonte.invalid',whatsapp:'(31) 98888-7777',city:'Belo Horizonte, MG',teamSize:'6 a 15 pessoas',message:'Queremos expandir para 5 cidades.',consent:true,website:'',...extra});

test('pedidos de assinatura: a página pública grava o pedido, ignora robôs e limita repetição',async()=>{
 const r=await reqs();
 assert.deepEqual(await r.submitRequest(form(),'203.0.113.9'),{ok:true});
 const row=sqlite.prepare('SELECT * FROM subscription_requests').get();
 assert.equal(row.email,'carla@horizonte.invalid');assert.equal(row.status,'Novo');assert.ok(row.consent_at);
 assert.ok(!JSON.stringify(row).includes('203.0.113.9'),'o IP não é guardado');
 assert.deepEqual(await r.submitRequest(form({website:'http://spam.invalid'}),'203.0.113.9'),{ok:true});
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM subscription_requests').get().n,1,'robô não grava');
 await assert.rejects(r.submitRequest(form({consent:false}),'203.0.113.9'),/autorização de contato/);
 await assert.rejects(r.submitRequest(form({whatsapp:'123'}),'203.0.113.9'),/WhatsApp/);
 for(let i=0;i<4;i++)await r.submitRequest(form({company:'Empresa '+i}),'203.0.113.9');
 await assert.rejects(r.submitRequest(form(),'203.0.113.9'),/vários pedidos/);
 await r.submitRequest(form(),'198.51.100.7');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM subscription_requests').get().n,6);
});

test('pedidos de assinatura: só os donos da plataforma veem e cuidam dos pedidos',async()=>{
 const r=await reqs();const owner=await accessOf(OWNER);
 await r.submitRequest(form(),'203.0.113.9');
 assert.equal(await r.newRequestCount(owner),1);
 const [item]=await r.listRequests(owner);assert.equal(item.company,'Academia Horizonte');
 sqlite.prepare("INSERT INTO organizations(id,name,owner_email,active,created_at) VALUES(7,'Cliente','dona@cliente.invalid',1,'2026-01-01')").run();
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(7,'dona@cliente.invalid','D','Administrador',1,'t','2026-01-01')").run();
 const client=await accessOf('dona@cliente.invalid',7);
 await assert.rejects(r.listRequests(client),/donos da plataforma/);
 await assert.rejects(r.updateRequest(client,{id:item.id,status:'Descartado'}),/donos da plataforma/);
 assert.equal(await r.newRequestCount(client),0);
 await r.updateRequest(owner,{id:item.id,status:'Virou assinante',note:'Plano fechado',organizationId:7});
 const [done]=await r.listRequests(owner);
 assert.deepEqual([done.status,done.note,done.organizationId,done.handledBy],['Virou assinante','Plano fechado',7,OWNER]);
 assert.equal(await r.newRequestCount(owner),0);
 await r.deleteRequest(owner,item.id);
 assert.deepEqual(await r.listRequests(owner),[]);
 await assert.rejects(r.deleteRequest(owner,item.id),/não encontrado/);
});
