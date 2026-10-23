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
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/lib/commercial.ts')};}

const ADMIN='teamfrascaroli@gmail.com',SALES='sales@example.invalid';
// Hoje em Brasília, como o servidor calcula a janela de 30 dias.
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
function place(id,{city=1,org=1,name='Local '+id,owner=ADMIN,type='Empresa',sector='Saúde',created='2026-08-10T10:00:00-03:00',lat=-19.76,lng=-44.31,validated=1,visibility='Equipe'}={}){
 sqlite.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,place_type,sector,created_by,created_at,updated_at) VALUES(?,?,?,?,'Geral','Teste',?,?,'Mapeada',?,?,?,?,?)").run(id,org,city,name,id,owner,type,sector,owner,created,created);
 if(lat!==null)sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,?,?,?,'','Local comercial','Conferido',?,?,?,?,?)").run('business:'+id,city,lat,lng,validated,visibility,owner,created,created);
 return id;
}
function person(id,{city=1,placeId=null,name='Pessoa '+id,createdBy=ADMIN}={}){sqlite.prepare("INSERT INTO territory_people(id,city_id,name,leader,referrer_id,created_by,place_id,place_link,created_at,updated_at) VALUES(?,?,?,0,NULL,?,?,?,'2026-09-01','2026-09-01')").run(id,city,name,createdBy,placeId,placeId?'Colaborador':'');return id;}
function deal({org=1,city=1,personId,businessId=null,owner=ADMIN,assigned=owner,stage='Proposta',temperature='Quente',created='2026-09-05T10:00:00-03:00',paidAt=null,email='contato@example.invalid'}){
 const lead=Number(sqlite.prepare("INSERT INTO leads(person_id,city_id,name,email,channel,consent_at,consent_source,consent_purpose,assigned_to_email,status) VALUES(?,?,'Nome do contato',?,'Orgânico','2026-09-01','Formulário','Atendimento',?,'Lead válido')").run(personId,city,email,assigned).lastInsertRowid);
 const id=crypto.randomUUID();
 sqlite.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,business_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'Retomar','2026-10-30',?,?,?)").run(id,org,city,lead,businessId,owner,temperature,stage,owner,created,created);
 if(paidAt)sqlite.prepare("INSERT INTO sales(lead_id,city_id,status,paid_at,amount_cents) VALUES(?,?,'Pagamento confirmado',?,100000)").run(lead,city,paidAt);
 return id;
}
const touch=(opportunityId,{org=1,city=1,owner=ADMIN,day=today}={})=>sqlite.prepare("INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at) VALUES(?,?,?,?,?,'Contato','Conversa registrada',?,?)").run(crypto.randomUUID(),org,city,opportunityId,owner,day,day+'T10:00:00-03:00');
const done=(personId,{city=1,createdBy=ADMIN,day=today}={})=>sqlite.prepare("INSERT INTO territory_actions(id,city_id,person_id,name,category,status,responsible,due_date,created_by,created_at,updated_at) VALUES(?,?,?,'Visita feita','Visita','Realizado','Equipe',?,?,?,?)").run(crypto.randomUUID(),city,personId,day,createdBy,day,day);
const key=(r,k)=>r.spots.findIndex(s=>s.key===k);

