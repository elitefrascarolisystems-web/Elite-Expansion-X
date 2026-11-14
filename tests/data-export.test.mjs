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

// Cópia completa dos dados da empresa: tudo da empresa, nada de outra, nenhum segredo de acesso.
import {unzipSync,strFromU8} from 'fflate';
const OWNER='teamfrascaroli@gmail.com';
const load=async()=>{const m={...await vite.ssrLoadModule('/db/access.ts'),...await vite.ssrLoadModule('/db/data-export.ts'),...await vite.ssrLoadModule('/db/mfa.ts'),...await vite.ssrLoadModule('/lib/totp.ts')};await m.getUserAccess(OWNER,'Dono',1);return m;};
const member=(org,email,role='Administrador')=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,active,created_by,created_at) VALUES(?,?,?,?,1,'teste','2026-01-01')").run(org,email,'Pessoa '+email,role);
const clientOrg=(name)=>Number(sqlite.prepare("INSERT INTO organizations(name,owner_email,active,created_at) VALUES(?,'dono@cliente.invalid',1,'2026-01-01')").run(name).lastInsertRowid);
const city=(org,name)=>Number(sqlite.prepare("INSERT INTO cities(name,state,organization_id) VALUES(?,'SP',?)").run(name,org).lastInsertRowid);
const lead=(cityId,name)=>sqlite.prepare("INSERT INTO leads(city_id,name,channel,consent_at,consent_source,consent_purpose) VALUES(?,?,'Indicação','2026-01-01','teste','atendimento')").run(cityId,name);
const files=(zip)=>Object.fromEntries(Object.entries(unzipSync(zip)).map(([k,v])=>[k,k.endsWith('.csv')||k.endsWith('.txt')?strFromU8(v):v]));

test('toda tabela do banco tem destino decidido: entra na cópia ou fica de fora de propósito', async()=>{
 const m=await load();
 const tables=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%drizzle%'").all().map(r=>r.name).sort();
 const exported=new Set(m.EXPORT_PARTS.map(p=>p.table)),excluded=new Set(m.EXPORT_EXCLUDED);
 for(const t of tables)assert.ok(exported.has(t)!==excluded.has(t),`decida se "${t}" entra na cópia completa (db/data-export.ts)`);
 for(const p of m.EXPORT_PARTS)assert.equal((p.where.match(/\?/g)||[]).length,1,`${p.file}: um único filtro da empresa`);
 assert.equal(new Set(m.EXPORT_PARTS.map(p=>p.file)).size,m.EXPORT_PARTS.length,'nomes de arquivo únicos');
});

