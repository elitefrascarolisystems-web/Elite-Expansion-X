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

// Verificação em duas etapas: cadastro, entrada com código, recuperação, gestão e regra da empresa.
const OWNER='teamfrascaroli@gmail.com';
const STRONG='Elite2026segura';
const load=async()=>({...await vite.ssrLoadModule('/db/access.ts'),...await vite.ssrLoadModule('/db/auth.ts'),...await vite.ssrLoadModule('/db/mfa.ts'),...await vite.ssrLoadModule('/lib/totp.ts')});
const member=(org,email,role='Administrador')=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,?,?,?,1,'teste','2026-01-01')").run(org,email,'Pessoa '+email,role);
const clientOrg=(name)=>Number(sqlite.prepare("INSERT INTO organizations(name,owner_email,active,created_at) VALUES(?,'dono@cliente.invalid',1,'2026-01-01')").run(name).lastInsertRowid);
const secretOf=(email)=>sqlite.prepare('SELECT secret FROM user_mfa WHERE email=?').get(email).secret;
/** Pessoa com senha (pelo link) e verificação ativa; devolve os códigos de recuperação. */
async function enrolled(m,org,email,role='Comercial'){
 member(org,email,role);const admin=await m.getUserAccess(OWNER,'Dono',1);
 if(org!==1)member(org,OWNER,'Administrador');
 const owner=await m.getUserAccess(OWNER,'Dono',org);
 await m.redeemPasswordLink(await m.createPasswordLink(owner??admin,email),STRONG);
 const {secret}=await m.startEnrollment(email);
 return m.confirmEnrollment(email,await m.totp(secret,Date.now()));
}

