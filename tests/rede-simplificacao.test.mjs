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
const migrations=()=>readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort();
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of migrations())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

// Simplificação, parte 3 (Rede): parceiro vira local, papéis antigos, embaixador simples e números autodeclarados.
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/mutations.ts'),...await vite.ssrLoadModule('/lib/expansion-validation.ts'),...await vite.ssrLoadModule('/db/commercial.ts')};}
const run=(m,action,input,access=m.access)=>m.executeAction(action,m.parseActionPayload(action,input),access);
const partner={cityId:1,name:'Padaria Parceira Teste',type:'Parceiro local',contactName:'',whatsapp:'',nextAction:'Combinar evento aberto'};

test('cadastrar parceiro cria um local marcado como parceiro (com o setor para revisar)', async()=>{
 const m=await modules();
 await run(m,'create_partner',{...partner,placeType:'Empresa',sector:'Alimentação'});
 const b=sqlite.prepare("SELECT b.*,p.status AS pstatus FROM businesses b JOIN partners p ON p.id=b.partner_id WHERE b.name=?").get(partner.name);
 assert.ok(b,'local criado e ligado ao parceiro');assert.equal(b.status,'Parceira');assert.equal(b.sector,'Alimentação');assert.equal(b.pstatus,'Ativo');
 await assert.rejects(run(m,'create_partner',partner),/já está marcado como parceiro/,'mesmo nome na mesma cidade reaproveita o local');
});

test('cadastrar parceiro com nome de local existente reaproveita o local', async()=>{
 const m=await modules();const id=crypto.randomUUID();
 await m.saveCommercial(m.access,'business',{id,cityId:1,name:'Academia Teste',segment:'Academia',source:'Cadastro manual',ownerEmail:m.access.email,status:'Identificada',placeType:'Empresa',sector:'Esporte e lazer',publicBusiness:true});
 await run(m,'create_partner',{...partner,name:'Academia Teste'});
 assert.equal(sqlite.prepare('SELECT count(*) n FROM businesses WHERE name=?').get('Academia Teste').n,1);
 assert.ok(sqlite.prepare('SELECT partner_id FROM businesses WHERE id=?').get(id).partner_id);
});

test('marcar um local como parceiro pela tela de Locais; o Comercial não marca', async()=>{
 const m=await modules();const id=crypto.randomUUID();
 await m.saveCommercial(m.access,'business',{id,cityId:1,name:'Escritório Teste',segment:'Escritório',source:'Cadastro manual',ownerEmail:m.access.email,status:'Identificada',placeType:'Escritório',sector:'',publicBusiness:true});
 await assert.rejects(m.saveCommercial({...m.access,role:'Comercial'},'link_partner',{id}),/Somente a gestão/);
 await m.saveCommercial(m.access,'link_partner',{id,nextAction:'Apresentar a empresa'});
 const b=sqlite.prepare('SELECT b.status,p.name,p.next_action FROM businesses b JOIN partners p ON p.id=b.partner_id WHERE b.id=?').get(id);
 assert.deepEqual({...b},{status:'Parceira',name:'Escritório Teste',next_action:'Apresentar a empresa'});
 await assert.rejects(m.saveCommercial(m.access,'link_partner',{id}),/já está marcado/);
 // Editar o local depois não exige a situação antiga de novo (a situação gravada segue igual).
 const v=sqlite.prepare('SELECT version FROM businesses WHERE id=?').get(id).version;
 await m.saveCommercial(m.access,'business',{id,version:v,cityId:1,name:'Escritório Teste',segment:'Escritório',source:'Cadastro manual',ownerEmail:m.access.email,status:'Parceira',placeType:'Escritório',sector:'',publicBusiness:true,nextAction:'Novo passo'});
 assert.equal(sqlite.prepare('SELECT status FROM businesses WHERE id=?').get(id).status,'Parceira');
});

