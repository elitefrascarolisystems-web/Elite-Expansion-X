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
function opportunity(leadId,owner,{due='2026-11-01',stage='Proposta',cityId=1}={}){const id=uuid();sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,1,?,?,?,'Quente',?,'Ligar',?,'t','2026-10-05','2026-10-05')").run(id,cityId,leadId,owner,stage,due);return id;}
function sale(leadId,{cents=150000,paid='2026-10-20T11:00:00-03:00',cityId=1}={}){sqlite.prepare("INSERT INTO sales(lead_id,city_id,product,amount_cents,status,paid_at,created_at,updated_at) VALUES(?,?,'Mentoria',?,'Pagamento confirmado',?,'2026-10-19','2026-10-20')").run(leadId,cityId,cents,paid);}
function place({cityId=1,name='Padaria Pão Dourado',sector='Alimentação',type='Empresa'}={}){const id=uuid();sqlite.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,place_type,sector,created_by,created_at,updated_at) VALUES(?,1,?,?,'x','teste',?,?, 'Selecionada',?,?,?,'2026-10-01','2026-10-01')").run(id,cityId,name,id,OWNER,type,sector,OWNER);sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,?,-19.76,-44.31,'','Local comercial','teste',1,'Equipe','t','2026-10-01','2026-10-01')").run('business:'+id,cityId);return id;}
const NOW=Date.parse('2026-11-04T15:00:00-03:00');

test('quem vê: Administrador, Coordenação da cidade, Líder sem cidade, Comercial pelo atendimento ou cadastro; Embaixador e Mentorado 403; outra empresa e anonimizado 404',async()=>{
 const {getPersonPage}=await page();const admin=await accessFor();const c2=city('Outra Cidade');
 member('coord2@x.invalid','Coordenação',c2);member('lider@x.invalid','Líder',null);member('vend@x.invalid','Comercial',null);member('vend2@x.invalid','Comercial',null);member('emb@x.invalid','Embaixador',1);member('ment@x.invalid','Mentorado',1);
 const maria=person();const lm=lead(maria,{assigned:'vend@x.invalid'});opportunity(lm,'vend@x.invalid');
 const bruno=person({name:'Bruno Teste',by:'vend2@x.invalid'});
 assert.equal((await getPersonPage(admin,maria,{now:NOW})).name,'Maria Teste');
 const notFound=e=>e.status===404&&e.message==='Pessoa não encontrada ou fora do seu acesso.';
 await assert.rejects(getPersonPage(await accessFor('coord2@x.invalid',1),maria,{now:NOW}),notFound);
 await assert.rejects(getPersonPage(await accessFor('lider@x.invalid',1),maria,{now:NOW}),notFound);
 assert.equal((await getPersonPage(await accessFor('vend@x.invalid',1),maria,{now:NOW})).attendance.hidden,false);
 assert.equal((await getPersonPage(await accessFor('vend2@x.invalid',1),bruno,{now:NOW})).name,'Bruno Teste','o Comercial vê quem cadastrou');
 await assert.rejects(getPersonPage(await accessFor('vend2@x.invalid',1),maria,{now:NOW}),notFound);
 await assert.rejects(getPersonPage(admin,'nao-e-uuid',{now:NOW}),notFound);
 // Rota: Embaixador e Mentorado 403; o mesmo id em outra organização, 404 com a mesma mensagem.
 const route=await vite.ssrLoadModule('/app/api/territory/person/route.ts');
 const get=(org=1)=>route.GET(new Request(`https://e.invalid/api/territory/person?id=${maria}`,{headers:{'X-Elite-Organization':String(org)}}));
 globalThis.__eliteTestUser={email:'emb@x.invalid',displayName:'E'};assert.equal((await get()).status,403);
 globalThis.__eliteTestUser={email:'ment@x.invalid',displayName:'M'};assert.equal((await get()).status,403);
 const {createOrganization}=await vite.ssrLoadModule('/db/organizations.ts');
 const org=await createOrganization(admin,{name:'Outra',ownerEmail:'dona@outra.invalid',ownerName:'Dona',requestId:uuid()});
 globalThis.__eliteTestUser={email:'dona@outra.invalid',displayName:'D'};const other=await get(org);assert.equal(other.status,404);assert.equal((await other.json()).error,'Pessoa não encontrada ou fora do seu acesso.');
 // Anonimizada: 404.
 sqlite.prepare("UPDATE territory_people SET name='Titular anonimizado ABC123' WHERE id=?").run(bruno);
 await assert.rejects(getPersonPage(admin,bruno,{now:NOW}),notFound);
});