test('cadastro: só liga com um código certo; códigos de recuperação guardados só como hash', async()=>{
 const m=await load();member(1,'pessoa@elite.invalid','Comercial');
 const {secret,otpauth}=await m.startEnrollment('pessoa@elite.invalid');
 assert.match(otpauth,/^otpauth:\/\/totp\//);assert.equal(secret.length,32);
 assert.equal((await m.mfaStatus('pessoa@elite.invalid')).enabled,false,'ainda desligada');
 await assert.rejects(m.confirmEnrollment('pessoa@elite.invalid','000000'),{status:401});
 const codes=await m.confirmEnrollment('pessoa@elite.invalid',await m.totp(secret,Date.now()));
 assert.equal(codes.length,10);
 const stored=sqlite.prepare('SELECT recovery_hashes FROM user_mfa WHERE email=?').get('pessoa@elite.invalid').recovery_hashes;
 assert.ok(!codes.some(c=>stored.includes(c)),'nenhum código em texto');
 assert.deepEqual({...await m.mfaStatus('pessoa@elite.invalid')},{enabled:true,enabledAt:(await m.mfaStatus('pessoa@elite.invalid')).enabledAt,recoveryLeft:10});
 await assert.rejects(m.startEnrollment('pessoa@elite.invalid'),{status:409});
 assert.ok(sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='mfa_enabled'").get().n>=1);
});

test('entrada: senha certa pede o código; código certo abre a sessão; o mesmo código não vale de novo', async()=>{
 const m=await load();await enrolled(m,1,'campo@elite.invalid');
 const first=await m.login('campo@elite.invalid',STRONG,'1.1.1.1');
 assert.ok(first.challenge&&!first.session,'sem sessão antes do código');
 assert.equal(sqlite.prepare('SELECT count(*) n FROM mfa_challenges WHERE token_hash=?').get(first.challenge).n,0,'o banco guarda só o hash do desafio');
 await assert.rejects(m.loginWithCode(first.challenge,'000000','1.1.1.1'),{status:401});
 const code=await m.totp(secretOf('campo@elite.invalid'),Date.now()+30_000);
 const session=await m.loginWithCode(first.challenge,code,'1.1.1.1');
 assert.equal(await m.sessionEmail(session),'campo@elite.invalid');
 await assert.rejects(m.loginWithCode(first.challenge,code,'1.1.1.1'),/acabou|senha de novo/,'desafio usado não vale');
 const again=await m.login('campo@elite.invalid',STRONG,'1.1.1.1');
 await assert.rejects(m.loginWithCode(again.challenge,code,'1.1.1.1'),{status:401},'o mesmo código não vale duas vezes');
});

test('código de recuperação vale uma vez; 5 tentativas erradas pedem a senha de novo', async()=>{
 const m=await load();const codes=await enrolled(m,1,'rec@elite.invalid');
 const a=await m.login('rec@elite.invalid',STRONG,'2.2.2.2');
 assert.ok(await m.sessionEmail(await m.loginWithCode(a.challenge,codes[0].toLowerCase(),'2.2.2.2')),'aceita em minúsculas');
 const b=await m.login('rec@elite.invalid',STRONG,'2.2.2.2');
 await assert.rejects(m.loginWithCode(b.challenge,codes[0],'2.2.2.2'),{status:401},'já usado');
 assert.equal((await m.mfaStatus('rec@elite.invalid')).recoveryLeft,9);
 const c=await m.login('rec@elite.invalid',STRONG,'3.3.3.3');
 for(let i=0;i<4;i++)await assert.rejects(m.loginWithCode(c.challenge,'111111','3.3.3.'+i),{status:401});
 // 5º erro: a conta fica bloqueada pelo limite de tentativas (o mesmo da senha).
 await assert.rejects(m.loginWithCode(c.challenge,'111111','3.3.3.9'),{status:401});
 await assert.rejects(m.login('rec@elite.invalid',STRONG,'4.4.4.4'),{status:429},'bloqueada por 15 minutos');
});

test('link de acesso não pula o código; o administrador redefine e a pessoa entra só com a senha', async()=>{
 const m=await load();const org=clientOrg('Empresa Teste');await enrolled(m,org,'equipe@cliente.invalid');
 const owner=await m.getUserAccess(OWNER,'Dono',org);
 const r=await m.redeemPasswordLink(await m.createPasswordLink(owner,'equipe@cliente.invalid'),'OutraSenha2027x');
 assert.ok(r.challenge&&!r.session,'senha nova gravada, mas falta o código');
 member(org,'comercial@cliente.invalid','Comercial');
 const seller=await m.getUserAccess('comercial@cliente.invalid','C',org);
 await assert.rejects(m.adminResetMfa(seller,'equipe@cliente.invalid'),{status:403});
 await m.adminResetMfa(owner,'equipe@cliente.invalid');
 assert.equal(await m.hasMfa('equipe@cliente.invalid'),false);
 assert.ok((await m.login('equipe@cliente.invalid','OutraSenha2027x','5.5.5.5')).session);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='mfa_reset' AND organization_id=?").get(org).n,1);
});

test('regra da empresa: sem a verificação, a equipe só vê a tela de ativar; o portal fica de fora', async()=>{
 const m=await load();const org=clientOrg('Empresa Exigente');member(org,OWNER,'Administrador');member(org,'vende@cliente.invalid','Comercial');member(org,'aluno@cliente.invalid','Mentorado');
 const owner=await m.getUserAccess(OWNER,'Dono',org);
 await assert.rejects(m.setMfaRequired(owner,true,false),{status:409},'quem liga precisa ter a própria ativa');
 await m.setMfaRequired(owner,true,true);
 const seller=await m.getUserAccess('vende@cliente.invalid','V',org);
 assert.equal(seller.mfaSetupRequired,true);
 assert.equal(await m.getTeamAccess('vende@cliente.invalid','V',org),null,'nenhuma ferramenta da equipe responde');
 assert.ok(!(await m.getUserAccess('aluno@cliente.invalid','A',org)).mfaSetupRequired,'o portal do mentorado fica de fora');
 const {secret}=await m.startEnrollment('vende@cliente.invalid');
 await m.confirmEnrollment('vende@cliente.invalid',await m.totp(secret,Date.now()));
 assert.ok(await m.getTeamAccess('vende@cliente.invalid','V',org),'depois de ativar, entra normal');
 await assert.rejects(m.disableMfa('vende@cliente.invalid','000000'),{status:401},'desligar exige código');
 const assessor={...owner,isAdvisory:true};
 await assert.rejects(m.setMfaRequired(assessor,false,true),{status:403},'a assessoria não muda a regra');
});
