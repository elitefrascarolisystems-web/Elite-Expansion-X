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

const OWNER='teamfrascaroli@gmail.com';
const load=async()=>({...await vite.ssrLoadModule('/db/access.ts'),...await vite.ssrLoadModule('/db/auth.ts'),...await vite.ssrLoadModule('/lib/password.ts')});
const member=(org,email,role='Administrador')=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,?,?,?,1,'teste','2026-01-01')").run(org,email,'Pessoa '+email,role);
const clientOrg=(name)=>Number(sqlite.prepare("INSERT INTO organizations(name,owner_email,active,created_at) VALUES(?,'dono@cliente.invalid',1,'2026-01-01')").run(name).lastInsertRowid);
const STRONG='Elite2026segura';

test('senha: PBKDF2 confere só a senha certa e as regras recusam senhas fracas',async()=>{
 const m=await load();
 const h=await m.hashPassword(STRONG);
 assert.equal(h.iterations,100000);assert.match(h.hash,/^[a-f0-9]{64}$/);assert.notEqual(h.hash,STRONG);
 assert.equal(await m.verifyPassword(STRONG,h),true);
 assert.equal(await m.verifyPassword('Elite2026Segura',h),false);
 assert.notEqual((await m.hashPassword(STRONG)).hash,h.hash,'cada senha tem sal próprio');
 assert.ok(m.passwordProblem('curta1','a@b.invalid'));
 assert.ok(m.passwordProblem('somenteletrasaqui','a@b.invalid'));
 assert.ok(m.passwordProblem('maria.souza2026','maria.souza@x.invalid'),'não pode conter o e-mail');
 assert.equal(m.passwordProblem(STRONG,'pessoa@x.invalid'),null);
});

