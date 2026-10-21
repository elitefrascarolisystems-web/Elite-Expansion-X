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

const api=(route)=>vite.ssrLoadModule(`/app/api/${route}/route.ts`);
const accessMod=()=>vite.ssrLoadModule('/db/access.ts');
const as=(email)=>{globalThis.__eliteTestUser={email,displayName:'Teste'};};
const req=(path,method='GET',body,org=1)=>new Request('https://elite.invalid'+path,{method,headers:{origin:'https://elite.invalid','content-type':'application/json','X-Elite-Organization':String(org)},...(body?{body:JSON.stringify(body)}:{})});
async function call(route,method,body,org=1){const r=await (await api(route))[method](req('/api/'+route,method,body,org));return {status:r.status,body:await r.json().catch(()=>({}))};}
const city=(name,status='Ativa')=>({name,state:'MG',phase:'Piloto',leaderName:'',targetCacCents:0,ambassadorGoal:1,salesGoal:1,status,budgetCents:0,trackingMode:'Detalhado'});
const user=(email,role)=>({email,name:'Pessoa '+role,role,cityId:null,ambassadorId:null});

/** Cria a empresa pelo painel de assinaturas e devolve o id. */
async function subscriber(plan={}){
 as(OWNER);await (await accessMod()).getUserAccess(OWNER,'Dono',1);
 const r=await call('subscriptions','POST',{action:'create',data:{requestId:crypto.randomUUID(),name:'Academia Horizonte',ownerName:'Dona Cliente',ownerEmail:CLIENT,plan:'Expansão Pro',priceCents:49700,paidUntil:'2026-11-10',userLimit:2,cityLimit:1,imports:false,exports:false,externalMaps:false,...plan}});
 assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result.organizationId;
}

test('assinaturas: só os donos da plataforma veem e alteram',async()=>{
 const org=await subscriber();
 const list=await call('subscriptions','GET');assert.equal(list.status,200);
 const row=list.body.subscribers.find(s=>s.id===org);
 assert.equal(row.plan,'Expansão Pro');assert.equal(row.priceCents,49700);assert.equal(row.userLimit,2);assert.equal(row.users,1,'a responsável ocupa a primeira vaga');
 assert.ok(!list.body.subscribers.some(s=>s.id===1),'a Elite não aparece como assinante');
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(1,'admin2@elite.invalid','Admin','Administrador',1,'t','2026-01-01')").run();
 for(const [email,o] of [['admin2@elite.invalid',1],[CLIENT,org]]){
  as(email);
  assert.equal((await call('subscriptions','GET',undefined,o)).status,403,`${email} não vê assinaturas`);
  assert.equal((await call('subscriptions','POST',{action:'status',data:{organizationId:org,active:false,reason:'tentativa indevida'}},o)).status,403);
  assert.equal((await call('subscriptions','POST',{action:'save',data:{organizationId:org,userLimit:999}},o)).status,403);
 }
 as(OWNER);
 assert.equal((await call('subscriptions','POST',{action:'status',data:{organizationId:1,active:false,reason:'não pode'}})).status,400,'a Elite nunca é suspensa');
 assert.equal((await call('subscriptions','POST',{action:'save',data:{organizationId:1,plan:'x'}})).status,400);
});

test('assinaturas: limites de usuários e cidades valem no servidor (mentorado não ocupa vaga)',async()=>{
 const org=await subscriber();as(CLIENT);
 const run=(action,data)=>call('dashboard','POST',{action,data},org);
 assert.equal((await run('create_user',user('vendas@cliente.invalid','Comercial'))).status,200,'segunda vaga');
 const full=await run('create_user',user('mais@cliente.invalid','Comercial'));
 assert.equal(full.status,400);assert.match(full.body.error,/permite 2 usuários/);
 assert.equal((await run('create_user',user('mentorada@cliente.invalid','Mentorado'))).status,200,'mentorado não conta');
 assert.equal((await run('create_user',user('vendas@cliente.invalid','Comercial'))).status,200,'atualizar quem já tem vaga não conta duas vezes');
 assert.equal((await run('create_user',user('mentorada@cliente.invalid','Comercial'))).status,400,'mentorado virando equipe ocupa vaga');
 // Gatilho do banco como segunda barreira (inclusive contra corrida entre duas telas).
 assert.throws(()=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,'direto@cliente.invalid','X','Comercial',1,'t','2026-01-01')").run(org),/tenant_user_limit/);
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,'mentorado2@cliente.invalid','X','Mentorado',1,'t','2026-01-01')").run(org);

 assert.equal((await run('create_city',city('Primeira'))).status,200);
 const second=await run('create_city',city('Segunda'));assert.equal(second.status,400);assert.match(second.body.error,/1 cidade ativa/);
 assert.equal((await run('create_city',city('Planejada','Planejada'))).status,200,'cidade planejada não conta');
 const planned=Number(sqlite.prepare("SELECT id FROM cities WHERE name='Planejada'").get().id),first=Number(sqlite.prepare("SELECT id FROM cities WHERE name='Primeira'").get().id);
 const {name:_a,state:_b,...edit}=city('','Ativa');
 assert.equal((await run('update_city',{...edit,cityId:planned})).status,400,'ativar outra cidade passa do limite');
 assert.equal((await run('update_city',{...edit,cityId:first,notes:'ok'})).status,200,'editar a cidade já ativa continua liberado');

 const plan=(await call('dashboard','GET',undefined,org)).body.data.plan;
 assert.deepEqual({users:plan.users,userLimit:plan.userLimit,cities:plan.cities,cityLimit:plan.cityLimit,imports:plan.imports},{users:2,userLimit:2,cities:1,cityLimit:1,imports:false});

 as(OWNER);await call('subscriptions','POST',{action:'save',data:{organizationId:org,userLimit:3,cityLimit:null}});
 as(CLIENT);assert.equal((await run('create_user',user('mais@cliente.invalid','Comercial'))).status,200,'ampliar o plano libera na hora');
 assert.equal((await run('create_city',city('Segunda'))).status,200,'sem limite de cidades');
});