test('modos do mapa: só locais validados e centros de cidade, atendimentos no local certo',async()=>{
 const m=await modules();
 const A=place('a0000000-0000-4000-8000-000000000001',{name:'Clínica Centro'});
 place('a0000000-0000-4000-8000-000000000002',{validated:0});
 place('a0000000-0000-4000-8000-000000000003',{lat:null});
 const p1=person('b0000000-0000-4000-8000-000000000001',{placeId:A,name:'Pessoa no local'});
 const p2=person('b0000000-0000-4000-8000-000000000002',{name:'Pessoa sem local'});
 const p3=person('b0000000-0000-4000-8000-000000000003',{placeId:A});
 // Ponto pessoal antigo: nunca pode virar calor, cobertura nem torre.
 sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,1,-20.123456,-45.876543,'Rua de casa','Região aproximada','Conferido',1,'Admin','test','2026-09-01','2026-09-01')").run('person:'+p2);
 deal({personId:p1,businessId:A,stage:'Proposta',temperature:'Quente'});
 const atCity=deal({personId:p2,stage:'Contato',temperature:'Frio'});
 deal({personId:p3,stage:'Ganho',temperature:'Morno',paidAt:'2026-10-02T10:00:00-03:00'});
 touch(atCity);done(p1);touch(atCity,{day:'2026-01-02'});
 const r=await m.getTerritoryPlaces(m.access,new URLSearchParams());
 assert.deepEqual(r.spots.map(s=>s.key).sort(),['business:'+A,'city:1']);
 const a=r.spots[key(r,'business:'+A)],c=r.spots[key(r,'city:1')];
 assert.equal(a.people,2,'as duas pessoas ligadas ao local');
 assert.equal(a.mapped,'2026-08-10');assert.equal(a.sector,'Saúde');assert.equal(a.type,'Empresa');
 assert.deepEqual([c.latitude,c.longitude],[-19.7628,-44.3131],'centro da cidade de referência');
 const stage=s=>m.STAGES.indexOf(s),temp=t=>m.TEMPERATURES.indexOf(t);
 assert.deepEqual(r.deals.map(d=>JSON.stringify(d)).sort(),[
  [key(r,'business:'+A),stage('Proposta'),temp('Quente'),'2026-09','',1],
  [key(r,'business:'+A),stage('Ganho'),temp('Morno'),'2026-09','2026-10',1],
  [key(r,'city:1'),stage('Contato'),temp('Frio'),'2026-09','',1],
 ].map(d=>JSON.stringify(d)).sort(),'no local do atendimento, no local da pessoa ou no centro da cidade');
 assert.equal(a.recent,1,'a visita realizada hoje');assert.equal(c.recent,1,'só o contato dos últimos 30 dias');
 const json=JSON.stringify(r);
 for(const secret of ['-45.876543','-20.123456','Pessoa no local','Pessoa sem local','contato@example.invalid','Rua de casa'])assert.ok(!json.includes(secret),secret);
 assert.equal(r.capped,false);assert.equal(r.unplaced,0);
 // A rota responde o mesmo para quem está na sessão.
 const api=await vite.ssrLoadModule('/app/api/territory/places/route.ts');
 const res=await api.GET(new Request('https://test.invalid/api/territory/places',{headers:{'X-Elite-Organization':'1'}}));
 assert.equal(res.status,200);assert.equal((await res.json()).spots.length,2);
 globalThis.__eliteTestUser=null;assert.equal((await api.GET(new Request('https://test.invalid/api/territory/places'))).status,401);
});

test('modos do mapa: cada função vê só o que já vê, e cada empresa só o que é dela',async()=>{
 const m=await modules();
 const mine=place('a0000000-0000-4000-8000-000000000011',{owner:SALES,name:'Loja do comercial'});
 const other=place('a0000000-0000-4000-8000-000000000012',{name:'Loja da gestão',lng:-44.32});
 const restricted=place('a0000000-0000-4000-8000-000000000013',{visibility:'Admin',lng:-44.33});
 const city2=place('a0000000-0000-4000-8000-000000000014',{city:2,lat:-19.91,lng:-43.93});
 deal({personId:person('b0000000-0000-4000-8000-000000000011'),businessId:mine,owner:SALES});
 deal({personId:person('b0000000-0000-4000-8000-000000000012'),businessId:other});
 deal({personId:person('b0000000-0000-4000-8000-000000000013',{city:2}),businessId:city2,city:2});
 // Outra empresa assinante, com local e atendimento próprios.
 sqlite.prepare("INSERT INTO organizations(id,name,owner_email,active,created_at) VALUES(2,'Outra empresa','dono@example.invalid',1,'2026-09-01')").run();
 const otherCity=Number(sqlite.prepare("INSERT INTO cities(organization_id,name,state,phase,leader_name,target_cac_cents,ambassador_goal,sales_goal,status,tracking_mode,created_by) VALUES(2,'Esmeraldas','MG','Piloto','',0,10,100,'Planejada','Detalhado','dono@example.invalid')").run().lastInsertRowid);
 const foreign=place('a0000000-0000-4000-8000-000000000015',{org:2,city:otherCity,name:'Local de outra empresa'});
 deal({org:2,city:otherCity,personId:person('b0000000-0000-4000-8000-000000000015',{city:otherCity}),businessId:foreign,owner:'dono@example.invalid'});

 const admin=await m.getTerritoryPlaces(m.access,new URLSearchParams());
 assert.deepEqual(admin.spots.map(s=>s.name).sort(),['Local a0000000-0000-4000-8000-000000000013','Local a0000000-0000-4000-8000-000000000014','Loja da gestão','Loja do comercial']);
 assert.equal(admin.deals.length,3);assert.ok(!JSON.stringify(admin).includes('outra empresa'));
 const sales=await m.getTerritoryPlaces({...m.access,role:'Comercial',email:SALES,cityId:null},new URLSearchParams());
 assert.deepEqual(sales.spots.map(s=>s.key),['business:'+mine],'o Comercial vê só os locais dele');
 assert.deepEqual(sales.deals.map(d=>d[5]),[1],'e só os atendimentos dele');
 const coord=await m.getTerritoryPlaces({...m.access,role:'Coordenação',cityId:1},new URLSearchParams());
 assert.deepEqual(coord.spots.map(s=>s.key).sort(),['business:'+mine,'business:'+other].sort(),'cidade dela, sem o ponto restrito');
 assert.ok(!coord.spots.some(s=>s.key==='business:'+restricted));
 assert.ok(coord.deals.every(d=>coord.spots[d[0]].cityId===1));
 assert.deepEqual(await m.getTerritoryPlaces({...m.access,role:'Coordenação',cityId:null},new URLSearchParams()).then(r=>[r.spots.length,r.deals.length]),[0,0]);
 for(const role of ['Embaixador','Financeiro','Leitura']){const r=await m.getTerritoryPlaces({...m.access,role,cityId:1,ambassadorId:1},new URLSearchParams());assert.deepEqual([r.spots.length,r.deals.length],[0,0],role);}
 assert.deepEqual(await m.getTerritoryPlaces({...m.access,active:false},new URLSearchParams()).then(r=>r.spots.length),0);
 const foreignAdmin=await m.getTerritoryPlaces({...m.access,organizationId:2},new URLSearchParams());
 assert.deepEqual(foreignAdmin.spots.map(s=>s.name),['Local de outra empresa']);
 assert.equal(foreignAdmin.deals.length,1);
});

