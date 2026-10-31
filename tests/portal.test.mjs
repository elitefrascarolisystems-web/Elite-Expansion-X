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
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

const ORG={'X-Elite-Organization':'1'};
const ADMIN='teamfrascaroli@gmail.com';
const access=async(email)=> (await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',1);
const addUser=(email,role,extra={})=>{const r=sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,?,?,?,?,1,'teste','2026-01-01')").run(email,extra.name??('Pessoa '+role),role,extra.cityId??null);return Number(r.lastInsertRowid);};
const portal=()=>vite.ssrLoadModule('/db/portal.ts');
const api=(route)=>vite.ssrLoadModule(`/app/api/${route}/route.ts`);
const req=(path,method='GET',body)=>new Request('https://elite.invalid'+path,{method,headers:{origin:'https://elite.invalid','content-type':'application/json',...ORG},...(body?{body:JSON.stringify(body)}:{})});
async function setup(){
 const admin=await access(ADMIN);
 const seller=addUser('vendas@elite.invalid','Comercial',{name:'Vendedora Elite'});
 const mentee=addUser('mentorado@cliente.invalid','Mentorado',{name:'Maria Mentorada',cityId:1});
 const company=addUser('outro@cliente.invalid','Mentorado',{name:'João Mentorado',cityId:1});
 return {admin,seller,mentee,company};
}

test('portal: mentorado e assinante não acessam nenhuma API da equipe',async()=>{
 await setup();
 for(const email of ['mentorado@cliente.invalid','outro@cliente.invalid']){
  globalThis.__eliteTestUser={email,displayName:'Cliente'};
  const a=await access(email);assert.ok(a,'tem login');assert.equal((await (await vite.ssrLoadModule('/db/access.ts')).getTeamAccess(email,'Cliente',1)),null);
  const calls=[['dashboard','GET'],['dashboard','POST',{action:'create_city',data:{}}],['territory','GET'],['territory','POST',{action:'person',data:{}}],['commercial','GET'],['commercial','POST',{action:'business',data:{}}],['followup','GET'],['journey','POST',{action:'start',data:{}}],['team','POST',{action:'invite',rows:[]}],['auth/link','POST',{email}],['territory/geocode','POST',{query:'Centro',cityId:1}],['map-config','GET'],['organizations','GET']];
  for(const [route,method,body] of calls){
   const mod=await api(route);const r=await mod[method](req('/api/'+route,method,body));
   assert.ok([401,403].includes(r.status),`${email} ${method} /api/${route} devolveu ${r.status}`);
   assert.ok(!JSON.stringify(await r.json().catch(()=>({}))).includes('Esmeraldas'),'nenhum dado da operação');
  }
 }
});

test('portal do mentorado: jornada, materiais certos, contato e dados só dele',async()=>{
 const {admin,mentee,company}=await setup();const p=await portal();
 for(const title of ['Diagnóstico','Plano']) await p.portalAdminAction(admin,'save_step',{audience:'Mentorados',title});
 await assert.rejects(p.portalAdminAction(admin,'save_step',{audience:'Assinantes',title:'Não existe mais'}),e=>e.name==='ZodError','empresa assinante não usa o portal');
 await p.portalAdminAction(admin,'set_member',{userId:mentee,ownerEmail:'vendas@elite.invalid',nextMeetingAt:'2026-11-05T10:00',nextMeetingNote:'Revisão do plano'});
 const insert=sqlite.prepare("INSERT INTO contents(organization_id,title,type,channel,version,status,instructions,audience,created_by) VALUES(1,?,'Mensagem','WhatsApp','1.0',?,'x',?,'teste')");
 insert.run('Para mentorados','Aprovado','Mentorados');insert.run('Para todos','Aprovado','Todos');insert.run('Só embaixadores','Aprovado','Embaixadores');insert.run('Em revisão','Em revisão','Mentorados');insert.run('Antigo de assinantes','Aprovado','Assinantes');
 const md=await p.getPortalData(await access('mentorado@cliente.invalid'));
 assert.deepEqual(md.steps.map(s=>s.title),['Diagnóstico','Plano']);
 assert.deepEqual(md.materials.map(m=>m.title).sort(),['Para mentorados','Para todos']);
 assert.equal(md.owner.name,'Vendedora Elite');assert.equal(md.nextMeeting.note,'Revisão do plano');assert.equal(md.member.organizationName,'Elite Frascaroli Academy');
 const other=await p.getPortalData(await access('outro@cliente.invalid'));assert.equal(other.owner,null,'cada um vê só o próprio contato');assert.equal(other.nextMeeting,null);
 const ma=await access('mentorado@cliente.invalid');
 await p.portalAction(ma,'step',{stepId:md.steps[0].id,done:true});
 assert.ok((await p.getPortalData(ma)).steps[0].doneAt);assert.equal((await p.getPortalData(await access('outro@cliente.invalid'))).steps[0].doneAt,null,'progresso é de cada um');
 await p.portalAction(ma,'step',{stepId:md.steps[0].id,done:false});assert.equal((await p.getPortalData(ma)).steps[0].doneAt,null);
 await assert.rejects(p.getPortalData(admin),/exclusiva/);
 await assert.rejects(p.portalAdminAction(ma,'save_step',{audience:'Mentorados',title:'Hack'}),/administradores/);
 await assert.rejects(p.getPortalAdmin(await access('vendas@elite.invalid')),/administradores/);
 const {getDashboardData}=await vite.ssrLoadModule('/db/queries.ts');
 sqlite.prepare("INSERT INTO ambassadors(city_id,name,code,status,level,created_by,created_at,updated_at) VALUES(1,'Emb','EMB9','Ativo','Indicador','t','2026-01-01','2026-01-01')").run();
 const amb={...admin,role:'Embaixador',cityId:1,ambassadorId:Number(sqlite.prepare('SELECT max(id) i FROM ambassadors').get().i)};
 assert.deepEqual((await getDashboardData(amb)).contents.map(x=>x.title).sort(),['Para todos','Só embaixadores']);
});

test('indicação pelo portal vira lead "Indicação" na agenda do responsável, sem duplicar',async()=>{
 const {admin,mentee}=await setup();const p=await portal();const m=await vite.ssrLoadModule('/db/territory.ts');
 const {id:personId}=await m.mutateTerritory(admin,'person',{cityId:1,name:'Maria Mentorada',authorized:true,leader:false,referrerId:null});
 await p.portalAdminAction(admin,'set_member',{userId:mentee,personId,ownerEmail:'vendas@elite.invalid'});
 const ma=await access('mentorado@cliente.invalid');
 await assert.rejects(p.portalAction(ma,'refer',{name:'Sem contato',cityId:1,consent:true}),/WhatsApp ou o e-mail/);
 await assert.rejects(p.portalAction(ma,'refer',{name:'Sem consentimento',whatsapp:'31911112222',cityId:1,consent:false}),e=>e.name==='ZodError');
 await p.portalAction(ma,'refer',{name:'Carlos Indicado',whatsapp:'(31) 91111-2222',cityId:1,note:'tem academia',consent:true});
 const lead=sqlite.prepare("SELECT * FROM leads WHERE name='Carlos Indicado'").get();
 assert.equal(lead.channel,'Indicação');assert.equal(lead.assigned_to_email,'vendas@elite.invalid');assert.equal(lead.created_by,'mentorado@cliente.invalid');assert.match(lead.source_label,/Indicação de Maria Mentorada \(mentorado\)/);
 assert.equal(sqlite.prepare('SELECT referrer_id r FROM territory_people WHERE id=?').get(lead.person_id).r,personId,'entra na rede de indicações');
 const opp=sqlite.prepare('SELECT * FROM opportunities WHERE lead_id=?').get(lead.id);
 assert.equal(opp.owner_email,'vendas@elite.invalid');assert.match(opp.next_action,/Contatar indicação de Maria: tem academia/);
 const {getAgenda}=await vite.ssrLoadModule('/db/agenda.ts');
 assert.equal((await getAgenda(await access('vendas@elite.invalid'))).today,1,'na agenda de hoje do responsável');
 await assert.rejects(p.portalAction(ma,'refer',{name:'Carlos de novo',whatsapp:'31 91111 2222',cityId:1,consent:true}),/já está em contato/);
 const data=await p.getPortalData(ma);assert.deepEqual(data.referrals.map(r=>[r.name,r.status]),[['Carlos Indicado','Recebida']]);
 // Sem responsável: o lead entra sem dono e sem oportunidade (a gestão distribui).
 const ca=await access('outro@cliente.invalid');await p.portalAction(ca,'refer',{name:'Ana Sem Dono',email:'ana@x.invalid',cityId:1,consent:true});
 const ana=sqlite.prepare("SELECT id,assigned_to_email FROM leads WHERE name='Ana Sem Dono'").get();assert.equal(ana.assigned_to_email,'');assert.equal(sqlite.prepare('SELECT count(*) n FROM opportunities WHERE lead_id=?').get(ana.id).n,0);
 // Rota: mesma origem e limite diário.
 globalThis.__eliteTestUser={email:'mentorado@cliente.invalid',displayName:'M'};const route=await api('portal');
 assert.equal((await route.POST(new Request('https://elite.invalid/api/portal',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json',...ORG},body:'{}'}))).status,403);
 assert.equal((await route.GET(req('/api/portal'))).status,200);
 assert.equal((await route.GET(req('/api/portal?admin=1'))).status,403);
});

test('gestão do portal: etapas em ordem, responsável só da equipe, vínculos da organização',async()=>{
 const {admin,mentee}=await setup();const p=await portal();
 for(const t of ['Etapa um','Etapa dois','Etapa três']) await p.portalAdminAction(admin,'save_step',{audience:'Mentorados',title:t});
 let steps=(await p.getPortalAdmin(admin)).steps;
 await p.portalAdminAction(admin,'move_step',{id:steps[2].id,direction:'up'});
 assert.deepEqual((await p.getPortalAdmin(admin)).steps.map(s=>s.title),['Etapa um','Etapa três','Etapa dois']);
 await p.portalAdminAction(admin,'save_step',{id:steps[0].id,audience:'Mentorados',title:'Etapa um editada'});
 await p.portalAdminAction(admin,'delete_step',{id:steps[1].id});
 assert.deepEqual((await p.getPortalAdmin(admin)).steps.map(s=>s.title),['Etapa um editada','Etapa três']);
 await assert.rejects(p.portalAdminAction(admin,'set_member',{userId:mentee,ownerEmail:'outro@cliente.invalid'}),/equipe da empresa/);
 await assert.rejects(p.portalAdminAction(admin,'set_member',{userId:mentee,personId:crypto.randomUUID()}),/não encontrada/);
 const sellerAccess=await access('vendas@elite.invalid');await assert.rejects(p.portalAdminAction(sellerAccess,'set_member',{userId:mentee}),/administradores/);
 const members=(await p.getPortalAdmin(admin)).members;assert.deepEqual(members.map(m=>m.role),['Mentorado','Mentorado']);assert.equal(members.find(m=>m.role==='Mentorado').total,2);
});

test('guias "Como usar": o "já vi" grava só a própria linha, sem repetir, e "Mostrar os guias de novo" zera',async()=>{
 await setup();const team=await api('team');
 const post=(body,org='1')=>team.POST(new Request('https://elite.invalid/api/team',{method:'POST',headers:{origin:'https://elite.invalid','content-type':'application/json','X-Elite-Organization':org},body:JSON.stringify(body)}));
 const seen=(email,org=1)=>sqlite.prepare('SELECT guides_seen g FROM app_users WHERE lower(email)=? AND organization_id=?').get(email,org)?.g;
 for(const key of ['vendas/agenda','vendas/agenda','hoje/'])assert.equal((await post({action:'guide_seen',key})).status,200);
 assert.equal(seen(ADMIN),'vendas/agenda,hoje/','a mesma chave entra uma vez só');
 assert.equal(seen('vendas@elite.invalid'),'','a linha de outra pessoa não muda');
 for(const key of ['x/y',"hoje/' OR 1=1 --",'',null,42]){const r=await post({action:'guide_seen',key});assert.equal(r.status,400);assert.equal((await r.json()).error,'Guia desconhecido.');}
 assert.equal(seen(ADMIN),'vendas/agenda,hoje/');
 assert.deepEqual((await access(ADMIN)).guidesSeen,['vendas/agenda','hoje/'],'volta junto com o acesso');
 assert.equal((await post({action:'guides_reset'})).status,200);assert.equal(seen(ADMIN),'');
 // Isolamento entre empresas: a mesma pessoa em duas empresas tem um "já vi" em cada.
 const {createOrganization}=await vite.ssrLoadModule('/db/organizations.ts');
 const org=await createOrganization(await access(ADMIN),{name:'Cliente com guia',ownerEmail:'dona@cliente.invalid',ownerName:'Dona',requestId:crypto.randomUUID()});
 addUser('dona@cliente.invalid','Comercial',{name:'Dona também na Elite'});
 globalThis.__eliteTestUser={email:'dona@cliente.invalid',displayName:'Dona'};
 assert.equal((await post({action:'guide_seen',key:'gestao/time'},String(org))).status,200);
 assert.equal(seen('dona@cliente.invalid',org),'gestao/time');assert.equal(seen('dona@cliente.invalid',1),'','na outra empresa nada muda');
 // Assessoria Elite: responde ok e não grava nada na empresa cliente (o "já vi" fica no aparelho).
 globalThis.__eliteTestUser={email:ADMIN,displayName:'Dono'};
 const before=sqlite.prepare('SELECT organization_id o,email,guides_seen g FROM app_users ORDER BY id').all();
 assert.equal((await post({action:'guide_seen',key:'gestao/time'},String(org))).status,200);
 assert.equal((await post({action:'guides_reset'},String(org))).status,200);
 assert.deepEqual(sqlite.prepare('SELECT organization_id o,email,guides_seen g FROM app_users ORDER BY id').all(),before);
 assert.equal((await vite.ssrLoadModule('/db/access.ts').then(m=>m.getUserAccess(ADMIN,'Dono',org))).guidesSeen,undefined,'a assessoria não recebe lista do servidor');
});

test('guia do portal: o mentorado grava o "já vi" dele pelo portal e só a chave do portal existe',async()=>{
 await setup();const p=await portal();const ma=await access('mentorado@cliente.invalid');
 await p.portalAction(ma,'guide_seen',{key:'portal:mentorado'});await p.portalAction(ma,'guide_seen',{key:'portal:mentorado'});
 assert.deepEqual((await p.getPortalData(ma)).member.guidesSeen,['portal:mentorado']);
 assert.deepEqual((await p.getPortalData(await access('outro@cliente.invalid'))).member.guidesSeen,[],'cada mentorado tem o seu');
 await assert.rejects(p.portalAction(ma,'guide_seen',{key:'gestao/../time'}),/Guia desconhecido/);
 await p.portalAction(ma,'guides_reset',{});assert.deepEqual((await p.getPortalData(ma)).member.guidesSeen,[]);
 globalThis.__eliteTestUser={email:'mentorado@cliente.invalid',displayName:'M'};const route=await api('portal');
 const r=await route.POST(req('/api/portal','POST',{action:'guide_seen',data:{key:'portal:mentorado'}}));assert.equal(r.status,200);
 assert.equal(sqlite.prepare("SELECT guides_seen g FROM app_users WHERE email='mentorado@cliente.invalid'").get().g,'portal:mentorado');
 assert.equal((await route.POST(req('/api/portal','POST',{action:'guide_seen',data:{key:'nada'}}))).status,400);
});

test('convite: o e-mail do exemplo (@exemplo.com) nunca vira acesso',async()=>{
 await setup();const team=await api('team');
 const r=await team.POST(req('/api/team','POST',{action:'invite',rows:[{name:'Ana Exemplo',email:'Ana@Exemplo.com',role:'Comercial',cityId:null},{name:'Pessoa Real',email:'real@cliente.invalid',role:'Comercial',cityId:null}]}));
 assert.equal(r.status,200);const body=await r.json();
 assert.deepEqual(body.results.map(x=>[x.email,x.ok,x.error??'']),[['ana@exemplo.com',false,'Troque o e-mail de exemplo pelo e-mail real da pessoa.'],['real@cliente.invalid',true,'']]);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM app_users WHERE email LIKE '%@exemplo.com'").get().n,0);
});