test('sem contato nem coordenada; revogado vira "não entrar em contato"; Comercial sem o id de quem está fora; 200 indicados sem passar de 100 parâmetros',async()=>{
 const {getPersonPage}=await page();const admin=await accessFor();member('vend@x.invalid','Comercial',null);
 const ana=person({name:'Ana Indicadora'});
 const maria=person({referrer:ana});const lm=lead(maria,{assigned:'vend@x.invalid'});opportunity(lm,'vend@x.invalid');sale(lm);
 const text=JSON.stringify(await getPersonPage(admin,maria,{now:NOW}));
 for(const word of ['latitude','longitude','31999990000','maria@cliente.invalid','whatsapp'])assert.ok(!text.includes(word),word);
 const seller=await getPersonPage(await accessFor('vend@x.invalid',1),maria,{now:NOW});
 assert.deepEqual(seller.referrer,{kind:'fora'});assert.ok(!JSON.stringify(seller).includes(ana),'sem o id de Ana');assert.ok(!JSON.stringify(seller).includes('Ana Indicadora'));
 assert.deepEqual((await getPersonPage(admin,maria,{now:NOW})).referrer,{kind:'pessoa',id:ana,name:'Ana Indicadora'});
 // Revogada: nenhum contato e "Não entrar em contato" (sem botão).
 const rita=person({name:'Rita Revogou'});lead(rita,{revoked:'2026-10-10T10:00:00-03:00'});
 const r=await getPersonPage(admin,rita,{now:NOW});assert.equal(r.next.rule,1);assert.equal(r.next.button,null);
 // 200 indicados de Maria: lista limitada a 50, contagem completa.
 for(let i=0;i<200;i++)person({name:'Indicado '+String(i).padStart(3,'0'),referrer:maria});
 const many=await getPersonPage(admin,maria,{now:NOW});assert.equal(many.referred.total,200);assert.equal(many.referred.people.length,50);
 assert.equal(many.level,'Indicador');
});

test('Comercial que só cadastrou: atendimento de outra pessoa, Próximo passo sem as regras 2 a 6 e Histórico só com início e pagamento, sem valor',async()=>{
 const {getPersonPage}=await page();member('vend@x.invalid','Comercial',null);member('vend2@x.invalid','Comercial',null);
 await accessFor();const maria=person({by:'vend2@x.invalid'});const lm=lead(maria,{assigned:'vend@x.invalid'});opportunity(lm,'vend@x.invalid',{due:'2026-10-01'});sale(lm);
 sqlite.prepare("INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at) SELECT ?,1,1,id,'vend@x.invalid','Contato','Conversou sobre a proposta','2026-10-06','2026-10-06' FROM opportunities").run(uuid());
 const p=await getPersonPage(await accessFor('vend2@x.invalid',1),maria,{now:NOW});
 assert.deepEqual(p.attendance,{hidden:true});
 assert.ok(![2,3,4,5,6].includes(p.next.rule),`regra ${p.next.rule}`);
 const kinds=p.timeline.items.map(i=>i.kind);
 assert.ok(kinds.includes('atendimento')&&kinds.includes('pagamento'));
 for(const k of ['atividade','etapa','venda','acompanhamento'])assert.ok(!kinds.includes(k),k);
 assert.equal(p.timeline.items.find(i=>i.kind==='pagamento').detail,undefined,'sem valor');
 assert.equal(p.consent,null);
 // O responsável vê o atendimento: Cliente pago sem indicação → regra 6; outro com retorno atrasado → regra 2.
 const own=await getPersonPage(await accessFor('vend@x.invalid',1),maria,{now:NOW});
 assert.equal(own.next.rule,6);assert.equal(own.next.button,'Pedir indicação');
 const joana=person({name:'Joana Atrasada'});opportunity(lead(joana,{assigned:'vend@x.invalid'}),'vend@x.invalid',{due:'2026-10-01'});
 const late=await getPersonPage(await accessFor('vend@x.invalid',1),joana,{now:NOW});
 assert.equal(late.next.rule,2);assert.equal(late.next.button,'Registrar retorno');
 assert.ok(own.timeline.items.some(i=>i.kind==='atividade'&&i.detail==='Conversou sobre a proposta'));
});