test('link de acesso: cria a senha uma vez só, abre sessão e encerra as sessões antigas',async()=>{
 const m=await load();const admin=await m.getUserAccess(OWNER,'Dono',1);
 member(1,'nova@elite.invalid','Comercial');
 const token=await m.createPasswordLink(admin,'Nova@Elite.invalid');
 assert.match(token,/^[a-f0-9]{64}$/);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM password_links WHERE token_hash=?').get(token).n,0,'o banco guarda só o hash');
 assert.deepEqual({...await m.passwordLinkInfo(token)},{email:'nova@elite.invalid',hasPassword:false});
 await assert.rejects(m.redeemPasswordLink(token,'fraca'),/pelo menos 10/);
 const session=await m.redeemPasswordLink(token,STRONG);
 assert.equal(await m.sessionEmail(session),'nova@elite.invalid');
 await assert.rejects(m.redeemPasswordLink(token,STRONG),/inválido, expirou ou já foi usado/,'uso único');
 assert.equal(await m.passwordLinkInfo(token),null);
 // Troca de senha: link novo derruba a sessão anterior e a senha antiga.
 const reset=await m.createPasswordLink(admin,'nova@elite.invalid');
 assert.equal((await m.passwordLinkInfo(reset)).hasPassword,true);
 await m.redeemPasswordLink(reset,'OutraSenha2027');
 assert.equal(await m.sessionEmail(session),null);
 await assert.rejects(m.login('nova@elite.invalid',STRONG,'1.1.1.1'),/incorretos/);
 assert.ok(await m.sessionEmail(await m.login('NOVA@elite.invalid','OutraSenha2027','1.1.1.1')));
 // Gerar outro link cancela o anterior ainda não usado; link vencido não vale.
 const a=await m.createPasswordLink(admin,'nova@elite.invalid'),b=await m.createPasswordLink(admin,'nova@elite.invalid');
 assert.equal(await m.passwordLinkInfo(a),null);assert.ok(await m.passwordLinkInfo(b));
 sqlite.prepare("UPDATE password_links SET expires_at='2000-01-01T00:00:00.000Z'").run();
 assert.equal(await m.passwordLinkInfo(b),null);
 assert.ok(sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='password_link'").get().n>=4);
});

test('login: mensagem igual para e-mail desconhecido e senha errada; bloqueia após 5 erros',async()=>{
 const m=await load();const admin=await m.getUserAccess(OWNER,'Dono',1);
 member(1,'alvo@elite.invalid','Comercial');
 await m.redeemPasswordLink(await m.createPasswordLink(admin,'alvo@elite.invalid'),STRONG);
 await assert.rejects(m.login('ninguem@elite.invalid',STRONG,'2.2.2.2'),{message:'E-mail ou senha incorretos.',status:401});
 for(let i=0;i<5;i++)await assert.rejects(m.login('alvo@elite.invalid','Errada12345','3.3.3.'+i),{status:401});
 await assert.rejects(m.login('alvo@elite.invalid',STRONG,'4.4.4.4'),{status:429},'bloqueado mesmo com a senha certa');
 sqlite.prepare("UPDATE login_throttle SET locked_until='2000-01-01T00:00:00.000Z'").run();
 assert.ok(await m.login('alvo@elite.invalid',STRONG,'4.4.4.4'));
 // Muitas tentativas da mesma rede contra e-mails diferentes também bloqueiam.
 for(let i=0;i<20;i++)await assert.rejects(m.login(`x${i}@elite.invalid`,'Errada12345','9.9.9.9'));
 await assert.rejects(m.login('alvo@elite.invalid',STRONG,'9.9.9.9'),{status:429});
 // Sessão vencida não vale; sair encerra a sessão.
 const s=await m.login('alvo@elite.invalid',STRONG,'5.5.5.5');
 sqlite.prepare("UPDATE user_sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
 assert.equal(await m.sessionEmail(s),null);
 const s2=await m.login('alvo@elite.invalid',STRONG,'5.5.5.5');await m.closeSession(s2);assert.equal(await m.sessionEmail(s2),null);
 assert.equal(await m.sessionEmail('nao-e-token'),null);
});

test('quem pode gerar link: administrador comum só para quem é apenas da organização dele',async()=>{
 const m=await load();await m.getUserAccess(OWNER,'Dono',1);
 const org=clientOrg('Cliente A'),other=clientOrg('Cliente B');
 member(org,'admin@cliente.invalid');member(org,'vendedor@cliente.invalid','Comercial');
 member(org,'duas@cliente.invalid','Comercial');member(other,'duas@cliente.invalid','Comercial');
 member(other,'fora@cliente.invalid','Comercial');
 const admin=await m.getUserAccess('admin@cliente.invalid','Admin',org);
 assert.ok(await m.createPasswordLink(admin,'vendedor@cliente.invalid'));
 await assert.rejects(m.createPasswordLink(admin,'fora@cliente.invalid'),/não tem perfil ativo/);
 await assert.rejects(m.createPasswordLink(admin,'duas@cliente.invalid'),/outra organização/);
 const seller=await m.getUserAccess('vendedor@cliente.invalid','Vendedor',org);
 await assert.rejects(m.createPasswordLink(seller,'admin@cliente.invalid'),/Somente administradores/);
 // Equipe Elite (donos e assessores) só pelos donos da plataforma.
 const eliteAdmin=(member(1,'admin.elite@elite.invalid'),await m.getUserAccess('admin.elite@elite.invalid','Admin Elite',1));
 await assert.rejects(m.createPasswordLink(eliteAdmin,OWNER),/donos da plataforma/);
 sqlite.prepare("INSERT INTO platform_advisors(email,name,active,granted_by,granted_at) VALUES('assessor@elite.invalid','Assessor',1,?,'2026-01-01')").run(OWNER);member(1,'assessor@elite.invalid','Coordenação');
 await assert.rejects(m.createPasswordLink(eliteAdmin,'assessor@elite.invalid'),/donos da plataforma/);
 // O dono da plataforma, em assessoria no cliente, gera para quem está em duas organizações.
 const owner=await m.getUserAccess(OWNER,'Dono',org);assert.equal(owner.isAdvisory,true);
 assert.ok(await m.createPasswordLink(owner,'duas@cliente.invalid'));
});

test('rotas: login exige mesma origem, grava cookie seguro; sair apaga o cookie',async()=>{
 const m=await load();const admin=await m.getUserAccess(OWNER,'Dono',1);
 member(1,'rota@elite.invalid','Comercial');
 await m.redeemPasswordLink(await m.createPasswordLink(admin,'rota@elite.invalid'),STRONG);
 const loginApi=await vite.ssrLoadModule('/app/api/auth/login/route.ts'),logoutApi=await vite.ssrLoadModule('/app/api/auth/logout/route.ts');
 const post=(origin,body)=>new Request('https://elite.invalid/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'7.7.7.7'},body:JSON.stringify(body)});
 assert.equal((await loginApi.POST(post('https://evil.invalid',{email:'rota@elite.invalid',password:STRONG}))).status,403);
 assert.equal((await loginApi.POST(post('https://elite.invalid',{email:'rota@elite.invalid',password:'Errada12345'}))).status,401);
 const ok=await loginApi.POST(post('https://elite.invalid',{email:'rota@elite.invalid',password:STRONG}));
 assert.equal(ok.status,200);
 const cookie=ok.headers.get('set-cookie');
 assert.match(cookie,/^__Host-elite_sessao=[a-f0-9]{64}; Path=\/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax$/);
 const token=cookie.split(';')[0].split('=')[1];
 assert.equal(await m.sessionEmail(token),'rota@elite.invalid');
 const out=await logoutApi.GET(new Request('https://elite.invalid/api/auth/logout',{headers:{cookie:`outro=1; __Host-elite_sessao=${token}`}}));
 assert.equal(out.status,303);assert.equal(out.headers.get('location'),'https://elite.invalid/entrar');
 assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal(await m.sessionEmail(token),null);
 // Gerar link pela API: só administrador, na organização da aba.
 const linkApi=await vite.ssrLoadModule('/app/api/auth/link/route.ts');
 const linkReq=(email)=>new Request('https://elite.invalid/api/auth/link',{method:'POST',headers:{origin:'https://elite.invalid','content-type':'application/json','X-Elite-Organization':'1'},body:JSON.stringify({email})});
 const r=await linkApi.POST(linkReq('rota@elite.invalid'));assert.equal(r.status,200);
 const {link}=await r.json();assert.match(link,/^https:\/\/elite\.invalid\/definir-senha#[a-f0-9]{64}$/);
 globalThis.__eliteTestUser=null;assert.equal((await linkApi.POST(linkReq('rota@elite.invalid'))).status,401);
});