test('a cópia traz os dados da empresa, nunca os de outra, e nenhum segredo de acesso', async()=>{
 const m=await load();
 const a=clientOrg('Empresa Ácida'),b=clientOrg('Outra');member(a,'admin@a.invalid');member(b,'admin@b.invalid');
 lead(city(a,'Campinas'),'Contato da A');lead(city(b,'Santos'),'Contato da B');lead(city(a,'Sorocaba'),'=HYPERLINK("x")');
 const admin=await m.getTeamAccess('admin@a.invalid','Admin',a);
 // Senha, sessão, links, convite, aviso e verificação em duas etapas: nada disso pode sair na cópia.
 sqlite.prepare("INSERT INTO user_credentials(email,password_hash,password_salt,iterations,updated_at) VALUES('admin@a.invalid','HASH-SECRETO','SAL-SECRETO',1,'2026-01-01')").run();
 sqlite.prepare("INSERT INTO user_sessions(token_hash,email,created_at,expires_at) VALUES('SESSAO-SECRETA','admin@a.invalid','2026-01-01','2099-01-01')").run();
 sqlite.prepare("INSERT INTO password_links(token_hash,email,created_by,created_at,expires_at) VALUES('LINK-SECRETO','admin@a.invalid','x','2026-01-01','2099-01-01')").run();
 sqlite.prepare("INSERT INTO organization_invites(id,organization_id,email,name,role,token_hash,expires_at,created_by,created_at) VALUES('convite-1',?,'novo@a.invalid','Novo','Comercial','CONVITE-SECRETO','2099-01-01','x','2026-01-01')").run(a);
 sqlite.prepare("INSERT INTO notification_prefs(organization_id,email,daily,weekly,token,updated_by,updated_at) VALUES(?,'admin@a.invalid',1,1,'AVISO-SECRETO','x','2026-01-01')").run(a);
 const {secret}=await m.startEnrollment('admin@a.invalid');await m.confirmEnrollment('admin@a.invalid',await m.totp(secret,Date.now()));
 const {filename,bytes}=await m.exportOrganization(admin);
 assert.match(filename,/^elite-x-empresa-acida-\d{4}-\d{2}-\d{2}\.zip$/);
 const f=files(bytes);
 assert.ok(f['LEIA-ME.txt'].includes('Empresa: Empresa Ácida'));
 assert.ok(f['contatos.csv'].includes('"Contato da A"'));
 assert.ok(!Object.values(f).some(v=>typeof v==='string'&&v.includes('Contato da B')),'nada de outra empresa');
 assert.ok(f['contatos.csv'].includes(`"'=HYPERLINK(""x"")"`),'texto que vira fórmula ganha apóstrofo');
 assert.ok(f['cidades.csv'].replace(/^\uFEFF/,'').startsWith('"id";"name"'),'cabeçalho com os nomes das colunas');
 assert.deepEqual([...unzipSync(bytes)['cidades.csv'].slice(0,3)],[0xEF,0xBB,0xBF],'BOM: o Excel abre com acentos certos');
 const all=Object.values(f).filter(v=>typeof v==='string').join('\n');
 assert.ok(!all.includes(secret),'sem a chave do app autenticador');
 for(const word of ['HASH-SECRETO','SAL-SECRETO','SESSAO-SECRETA','LINK-SECRETO','CONVITE-SECRETO','AVISO-SECRETO','password_hash','recovery_hashes','token_hash'])assert.ok(!all.includes(word),`sem ${word}`);
 assert.ok(f['convites.csv'].includes('novo@a.invalid'),'o convite sai, sem o token');
 assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE organization_id=? AND action='data_export'").get(a).n,1,'fica no Histórico');
});

test('só o administrador da própria empresa baixa; equipe e assessoria não', async()=>{
 const m=await load();const org=clientOrg('Cliente');member(org,'vendas@c.invalid','Comercial');
 await assert.rejects(m.exportOrganization(await m.getTeamAccess('vendas@c.invalid','Vendas',org)),{status:403});
 member(1,'assessor@elite.invalid','Coordenação');
 sqlite.prepare("INSERT INTO platform_advisors(email,name,active,granted_by,granted_at) VALUES('assessor@elite.invalid','Assessor',1,?,'2026-01-01')").run(OWNER);
 const adv=await m.getTeamAccess('assessor@elite.invalid','Assessor',org);
 assert.ok(adv?.isAdvisory);
 await assert.rejects(m.exportOrganization(adv),{status:403});
});

test('tabela grande sai inteira (páginas de 1000 linhas)', async()=>{
 const m=await load();const org=clientOrg('Grande');member(org,'admin@g.invalid');const c=city(org,'Ribeirão');
 const insert=sqlite.prepare("INSERT INTO leads(city_id,name,channel,consent_at,consent_source,consent_purpose) VALUES(?,?,'Indicação','2026-01-01','teste','atendimento')");
 for(let i=0;i<2345;i++)insert.run(c,'Contato '+i);
 const f=files((await m.exportOrganization(await m.getTeamAccess('admin@g.invalid','Admin',org))).bytes);
 assert.equal(f['contatos.csv'].trim().split('\r\n').length,2346,'cabeçalho + 2345 linhas');
 assert.match(f['LEIA-ME.txt'],/contatos\.csv\s+2345 linhas/);
});