test('vínculo sensível: a pessoa sai do ponto do local, o nome some para quem não é gestão e a gestão vê "a revisar"',async()=>{
 const {getPersonPage}=await page();const admin=await accessFor();member('vend@x.invalid','Comercial',null);
 const church=place({name:'Igreja Exemplo',sector:'Religioso',type:'Network / comunidade'});
 const clinic=place({name:'Clínica Exemplo',sector:'Saúde'});
 const bakery=place();
 const fiel=person({name:'Pessoa Fiel',place:church,link:'Frequenta',by:'vend@x.invalid'});lead(fiel,{assigned:'vend@x.invalid',label:'Mapeamento · Igreja Exemplo'});
 const paciente=person({name:'Pessoa Paciente',place:clinic,link:'Frequenta'});
 const medica=person({name:'Pessoa Médica',place:clinic,link:'Colaborador'});
 const dono=person({name:'Pessoa Dona',place:bakery,link:'Sócio / dono'});
 const a=await getPersonPage(admin,fiel,{now:NOW});
 assert.equal(a.place,null);assert.equal(a.placeReview.name,'Igreja Exemplo');assert.equal(a.onMap.kind,'cidade');
 assert.ok(a.timeline.items.find(i=>i.kind==='atendimento').title.endsWith('Mapeamento'),'origem sem o nome do local');
 assert.ok(!JSON.stringify(a.tips).includes('Igreja'));
 const s=await getPersonPage(await accessFor('vend@x.invalid',1),fiel,{now:NOW});
 assert.equal(s.placeReview,null);assert.ok(!JSON.stringify(s).includes('Igreja Exemplo'));
 assert.equal((await getPersonPage(admin,medica,{now:NOW})).place.name,'Clínica Exemplo','colaborador da clínica não é sensível');
 assert.equal((await getPersonPage(admin,paciente,{now:NOW})).place,null);
 assert.equal((await getPersonPage(admin,dono,{now:NOW})).onMap.name,'Padaria Pão Dourado');
 // Mapa: o local não conta a pessoa sensível; GET /api/territory não manda o nome para o Comercial.
 const t=await vite.ssrLoadModule('/db/territory.ts');
 const spots=(await t.getTerritoryPlaces(admin,new URLSearchParams())).spots;
 assert.equal(spots.find(x=>x.key==='business:'+church).people,0);
 assert.equal(spots.find(x=>x.key==='business:'+clinic).people,1,'só a colaboradora');
 const seller=await t.getTerritory(await accessFor('vend@x.invalid',1),new URLSearchParams({key:'person:'+fiel}));
 assert.equal(seller.records[0].place,undefined);assert.ok(!JSON.stringify(seller).includes('Igreja Exemplo'));
 const mgmt=await t.getTerritory(admin,new URLSearchParams({key:'person:'+fiel}));
 assert.equal(mgmt.records[0].place.review,true);
});