test('migração: parceiro antigo vira local (ou se liga ao local de mesmo nome), com o ponto do mapa', ()=>{
 const db=new DatabaseSync(':memory:');const files=migrations();
 for(const f of files.filter(f=>f<'0033'))db.exec(readFileSync(root+'drizzle/'+f,'utf8'));
 db.exec("INSERT INTO organizations(id,name,owner_email,created_at) SELECT 9,'Org teste','dono@x.invalid','2026-01-01' WHERE NOT EXISTS(SELECT 1 FROM organizations WHERE id=9)");
 const city=db.prepare("INSERT INTO cities(name,state,phase,status,created_by,created_at,organization_id) VALUES('Cidade','MG','Ativa','Ativa','a@x.invalid','2026-01-01',9)").run().lastInsertRowid;
 const p1=db.prepare("INSERT INTO partners(city_id,name,type,created_by,created_at) VALUES(?,'Parceiro Sozinho','Parceiro local','a@x.invalid','2026-01-02')").run(city).lastInsertRowid;
 const p2=db.prepare("INSERT INTO partners(city_id,name,type,created_by,created_at) VALUES(?,'Loja Existente','Parceiro local','','2026-01-02')").run(city).lastInsertRowid;
 db.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,created_by,created_at,updated_at) VALUES('11111111-1111-4111-8111-111111111111',9,?,' loja existente ','Loja','Manual','loja|',' a@x.invalid','Identificada','a@x.invalid','2026-01-01','2026-01-01')").run(city);
 db.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,precision,source,authorized_by,authorized_at,updated_at) VALUES(?,?,-19.9,-43.9,'Exata','Mapa','a@x.invalid','2026-01-01','2026-01-01')").run('partner:'+p1,city);
 for(const f of files.filter(f=>f>='0033'))db.exec(readFileSync(root+'drizzle/'+f,'utf8'));
 const rows=db.prepare('SELECT id,name,partner_id,status,owner_email,source FROM businesses ORDER BY name').all().map(r=>({...r}));
 assert.equal(rows.length,2,'um local novo e um reaproveitado');
 const novo=rows.find(r=>Number(r.partner_id)===Number(p1)),velho=rows.find(r=>Number(r.partner_id)===Number(p2));
 assert.match(novo.id,/^00000000-0000-4000-8000-\d{12}$/);assert.equal(novo.status,'Parceira');assert.equal(novo.owner_email,'a@x.invalid');
 assert.equal(velho.id,'11111111-1111-4111-8111-111111111111');assert.equal(velho.status,'Parceira');
 assert.equal(db.prepare('SELECT count(*) n FROM territory_locations WHERE entity_key=?').get('business:'+novo.id).n,1,'ponto copiado');
 assert.equal(db.prepare('SELECT count(*) n FROM partners').get().n,2,'nada apagado');
 db.close();
});

test('papéis: Equipe, Vendedor, Network e Parceiro não se criam mais; os antigos ainda se editam', async()=>{
 const m=await modules();const p=await m.mutateTerritory(m.access,'person',{cityId:1,name:'Pessoa papel',authorized:true,leader:false,referrerId:null});
 const role=(r,status='Ativo')=>m.mutateTerritory(m.access,'role',{personId:p.id,role:r,status,responsible:'',source:'Conversa direta',authorized:true});
 await assert.rejects(role('Vendedor'),/não é mais usado/);
 await role('Mentor');await role('Mentor','Encerrado');
 assert.equal(sqlite.prepare("SELECT status FROM territory_roles WHERE person_id=? AND role='Mentor'").get(p.id).status,'Encerrado');
 sqlite.prepare("INSERT INTO territory_roles(id,person_id,city_id,role,status,source,authorized_by,created_at,updated_at) VALUES(?,?,1,'Network','Ativo','antigo','a@x.invalid','2026-01-01','2026-01-01')").run(crypto.randomUUID(),p.id);
 await role('Network','Encerrado');
 assert.equal(sqlite.prepare("SELECT status FROM territory_roles WHERE person_id=? AND role='Network'").get(p.id).status,'Encerrado');
 const places=await vite.ssrLoadModule('/lib/places.ts');
 assert.deepEqual(['Convidado','Ativo','Pausado','Inativo','Desligado','Encerrado'].map(places.roleStatusStep),['Ativo','Ativo','Pausado','Encerrado','Encerrado','Encerrado']);
 assert.equal(places.roleStatusFromStep('Ativo','Aprovado'),'Aprovado');assert.equal(places.roleStatusFromStep('Encerrado','Aprovado'),'Encerrado');
});