test('modos do mapa: filtros de cidade, estado e tipo ou setor do local',async()=>{
 const m=await modules();
 const health=place('a0000000-0000-4000-8000-000000000021',{sector:'Saúde'});
 place('a0000000-0000-4000-8000-000000000022',{sector:'Alimentação',lng:-44.32});
 place('a0000000-0000-4000-8000-000000000023',{type:'Escritório',sector:'',lng:-44.33});
 place('a0000000-0000-4000-8000-000000000024',{city:2,lat:-19.91,lng:-43.93});
 deal({personId:person('b0000000-0000-4000-8000-000000000021'),businessId:health});
 deal({personId:person('b0000000-0000-4000-8000-000000000022')});
 const sector=await m.getTerritoryPlaces(m.access,new URLSearchParams('category=Saúde'));
 assert.deepEqual(sector.spots.map(s=>s.key).sort(),['business:'+health,'business:a0000000-0000-4000-8000-000000000024'].sort());
 assert.equal(sector.deals.length,1,'o atendimento sem local fica de fora do filtro de setor');assert.equal(sector.unplaced,0);
 assert.deepEqual((await m.getTerritoryPlaces(m.access,new URLSearchParams('category=Escritório'))).spots.map(s=>s.type),['Escritório']);
 const city=await m.getTerritoryPlaces(m.access,new URLSearchParams('city=2'));
 assert.deepEqual(city.spots.map(s=>s.cityId),[2]);assert.equal(city.deals.length,0);
 assert.equal((await m.getTerritoryPlaces(m.access,new URLSearchParams('state=SP'))).spots.length,0);
 // Filtros de pessoas não escondem locais: valem para o Explorar e a lista.
 assert.equal((await m.getTerritoryPlaces(m.access,new URLSearchParams('category=Embaixador'))).spots.filter(s=>s.kind==='business').length,4);
});

test('explorar: até 5.000 pontos distintos por consulta, com aviso acima disso',async()=>{
 const m=await modules();
 const insertPlace=sqlite.prepare("INSERT INTO businesses(id,organization_id,city_id,name,segment,source,identity_key,owner_email,status,place_type,sector,created_by,created_at,updated_at) VALUES(?,1,1,?,'Geral','Teste',?,?,'Mapeada','Empresa','Outro',?,'2026-09-01','2026-09-01')");
 const insertPoint=sqlite.prepare("INSERT INTO territory_locations(entity_key,city_id,latitude,longitude,region,precision,source,validated,visibility,authorized_by,authorized_at,updated_at) VALUES(?,1,?,?,'','Local comercial','Conferido',1,'Equipe',?,'2026-09-01','2026-09-01')");
 sqlite.exec('BEGIN');
 for(let i=0;i<5001;i++){const id=`c${String(i).padStart(7,'0')}-0000-4000-8000-000000000000`;insertPlace.run(id,'Local '+i,id,ADMIN,ADMIN);insertPoint.run('business:'+id,-19.7+(i%80)*0.001,-44.3+Math.floor(i/80)*0.001,ADMIN);}
 sqlite.exec('COMMIT');
 let map=await m.getTerritory(m.access,new URLSearchParams('category=business'));
 assert.equal(map.points.length,5000);assert.equal(map.pointsCapped,true);
 // Sem ponto próprio o local iria para o centro da cidade (outro ponto distinto): sai o cadastro inteiro.
 sqlite.prepare("DELETE FROM territory_locations WHERE entity_key=?").run('business:c0000000-0000-4000-8000-000000000000');sqlite.prepare("DELETE FROM businesses WHERE id=?").run('c0000000-0000-4000-8000-000000000000');
 map=await m.getTerritory(m.access,new URLSearchParams('category=business'));
 assert.equal(map.points.length,5000);assert.equal(map.pointsCapped,false);
 const places=await m.getTerritoryPlaces(m.access,new URLSearchParams());
 assert.equal(places.spots.length,5000);assert.equal(places.capped,false);
});