test('assinaturas: importação, exportação e mapas externos seguem o plano',async()=>{
 const org=await subscriber();as(CLIENT);
 const imp=await call('territory','POST',{action:'import_people',data:{rows:[{}]}},org);
 assert.equal(imp.status,403);assert.match(imp.body.error,/Importar planilhas não está incluído/);
 const biz=await call('commercial','POST',{action:'import_preview',data:{rows:[{}]}},org);assert.equal(biz.status,403);
 const r=await (await api('commercial')).GET(new Request('https://elite.invalid/api/commercial?format=csv&mode=businesses',{headers:{'X-Elite-Organization':String(org)}}));
 assert.equal(r.status,403);assert.match((await r.json()).error,/Exportar relatórios/);
 assert.equal((await call('map-config','GET',undefined,org)).body.externalEnabled,false);
 // A Elite, sem plano registrado, continua com tudo liberado.
 as(OWNER);const elite=(await (await vite.ssrLoadModule('/db/plan.ts')).getPlan(1));
 assert.deepEqual([elite.imports,elite.exports,elite.externalMaps,elite.userLimit],[true,true,true,null]);
 const ok=await call('territory','POST',{action:'import_people',data:{rows:[{}]}});assert.notEqual(ok.status,403);
});

test('assinaturas: suspender corta o acesso com aviso claro e reativar devolve tudo',async()=>{
 const org=await subscriber();const access=await accessMod();
 assert.ok(await access.getUserAccess(CLIENT,'Dona',org));
 assert.equal((await call('subscriptions','POST',{action:'status',data:{organizationId:org,active:false,reason:'ok'}})).status,400,'motivo obrigatório');
 const s=await call('subscriptions','POST',{action:'status',data:{organizationId:org,active:false,reason:'Pagamento de outubro em aberto'}});
 assert.equal(s.status,200);assert.equal(s.body.data.subscribers.find(x=>x.id===org).active,false);
 assert.equal(await access.getUserAccess(CLIENT,'Dona',org),null,'equipe sem acesso');
 assert.equal(await access.getUserAccess(OWNER,'Dono',org),null,'nem a assessoria entra');
 assert.equal(await access.suspendedOrganizationOf(CLIENT),'Academia Horizonte');
 as(CLIENT);assert.equal((await call('dashboard','GET',undefined,org)).status,403);
 as(OWNER);await call('subscriptions','POST',{action:'status',data:{organizationId:org,active:true,reason:'Pagamento confirmado'}});
 assert.ok(await access.getUserAccess(CLIENT,'Dona',org));assert.equal(await access.suspendedOrganizationOf(CLIENT),null);
 const audit=(await call('subscriptions','GET')).body.audit.filter(a=>a.organizationId===org).map(a=>a.action);
 assert.deepEqual(audit,['reactivate','suspend','subscription','create']);
});

test('identidade: só o administrador da empresa troca nome e logo, com formato conferido',async()=>{
 const org=await subscriber();const {saveIdentity}=await vite.ssrLoadModule('/db/identity.ts');const access=await accessMod();
 const admin=await access.getUserAccess(CLIENT,'Dona',org);
 const png='data:image/png;base64,'+Buffer.from('\x89PNG\r\n\x1a\n'+'x'.repeat(40),'latin1').toString('base64');
 await assert.rejects(saveIdentity(admin,{name:'Academia Horizonte',logo:png,official:false}),/logo oficial/);
 await assert.rejects(saveIdentity(admin,{name:'Academia Horizonte',logo:'data:image/svg+xml;base64,PHN2Zz4=',official:true}),/PNG, JPEG ou WebP/);
 await assert.rejects(saveIdentity(admin,{name:'Academia Horizonte',logo:'data:image/png;base64,'+Buffer.from('nao e png').toString('base64'),official:true}),/não corresponde/);
 const saved=await saveIdentity(admin,{name:'Academia Horizonte Pro',logo:png,official:true});
 assert.ok(saved.logoVersion);assert.equal(sqlite.prepare('SELECT name FROM organizations WHERE id=?').get(org).name,'Academia Horizonte Pro');
 // A logo só sai para quem tem acesso à empresa.
 const route=await api('organization-logo');
 as(CLIENT);const ok=await route.GET(new Request(`https://elite.invalid/api/organization-logo?org=${org}`));assert.equal(ok.status,200);assert.equal(ok.headers.get('content-type'),'image/png');
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(1,'outro@elite.invalid','Outro','Comercial',1,'t','2026-01-01')").run();
 as('outro@elite.invalid');assert.equal((await route.GET(new Request(`https://elite.invalid/api/organization-logo?org=${org}`))).status,403);
 // Só o administrador; a Elite usa sempre o emblema.
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,'vend@cliente.invalid','Vend','Comercial',1,'t','2026-01-01')").run(org);
 await assert.rejects(saveIdentity(await access.getUserAccess('vend@cliente.invalid','V',org),{name:'X Hack'}),/Somente o administrador/);
 await assert.rejects(saveIdentity(await access.getUserAccess(OWNER,'Dono',1),{name:'Elite'}),/emblema oficial/);
 // Retirar a logo
 await saveIdentity(admin,{name:'Academia Horizonte Pro',logo:null});
 as(CLIENT);assert.equal((await route.GET(new Request(`https://elite.invalid/api/organization-logo?org=${org}`))).status,404);
});