test('embaixador: código gerado sozinho, 4 situações na tela e números autodeclarados fora', async()=>{
 const m=await modules();
 await run(m,'create_ambassador',{cityId:1,name:'Embaixadora Teste',code:'',status:'Em treinamento',level:'Indicador'});
 const a=sqlite.prepare("SELECT id,code FROM ambassadors WHERE name='Embaixadora Teste'").get();
 assert.match(a.code,/^EMB-[A-HJ-NP-Z2-9]{6}$/);
 await assert.rejects(run(m,'record_ambassador',{ambassadorId:a.id,period:'2026-11',leads:1,sales:0,actions:0,contents:0,events:0,costCents:0}),/não é mais usado/);
 const s=await vite.ssrLoadModule('/lib/ambassador-steps.ts');
 assert.deepEqual(['Convidado','Em análise','Aprovado','Em treinamento','Ativo','Pausado','Inativo','Desligado'].map(s.ambassadorStep),['Em preparação','Em preparação','Em preparação','Em preparação','Ativo','Pausado','Desligado','Desligado']);
 assert.equal(s.ambassadorStatusFromStep('Em preparação','Convidado'),'Convidado');assert.equal(s.ambassadorStatusFromStep('Em preparação','Pausado'),'Em treinamento');
});

test('regras em frases (parte 4): mínimos definidos viram uma frase; sem mínimos, pede para editar', async()=>{
 const r=await vite.ssrLoadModule('/lib/rules-sentences.ts');
 const base={minActiveAmbassadors:5,minConfirmedPayments:3,minActivePartners:0,minDataPeriods:2,inactivityDays:30,organicGoalPercent:60};
 assert.deepEqual(r.rulesSentences(base),['Uma cidade avança quando tem 5 embaixadores ativos e 3 pagamentos confirmados, com pelo menos 2 meses de dados.','A meta é que 60% dos atendimentos venham sem mídia paga.','Um embaixador fica inativo depois de 30 dias sem atividade.']);
 assert.match(r.rulesSentences({...base,minActiveAmbassadors:0,minConfirmedPayments:0})[0],/Ainda falta definir/);
 assert.match(r.rulesSentences({...base,minActivePartners:1,minConfirmedPayments:1})[0],/5 embaixadores ativos, 1 pagamento confirmado e 1 parceiro ativo, com pelo menos 2 meses/);
});

test('Em campo: situação dos locais por id, só os que a função vê (o Comercial, os dele)', async()=>{
 const m=await modules();const pp=await vite.ssrLoadModule('/db/person-places.ts');
 const mine=crypto.randomUUID(),other=crypto.randomUUID();
 const seller={...m.access,role:'Comercial',cityId:1,email:'vendedor@example.invalid'};
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_at) VALUES(1,'vendedor@example.invalid','Vendedor teste','Comercial',1,1,'2026-01-01')").run();
 for(const [id,owner] of [[mine,'vendedor@example.invalid'],[other,m.access.email]])await m.saveCommercial(m.access,'business',{id,cityId:1,name:'Local '+id.slice(0,6),segment:'Loja',source:'Cadastro manual',ownerEmail:owner,status:'Identificada',placeType:'Empresa',sector:'Comércio e varejo',publicBusiness:true});
 const all=await pp.nearbySituations(m.access,[mine,other,'nao-e-id']);
 assert.deepEqual(all.map(x=>x.businessId).sort(),[mine,other].sort());assert.ok(all.every(x=>x.situation));
 const own=await pp.nearbySituations(seller,[mine,other]);
 assert.deepEqual(own.map(x=>x.businessId),[mine],'o Comercial vê só os locais dele');
 assert.deepEqual(await pp.nearbySituations(m.access,[]),[]);
});