test('titular anonimizado some do mapa, da Rede e da página (com lead e embaixador, e só mapeado); link_referral sem observação e limpo',async()=>{
 const admin=await accessFor();const {getPersonPage}=await page();
 const pai=person({name:'Pai Teste'});const filho=person({name:'Filho Teste'});
 const {linkReferral,getNetwork}=await vite.ssrLoadModule('/db/followup.ts');
 await linkReferral(admin,{personId:filho,referrerId:pai,note:'conheci na feira, telefone 31999990000'});
 const log=sqlite.prepare("SELECT summary FROM audit_logs WHERE action='link_referral'").get();
 assert.equal(log.summary,`${pai} → ${filho}`,'só os ids, sem a observação livre');
 sqlite.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) VALUES(1,?,'link_referral','territory',?,'2026-01-01')").run(OWNER,`${pai} → ${filho}: observação antiga`);
 const lf=lead(filho);sqlite.prepare("INSERT INTO ambassadors(person_id,city_id,name,code,status) VALUES(?,1,'Filho Teste','FT1','Ativo')").run(filho);
 const {anonymizeSubject}=await vite.ssrLoadModule('/db/privacy.ts');
 await anonymizeSubject(admin,{subject:'person:'+filho,channel:'WhatsApp',receivedAt:'2026-11-01',note:'',confirm:true});
 await anonymizeSubject(admin,{subject:'person:'+pai,channel:'WhatsApp',receivedAt:'2026-11-01',note:'',confirm:true});
 assert.ok(sqlite.prepare("SELECT summary FROM audit_logs WHERE action='link_referral'").all().every(r=>!r.summary.includes(filho)&&!r.summary.includes('observação')));
 const t=await vite.ssrLoadModule('/db/territory.ts');
 const map=await t.getTerritory(admin,new URLSearchParams({category:'person'}));
 assert.ok(!map.records.some(r=>r.id===filho||r.id===pai),'fora do mapa');
 assert.equal(map.roleCounts.Embaixador,0,'fora das contagens');
 const net=await getNetwork(admin,new URLSearchParams({view:'list'}));
 assert.ok(!net.records.some(r=>r.id===filho||r.id===pai),'fora da Rede');
 await assert.rejects(getPersonPage(admin,filho,{now:NOW}),e=>e.status===404);
 await assert.rejects(getPersonPage(admin,pai,{now:NOW}),e=>e.status===404);
 assert.ok(lf);
});

test('Onde buscar: contagens e listas só no escopo de quem vê, até 50, só nome e motivo',async()=>{
 const {whereToLook}=await page();const admin=await accessFor();const c2=city('Outra Cidade');
 member('coord@x.invalid','Coordenação',1);member('vend@x.invalid','Comercial',null);member('emb@x.invalid','Embaixador',1);
 const cli=person({name:'Cliente Sem Indicar'});sale(lead(cli));
 person({name:'Indicado Sem Atendimento',referrer:cli});// Cliente agora indicou: sai de "clientes"
 const cli2=person({name:'Cliente Dois'});sale(lead(cli2));
 person({name:'Mapeado Antigo',created:'2026-09-01T10:00:00-03:00'});
 person({name:'Mapeado Outra Cidade',cityId:c2,created:'2026-09-01T10:00:00-03:00'});
 person({name:'Do Vendedor',by:'vend@x.invalid',created:'2026-09-01T10:00:00-03:00'});
 const all=await whereToLook(admin);
 assert.deepEqual(all.counts,{clientes:1,indicacoes:1,mapeados:4,lugares:0});
 const coord=await whereToLook(await accessFor('coord@x.invalid',1));assert.equal(coord.counts.mapeados,3,'sem a outra cidade');
 const seller=await whereToLook(await accessFor('vend@x.invalid',1),'mapeados');
 assert.deepEqual(seller.people.map(p=>p.name),['Do Vendedor']);assert.deepEqual(Object.keys(seller.people[0]).sort(),['id','name','reason']);
 await assert.rejects(whereToLook(await accessFor('emb@x.invalid',1)),e=>e.status===403);
});

