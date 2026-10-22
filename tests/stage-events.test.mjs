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

const leadData=(personId)=>({personId,cityId:1,name:'Nome informado',email:'contato@example.invalid',whatsapp:'',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Formulário de teste',consentPurpose:'Contato comercial'});
const events=()=>sqlite.prepare('SELECT from_stage,to_stage,source,actor_email,organization_id FROM opportunity_stage_events ORDER BY rowid').all().map(r=>({...r}));

async function setup(){
 const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');
 const m={access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/mutations.ts'),...await vite.ssrLoadModule('/lib/expansion-validation.ts'),...await vite.ssrLoadModule('/db/commercial.ts')};
 const p=await m.mutateTerritory(m.access,'person',{cityId:1,name:'Pessoa etapa',authorized:true,leader:false,referrerId:null});
 await m.executeAction('create_lead',m.parseActionPayload('create_lead',leadData(p.id)),m.access);
 return m;
}
const save=(m,id,stage,version)=>m.saveCommercial(m.access,'opportunity',{id,leadId:1,ownerEmail:m.access.email,temperature:'Morno',stage,nextAction:'Retomar conversa',dueDate:'2099-10-20',...version?{version}:{}});

test('cada troca de etapa fica registrada com data; salvar sem trocar a etapa não registra', async()=>{
 const m=await setup();const id=crypto.randomUUID();
 await save(m,id,'Novo');
 await save(m,id,'Novo',1);
 await save(m,id,'Qualificado',2);
 assert.deepEqual(events().map(e=>[e.from_stage,e.to_stage,e.source]),[[null,'Novo','Etapa'],['Novo','Qualificado','Etapa']]);
 assert.ok(events().every(e=>e.actor_email==='teamfrascaroli@gmail.com'&&e.organization_id===1));
});

test('pagamento confirmado fecha o atendimento como Ganho e registra a troca', async()=>{
 const m=await setup();const id=crypto.randomUUID();
 await save(m,id,'Proposta');
 await m.executeAction('record_sale',m.parseActionPayload('record_sale',{leadId:1,product:'Formação',amountCents:150000,status:'Pagamento confirmado'}),m.access);
 assert.deepEqual(events().map(e=>[e.from_stage,e.to_stage,e.source]),[[null,'Proposta','Etapa'],['Proposta','Ganho','Pagamento confirmado']]);
});

test('salvamento recusado (versão antiga) não registra troca de etapa', async()=>{
 const m=await setup();const id=crypto.randomUUID();
 await save(m,id,'Novo');await save(m,id,'Qualificado',1);
 await assert.rejects(save(m,id,'Proposta',1),/Outra pessoa alterou/);
 assert.equal(events().length,2);
});

test('a migração aproveita o histórico em texto das atividades "Etapa"', ()=>{
 // Banco com tudo até a 0024, dados antigos, e só então a 0025 (como na publicação).
 const db=new DatabaseSync(':memory:');
 for(const f of migrations().filter(f=>f<'0025'))db.exec(readFileSync(root+'drizzle/'+f,'utf8'));
 db.exec(`INSERT INTO organizations(id,name,owner_email,created_at) SELECT 9,'Org teste','a@x.invalid','2026-01-01' WHERE NOT EXISTS(SELECT 1 FROM organizations WHERE id=9)`);
 const city=db.prepare("INSERT INTO cities(name,state,phase,status,created_by,created_at,organization_id) VALUES('Cidade','MG','Planejamento','Planejada','a@x.invalid','2026-01-01',9)").run().lastInsertRowid;
 const lead=db.prepare("INSERT INTO leads(city_id,name,email,whatsapp,normalized_email,normalized_whatsapp,status,channel,source_label,campaign,utm_source,utm_medium,utm_campaign,consent_at,consent_source,consent_purpose,assigned_to_email,updated_at,created_by,created_at) VALUES(?,'L','','','','','Lead válido','Orgânico','','','','','','2026-01-01','x','y','a@x.invalid','2026-01-01','a@x.invalid','2026-01-01')").run(city).lastInsertRowid;
 const lead2=db.prepare("INSERT INTO leads(city_id,name,email,whatsapp,normalized_email,normalized_whatsapp,status,channel,source_label,campaign,utm_source,utm_medium,utm_campaign,consent_at,consent_source,consent_purpose,assigned_to_email,updated_at,created_by,created_at) VALUES(?,'L2','','','','','Lead válido','Orgânico','','','','','','2026-01-01','x','y','a@x.invalid','2026-01-01','a@x.invalid','2026-01-01')").run(city).lastInsertRowid;
 db.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES('op1',9,?,?,'a@x.invalid','Morno','Ganho','','2026-01-01','a@x.invalid','2026-01-01T10:00:00-03:00','2026-01-01')").run(city,lead);
 db.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES('op2',9,?,?,'b@x.invalid','Morno','Novo','','2026-01-01','b@x.invalid','2026-01-05T10:00:00-03:00','2026-01-05')").run(city,lead2);
 const act=db.prepare("INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at) VALUES(?,9,?,?,'a@x.invalid',?,?,'2026-01-01',?)");
 act.run('a1',city,'op1','Etapa','Cadastro → Novo; temperatura Morno','2026-01-01T10:00:00-03:00');
 act.run('a2',city,'op1','Etapa','Novo → Novo; temperatura Quente','2026-01-02T10:00:00-03:00');
 act.run('a3',city,'op1','Etapa','Novo → Proposta; temperatura Quente','2026-01-03T10:00:00-03:00');
 act.run('a4',city,'op1','Etapa','Proposta → Ganho (pagamento confirmado)','2026-01-04T10:00:00-03:00');
 act.run('a5',city,'op1','Follow-up','Ligação → retorno','2026-01-04T11:00:00-03:00');
 act.run('a6',city,'op2','Etapa','Indicação recebida pelo portal (Marina)','2026-01-05T10:00:00-03:00');
 db.exec(readFileSync(root+'drizzle/0025_opportunity_stage_events.sql','utf8'));
 const rows=db.prepare('SELECT opportunity_id,from_stage,to_stage,created_at FROM opportunity_stage_events ORDER BY opportunity_id,created_at').all().map(r=>[r.opportunity_id,r.from_stage,r.to_stage,r.created_at]);
 assert.deepEqual(rows,[
  ['op1',null,'Novo','2026-01-01T10:00:00-03:00'],
  ['op1','Novo','Proposta','2026-01-03T10:00:00-03:00'],
  ['op1','Proposta','Ganho','2026-01-04T10:00:00-03:00'],
  ['op2',null,'Novo','2026-01-05T10:00:00-03:00'],
 ]);
 db.close();
});
