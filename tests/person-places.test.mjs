import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,logLevel:'silent',resolve:{alias:[{find:'cloudflare:workers',replacement:root+'tests/fixtures/cloudflare.mjs'},{find:'@/app/auth',replacement:root+'tests/fixtures/auth.mjs'},{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
let sqlite;
function adapter(db){return {prepare(sql){let args=[];const stmt={bind(...values){if(values.length>100)throw new Error('D1_ERROR: too many SQL variables (limite de 100 do D1)');args=values.map(v=>typeof v==='boolean'?Number(v):v);return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};}};return stmt;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
const migrations=readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort();
const OWNER='teamfrascaroli@gmail.com';
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of migrations)sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:OWNER,displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});

const page=()=>vite.ssrLoadModule('/db/person-page.ts');
const accessFor=async(email=OWNER,org)=>(await vite.ssrLoadModule('/db/access.ts')).getUserAccess(email,'Teste',org);
const member=(email,role,city,org=1)=>sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(?,?,?,?,?,1,'t','2026-01-01')").run(org,email,'Equipe '+role,role,city);
const city=(name,org=1)=>Number(sqlite.prepare("INSERT INTO cities(organization_id,name,state,tracking_mode) VALUES(?,?,'MG','Detalhado')").run(org,name).lastInsertRowid);
const uuid=()=>crypto.randomUUID();
function person({cityId=1,name='Maria Teste',by=OWNER,referrer=null,place=null,link='',region=null,source='Mapeamento',created='2026-10-01T10:00:00-03:00'}={}){const id=uuid();sqlite.prepare("INSERT INTO territory_people(id,city_id,name,leader,referrer_id,place_id,place_link,region_id,source,created_by,created_at,updated_at) VALUES(?,?,?,0,?,?,?,?,?,?,?,?)").run(id,cityId,name,referrer,place,link,region,source,by,created,created);return id;}
function lead(personId,{cityId=1,assigned='',revoked=null,label='',day='2026-10-05'}={}){const at=`${day}T10:00:00-03:00`;return Number(sqlite.prepare("INSERT INTO leads(city_id,name,status,channel,source_label,assigned_to_email,whatsapp,email,consent_at,consent_source,consent_purpose,consent_revoked_at,person_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(cityId,'Maria Teste','Lead válido','WhatsApp',label,assigned,'31999990000','maria@cliente.invalid',at,'Conversa presencial','mentoria',revoked,personId,at).lastInsertRowid);}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- auxiliar compartilhado com tests/person-page.test.mjs
function opportunity(leadId,owner,{due='2026-11-01',stage='Proposta',cityId=1}={}){const id=uuid();sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,1,?,?,?,'Quente',?,'Ligar',?,'t','2026-10-05','2026-10-05')").run(id,cityId,leadId,owner,stage,due);return id;}
function sale(leadId,{cents=150000,paid='2026-10-20T11:00:00-03:00',cityId=1}={}){sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at,created_at,updated_at) VALUES(?,?,'Mentoria',?,'Pagamento confirmado',?,'2026-10-19','2026-10-20')").run(leadId,cityId,cents,paid);}
function place({cityId=1,name='Padaria Pão Dourado',sector='Alimentação',type='Empresa'}={}){const id=uuid();sqlite.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,place_type,sector,created_by,created_at,updated_at) VALUES(?,1,?,?,'x','teste',?,?, 'Selecionada',?,?,?,'2026-10-01','2026-10-01')").run(id,cityId,name,id,OWNER,type,sector,OWNER);sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,?,-19.76,-44.31,'','Local comercial','teste',1,'Equipe','t','2026-10-01','2026-10-01')").run('business:'+id,cityId);return id;}
const places=()=>vite.ssrLoadModule('/db/person-places.ts');
const T=()=>new Date(Date.now()-3*3600_000).toISOString().slice(0,10);
const daysAgo=(n)=>new Date(Date.now()-3*3600_000-n*86400_000).toISOString().slice(0,10);
const link=(personId,businessId,linkName='Colaborador',extra={})=>({personId,businessId,link:linkName,authorized:true,...extra});
const actions=()=>sqlite.prepare("SELECT name,category,status,person_id,business_id,responsible,due_date FROM territory_actions ORDER BY created_at,id").all();

test('ligar lugares: as recusas do servidor, com a mensagem exata',async()=>{
 const admin=await accessFor();const {savePersonPlace}=await places();const c2=city('Outra Cidade');
 const maria=person({name:'Maria Cliente'});lead(maria);
 const bakery=place();const gym=place({name:'Academia Corpo Ativo',sector:'Esporte e lazer'});const far=place({cityId:c2,name:'Longe'});
 const church=place({name:'Igreja Exemplo',sector:'Religioso',type:'Network / comunidade'});const clinic=place({name:'Clínica Exemplo',sector:'Saúde'});
 const assoc=place({name:'Associação Comercial',sector:'Associação / entidade',type:'Network / comunidade'});const school=place({name:'Escola Exemplo',sector:'Educação',type:'Instituição de ensino'});
 const noSector=place({name:'Ponto sem setor',sector:'',type:'Ponto de encontro'});
 const msg=(re)=>(e)=>re.test(e.message);
 await assert.rejects(savePersonPlace(admin,link(maria,far)),msg(/mesma cidade/));
 await assert.rejects(savePersonPlace(admin,link(maria,church,'Frequenta')),msg(/Igreja revela religião/));
 await assert.rejects(savePersonPlace(admin,link(maria,church,'Sócio / dono')),msg(/Igreja revela religião/),'nem como dona');
 for(const l of ['Frequenta','Membro do network','Mentorado'])await assert.rejects(savePersonPlace(admin,link(maria,clinic,l)),msg(/Ser paciente revela dado de saúde/));
 await assert.rejects(savePersonPlace(admin,link(maria,assoc,'Membro do network')),msg(/não é sindicato, partido nem entidade religiosa/));
 await assert.rejects(savePersonPlace(admin,link(maria,school,'Frequenta')),msg(/própria pessoa estuda ou trabalha aqui/));
 await assert.rejects(savePersonPlace(admin,link(maria,noSector)),msg(/Escolha o setor deste local antes de ligar pessoas a ele/));
 await assert.rejects(savePersonPlace(admin,{...link(maria,gym),authorized:false}),msg(/contou que tem esse vínculo/));
 await savePersonPlace(admin,link(maria,assoc,'Membro do network',{confirmAssociation:true}));
 await savePersonPlace(admin,link(maria,school,'Frequenta',{confirmSchool:true}));
 await savePersonPlace(admin,link(maria,clinic,'Colaborador'));
 await savePersonPlace(admin,link(maria,gym,'Frequenta'));
 // Sem autorização vigente nem papel: nada além do principal.
 const semConsent=person({name:'Sem Autorização'});
 await assert.rejects(savePersonPlace(admin,link(semConsent,gym,'Frequenta')),msg(/autorização de contato vigente/));
 // 6º lugar (principal + 4 extras = 5).
 sqlite.prepare("UPDATE territory_people SET place_id=?,place_link='Sócio / dono' WHERE id=?").run(bakery,maria);
 const sixth=place({name:'Sexto Lugar',sector:'Tecnologia'});
 await assert.rejects(savePersonPlace(admin,link(maria,sixth)),msg(/até 5 lugares/));
 // Local principal pelo mapeamento: as mesmas regras; vínculo antigo sem mudança fica como está.
 const t=await vite.ssrLoadModule('/db/territory.ts');
 await assert.rejects(t.mutateTerritory(admin,'person',{requestId:uuid(),cityId:1,name:'Fiel Novo',placeId:church,placeLink:'Frequenta',authorized:true,confirmDuplicate:true}),msg(/Igreja revela religião/));
 await assert.rejects(t.mutateTerritory(admin,'person',{requestId:uuid(),cityId:1,name:'Paciente Nova',placeId:clinic,placeLink:'Frequenta',authorized:true,confirmDuplicate:true}),msg(/Ser paciente/));
 // Importação: sem caixa de confirmação, as linhas sensíveis são recusadas com o motivo.
 const out=await t.mutateTerritory(admin,'import_people',{confirmed:true,rows:[{cityId:1,name:'Aluna Importada',place:'Escola Exemplo',link:'Frequenta'},{cityId:1,name:'Membro Importado',place:'Associação Comercial',link:'Membro do network'},{cityId:1,name:'Fiel Importado',place:'Igreja Exemplo',link:'Frequenta'}]});
 assert.deepEqual(out.rows.map(r=>r.status),['Ligue esta pessoa pelo mapa, com a confirmação.','Ligue esta pessoa pelo mapa, com a confirmação.','Igreja revela religião (dado sensível). Mapeie o lugar, mas não ligue pessoas a ele.']);
});

test('o ponto da pessoa não muda ao ligar lugares; Tornar principal troca sem duplicar; contagem e situação por pessoas distintas',async()=>{
 const admin=await accessFor();const {savePersonPlace,makePrimaryPlace,placeSummaries,placeDetail}=await places();const t=await vite.ssrLoadModule('/db/territory.ts');
 const bakery=place();const gym=place({name:'Academia Corpo Ativo',sector:'Esporte e lazer'});
 const maria=person({place:bakery,link:'Sócio / dono'});sale(lead(maria));
 const before=(await t.getTerritory(admin,new URLSearchParams({key:'person:'+maria}))).records[0].location;
 await savePersonPlace(admin,link(maria,gym,'Frequenta'));
 const after=(await t.getTerritory(admin,new URLSearchParams({key:'person:'+maria}))).records[0].location;
 assert.deepEqual(after,before,'o ponto continua o do local principal');
 const spots=(await t.getTerritoryPlaces(admin,new URLSearchParams())).spots;
 assert.equal(spots.find(s=>s.key==='business:'+gym).people,0,'contagem do ponto: só o local principal');
 assert.equal(spots.find(s=>s.key==='business:'+bakery).people,1);
 const sum=await placeSummaries(admin,[gym,bakery]);
 assert.equal(sum.get(gym).people,1);assert.equal(sum.get(gym).situation,'Avançar');assert.equal(sum.get(gym).situationText,'Avançar: 1 cliente aqui');
 const detail=await placeDetail(admin,gym);assert.deepEqual(detail.names.map(n=>n.name),['Maria Teste']);
 await makePrimaryPlace(admin,{personId:maria,businessId:gym});
 assert.equal(sqlite.prepare('SELECT place_id FROM territory_people WHERE id=?').get(maria).place_id,gym);
 assert.deepEqual(sqlite.prepare('SELECT business_id,link FROM person_places WHERE person_id=?').all(maria).map(r=>[r.business_id,r.link]),[[bakery,'Sócio / dono']]);
 assert.equal((await placeSummaries(admin,[gym])).get(gym).people,1,'pessoas distintas, sem contar duas vezes');
 // Auditoria: o id da pessoa, nunca o do local.
 for(const l of sqlite.prepare("SELECT summary FROM audit_logs WHERE action IN ('save_person_place','remove_person_place')").all()){assert.equal(l.summary,`Registro territorial person:${maria}.`);assert.ok(!l.summary.includes(gym)&&!l.summary.includes(bakery));}
});

test('situação do lugar nos limites',async()=>{
 const {placeSituation}=await vite.ssrLoadModule('/lib/place-situation.ts');
 const s=(o)=>placeSituation({sector:'Alimentação',people:0,clients:0,multipliers:0,...o}).situation;
 assert.equal(s({}),'Abrir');assert.equal(s({people:1}),'Plantar');assert.equal(s({people:1,clients:1}),'Avançar');
 assert.equal(s({people:3,clients:3}),'Dominado');assert.equal(s({people:1,multipliers:1}),'Dominado');
 assert.equal(placeSituation({sector:'Religioso',people:5,clients:5,multipliers:1}).situation,'Institucional');
});

test('plano e visita: listas fixas, só o dia, sem futuro nem mais de 7 dias, fecha a programada; Comercial vê e fecha a visita dele',async()=>{
 const admin=await accessFor();member('vend@x.invalid','Comercial',null);member('emb@x.invalid','Embaixador',1);
 const {planVisit,registerVisit,savePersonPlace}=await places();const t=await vite.ssrLoadModule('/db/territory.ts');
 const gym=place({name:'Academia Corpo Ativo',sector:'Esporte e lazer'});const church=place({name:'Igreja Exemplo',sector:'Religioso',type:'Network / comunidade'});
 const clinic=place({name:'Clínica Exemplo',sector:'Saúde'});
 const maria=person();lead(maria,{assigned:'vend@x.invalid'});await savePersonPlace(admin,link(maria,gym,'Frequenta'));
 const paciente=person({name:'Paciente',place:clinic,link:'Frequenta'});
 await assert.rejects(planVisit(admin,{businessId:gym,personId:maria,step:'Pedir apresentação ao responsável',dueDate:T(),responsible:'naoexiste@x.invalid',bridge:true}),/ativo da equipe/);
 await assert.rejects(planVisit(admin,{businessId:church,personId:maria,step:'Propor parceria',dueDate:T(),responsible:OWNER,bridge:true}),/Igreja revela/);
 await assert.rejects(planVisit(admin,{businessId:clinic,personId:paciente,step:'Propor parceria',dueDate:T(),responsible:OWNER,bridge:true}),/não pode ser ponte/);
 await assert.rejects(planVisit(admin,{businessId:gym,personId:maria,step:'Texto livre',dueDate:T(),responsible:OWNER,bridge:true}));
 await planVisit(admin,{businessId:gym,personId:maria,step:'Visitar junto com {primeiro_nome}',dueDate:T(),responsible:'vend@x.invalid',bridge:true});
 assert.deepEqual(actions().map(a=>[a.name,a.category,a.status,a.person_id,a.responsible]),[['Visitar junto com Maria','Visita','Programado',maria,'vend@x.invalid']]);
 // O Comercial vê a visita que a gestão programou para ele (escopo do mapa) e a fecha.
 const seller=await accessFor('vend@x.invalid',1);
 assert.equal((await t.getTerritory(seller,new URLSearchParams({category:'action'}))).records.length,1);
 await assert.rejects(registerVisit(seller,{businessId:gym,personId:maria,result:'Conheci o responsável',day:'2999-01-01'}),/futuro/);
 await assert.rejects(registerVisit(seller,{businessId:gym,personId:maria,result:'Conheci o responsável',day:daysAgo(8)}),/7 dias/);
 await assert.rejects(registerVisit(seller,{businessId:gym,personId:maria,result:'Fiquei duas horas',day:T()}));
 await registerVisit(seller,{businessId:gym,personId:maria,result:'Conheci o responsável',day:daysAgo(1)});
 assert.deepEqual(actions().map(a=>[a.name,a.status,a.due_date]),[['Visitar junto com Maria — Conheci o responsável','Realizado',daysAgo(1)]]);
 // Sem programada: cria Realizado; a paciente nunca é gravada como ponte.
 await registerVisit(admin,{businessId:clinic,personId:paciente,result:'Deixei material aprovado',day:T()});
 assert.equal(actions().at(-1).person_id,null);assert.equal(actions().at(-1).name,'Visita — Deixei material aprovado');
 // Ação do mapa com local: só "Visita", nome da lista e responsável da equipe.
 await assert.rejects(t.mutateTerritory(admin,'activity',{requestId:uuid(),cityId:1,personId:null,name:'Conversa qualquer',category:'Visita',status:'Programado',responsible:OWNER,dueDate:T(),businessId:gym}),/passo da visita/);
 await assert.rejects(t.mutateTerritory(admin,'activity',{requestId:uuid(),cityId:1,personId:null,name:'Propor parceria',category:'Ação',status:'Programado',responsible:OWNER,dueDate:T(),businessId:gym}),/sempre uma "Visita"/);
 await assert.rejects(t.mutateTerritory(admin,'activity',{requestId:uuid(),cityId:1,personId:null,name:'Propor parceria',category:'Visita',status:'Programado',responsible:'Fulano de tal',dueDate:T(),businessId:gym}),/ativo da equipe/);
 // Embaixador e Mentorado pela API da equipe: 403.
 const route=await vite.ssrLoadModule('/app/api/territory/route.ts');
 globalThis.__eliteTestUser={email:'emb@x.invalid',displayName:'E'};
 const r=await route.POST(new Request('https://e.invalid/api/territory',{method:'POST',headers:{origin:'https://e.invalid','X-Elite-Organization':'1','content-type':'application/json'},body:JSON.stringify({action:'plant_visit',data:{businessId:gym,personId:null,result:'Não deu certo',day:T()}})}));
 assert.equal(r.status,403);
 // Hoje: visitas de plantio de hoje do responsável.
 globalThis.__eliteTestUser={email:OWNER,displayName:'Dono'};
 await planVisit(admin,{businessId:gym,personId:null,step:'Propor parceria',dueDate:T(),responsible:'vend@x.invalid',bridge:false});
 assert.equal((await places()).plantingToday(seller).then(x=>x.length) instanceof Promise,true);
 assert.equal((await (await places()).plantingToday(seller)).length,1);
});

test('remover, revogar, copiar e anonimizar cobrem lugares e visitas; Histórico mostra só quem removeu',async()=>{
 const admin=await accessFor();const {savePersonPlace,removePersonPlace,planVisit,registerVisit}=await places();const {getPersonPage}=await page();
 const priv=await vite.ssrLoadModule('/db/privacy.ts');
 const gym=place({name:'Academia Corpo Ativo',sector:'Esporte e lazer'});const shop=place({name:'Loja Exemplo',sector:'Comércio e varejo'});
 const maria=person();const lm=lead(maria);
 await savePersonPlace(admin,link(maria,gym,'Frequenta'));await savePersonPlace(admin,link(maria,shop));
 await registerVisit(admin,{businessId:gym,personId:maria,result:'Conheci o responsável',day:T()});
 await planVisit(admin,{businessId:shop,personId:maria,step:'Pedir indicação',dueDate:T(),responsible:OWNER,bridge:true});
 const req=(o={})=>({subject:'person:'+maria,channel:'WhatsApp',receivedAt:T(),note:'',...o});
 const copy=(await priv.exportSubject(admin,req())).data;
 assert.deepEqual(copy.mapa.lugares.map(l=>l.local).sort(),['Academia Corpo Ativo','Loja Exemplo']);
 assert.equal(copy.mapa.visitas.length,2);
 // Remover a academia: a visita sai do Histórico e da cópia e fica no local, sem a pessoa.
 await removePersonPlace(admin,{personId:maria,businessId:gym});
 const p=await getPersonPage(admin,maria,{all:true});
 assert.ok(!p.timeline.items.some(i=>i.title.includes('Conheci o responsável')));
 assert.ok(p.timeline.items.some(i=>i.title==='Um lugar removido pela equipe'));
 assert.ok(sqlite.prepare("SELECT 1 FROM territory_actions WHERE business_id=? AND person_id IS NULL",).get(gym));
 assert.equal((await priv.exportSubject(admin,req())).data.mapa.visitas.length,1);
 // Corrigir dados também remove um lugar.
 await savePersonPlace(admin,link(maria,gym,'Frequenta'));
 await priv.correctSubject(admin,req({name:'Maria Teste',removePlaces:[gym]}));
 assert.deepEqual(sqlite.prepare('SELECT business_id FROM person_places WHERE person_id=?').all(maria).map(r=>r.business_id),[shop]);
 // Revogação pela Privacidade: lugares somem e a visita programada é cancelada, sem a pessoa.
 await priv.revokeSubject(admin,req());
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM person_places WHERE person_id=?').get(maria).n,0);
 assert.deepEqual(sqlite.prepare("SELECT status,person_id FROM territory_actions WHERE business_id=?").all(shop).map(r=>[r.status,r.person_id]),[['Cancelado',null]]);
 // Revogação por "Etapa e autorização" (update_lead).
 const ana=person({name:'Ana Teste'});const la=lead(ana);await savePersonPlace(admin,link(ana,gym,'Frequenta'));
 const {executeAction}=await vite.ssrLoadModule('/db/mutations.ts');
 await executeAction('update_lead',{leadId:la,status:'Cancelado',assignedToEmail:'',consentRevoked:true,consentRevocationReason:'Pediu para parar'},admin);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM person_places WHERE person_id=?').get(ana).n,0);
 // Mentorado sem lead: a revogação aceita quem tem lugares.
 const mentorado=person({name:'Mentorado Sem Lead'});sqlite.prepare("INSERT INTO territory_roles(id,person_id,city_id,role,status,source,authorized_by,created_at,updated_at) VALUES(?,?,1,'Mentorado','Ativo','Portal',?,'2026-01-01','2026-01-01')").run(uuid(),mentorado,OWNER);
 await savePersonPlace(admin,link(mentorado,gym,'Frequenta'));
 await priv.revokeSubject(admin,{subject:'person:'+mentorado,channel:'WhatsApp',receivedAt:T(),note:''});
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM person_places WHERE person_id=?').get(mentorado).n,0);
 // Anonimização: lugares apagados e pessoa desligada das ações.
 const bia=person({name:'Bia Teste'});lead(bia);await savePersonPlace(admin,link(bia,gym,'Frequenta'));await registerVisit(admin,{businessId:gym,personId:bia,result:'Conheci o responsável',day:T()});
 await priv.anonymizeSubject(admin,{subject:'person:'+bia,channel:'WhatsApp',receivedAt:T(),note:'',confirm:true});
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM person_places WHERE person_id=?').get(bia).n,0);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM territory_actions WHERE person_id=?').get(bia).n,0);
 assert.ok(lm);
});

test('escopo: Comercial só lugares do escopo dele; clínica com paciente Cliente: contagem 0, Abrir, fora de "Onde buscar"; filtro "A revisar"',async()=>{
 const admin=await accessFor();member('vend@x.invalid','Comercial',null);const {placeSummaries}=await places();const {whereToLook}=await page();
 const gym=place({name:'Academia Corpo Ativo',sector:'Esporte e lazer'});const clinic=place({name:'Clínica Exemplo',sector:'Saúde'});
 const minha=person({name:'Cliente do Vendedor',place:gym,link:'Frequenta',by:'vend@x.invalid'});sale(lead(minha,{assigned:'vend@x.invalid'}));
 const outra=person({name:'Cliente de Outro',place:gym,link:'Frequenta'});sale(lead(outra));
 const paciente=person({name:'Paciente Cliente',place:clinic,link:'Frequenta'});sale(lead(paciente));
 const seller=await accessFor('vend@x.invalid',1);
 assert.equal((await placeSummaries(seller,[gym])).get(gym).people,1,'o Comercial não sabe de quem está fora do escopo');
 assert.equal((await placeSummaries(admin,[gym])).get(gym).people,2);
 const c=(await placeSummaries(admin,[clinic])).get(clinic);assert.equal(c.people,0);assert.equal(c.situation,'Abrir');
 const where=await whereToLook(admin,'lugares');assert.ok(!where.people.some(x=>x.id===clinic));assert.ok(where.people.some(x=>x.id===gym),'academia com 2 clientes: Avançar sem plano');
 // A revisar: vínculo de paciente e local com nome de igreja sem o setor certo.
 place({name:'Igreja da Praça',sector:'Comércio e varejo'});
 const {getCommercial}=await vite.ssrLoadModule('/db/commercial.ts');
 const rev=await getCommercial(admin,new URLSearchParams({review:'1'}));
 assert.deepEqual(rev.businesses.map(b=>b.name).sort(),['Clínica Exemplo','Igreja da Praça']);
 const avancar=await getCommercial(admin,new URLSearchParams({situation:'Avançar'}));
 assert.deepEqual(avancar.businesses.map(b=>b.name),['Academia Corpo Ativo']);
});

test('dicas: todo tipo e nível tem dica, só a institucional em setor sensível, sem horário marcado nem dado pessoal; {lugar} no gancho',async()=>{
 const {tipsFor,fillTip,INSTITUTIONAL}=await vite.ssrLoadModule('/lib/planting-tips.ts');const {PLACE_TYPES,PLACE_LINKS}=await vite.ssrLoadModule('/lib/places.ts');
 for(const nivel of [null,'Cliente','Indicador','Multiplicador'])for(const tipo of PLACE_TYPES)for(const situacao of ['Abrir','Plantar','Avançar','Dominado']){
  const tips=tipsFor({nivel,tipo,setor:'Alimentação',vinculo:'Colaborador',situacao});assert.ok(tips.length>=1&&tips.length<=2);
  for(const tip of tips)assert.ok(!/\d{1,2}h\b|\d{1,2}:\d{2}|resid[eê]ncia|casa dela|Elite|Esmeraldas|@|\d{4}-?\d{4}/i.test(fillTip(tip,{firstName:'Maria',place:'Padaria',company:'Sua Empresa'})),tip);}
 for(const setor of ['Religioso','Associação / entidade'])for(const vinculo of PLACE_LINKS)assert.deepEqual(tipsFor({nivel:'Cliente',tipo:'Network / comunidade',setor,vinculo}),[INSTITUTIONAL]);
 assert.deepEqual(tipsFor({nivel:'Cliente',tipo:'Empresa',setor:'Saúde',vinculo:'Frequenta'}),[INSTITUTIONAL]);
 assert.match(tipsFor({nivel:'Cliente',tipo:'Empresa',setor:'Comércio e varejo',vinculo:'Sócio / dono',situacao:'Avançar'})[0],/Peça a indicação de outro dono/);
 const {fillHook}=await vite.ssrLoadModule('/lib/hooks.ts');
 assert.equal(fillHook('Oi {primeiro_nome}, tudo bem no {lugar}?',{name:'Maria Souza',place:'Padaria Pão Dourado'}),'Oi Maria, tudo bem no Padaria Pão Dourado?');
});