test('regras puras: próximo passo na ordem, linha do tempo pelo dia de Brasília, dicas sem dado sensível',async()=>{
 const {nextStep}=await vite.ssrLoadModule('/lib/next-step.ts');
 const base={revoked:false,attendance:null,hasAttendance:true,attendanceHidden:false,canStartAttendance:true,isClient:false,referredCount:0,mentoradoWithoutMeeting:false,referredWithoutAttendance:0,multiplierWithoutAmbassador:false,canAddAmbassador:false};
 const rule=(o)=>nextStep({...base,...o}).rule;
 assert.equal(rule({revoked:true,attendance:{late:true,today:false,fecha:false}}),1);
 assert.equal(rule({attendance:{late:true,today:true,fecha:true}}),2);
 assert.equal(rule({attendance:{late:false,today:true,fecha:true}}),3);
 assert.equal(rule({attendance:{late:false,today:false,fecha:true}}),4);
 assert.equal(rule({hasAttendance:false}),5);assert.equal(nextStep({...base,hasAttendance:false,canStartAttendance:false}).button,null);
 assert.equal(rule({isClient:true}),6);
 assert.equal(rule({isClient:true,attendanceHidden:true,mentoradoWithoutMeeting:true}),7);
 assert.equal(rule({hasAttendance:false,attendanceHidden:true}),12,'quem não vê o atendimento nunca recebe "Iniciar atendimento"');
 assert.equal(rule({plantingVisitOverdue:true}),8);assert.equal(rule({placeAdvanceWithoutPlan:true}),9);
 assert.equal(rule({referredWithoutAttendance:2}),10);
 assert.equal(rule({multiplierWithoutAmbassador:true}),12,'sem permissão de cadastrar embaixador');
 assert.equal(rule({multiplierWithoutAmbassador:true,canAddAmbassador:true}),11);
 assert.equal(rule({}),12);
 const {buildPersonTimeline,brazilDay}=await vite.ssrLoadModule('/lib/person-timeline.ts');
 assert.equal(brazilDay('2026-11-02 02:00:00'),'2026-11-01','UTC de madrugada é o dia anterior em Brasília');
 assert.equal(brazilDay('2026-11-02T23:30:00-03:00'),'2026-11-02');assert.equal(brazilDay('2026-11-02'),'2026-11-02');
 const t=buildPersonTimeline([{id:'a',kind:'cadastro',date:'2026-11-01',title:'x'},{id:'b',kind:'pagamento',date:'2026-11-01T09:00:00-03:00',title:'y'},{id:'c',kind:'atividade',date:'2026-11-03',title:'z'}],2);
 assert.deepEqual(t.items.map(i=>i.id),['c','b']);assert.equal(t.more,true);assert.equal(t.items[1].at,'2026-11-01T12:00:00-03:00');
 const {plantingTips}=await vite.ssrLoadModule('/lib/planting-tips.ts');
 const {PLACE_TYPES}=await vite.ssrLoadModule('/lib/places.ts');
 for(const level of [null,'Cliente','Indicador','Multiplicador'])for(const type of PLACE_TYPES){const tips=plantingTips(level,{type,sector:'Alimentação'});assert.ok(tips.length>=1&&tips.length<=2);for(const tip of tips)assert.ok(!/\d{1,2}h|hor[aá]rio|resid[eê]ncia|casa dela|Elite|Esmeraldas|@|\d{4}-?\d{4}/i.test(tip),tip);}
 assert.deepEqual(plantingTips('Cliente',{type:'Network / comunidade',sector:'Religioso'}).length,1);
 assert.match(plantingTips('Cliente',{type:'Empresa',sector:'Saúde'})[0],/instituição/);
 const {sensitiveLink}=await vite.ssrLoadModule('/lib/person-places.ts');
 assert.equal(sensitiveLink({sector:'Religioso'},'Sócio / dono'),true);assert.equal(sensitiveLink({sector:'Saúde'},'Frequenta'),true);
 assert.equal(sensitiveLink({sector:'Saúde'},'Colaborador'),false);assert.equal(sensitiveLink(null,'Frequenta'),false);
});
