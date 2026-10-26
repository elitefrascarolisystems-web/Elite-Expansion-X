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
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/mutations.ts'),...await vite.ssrLoadModule('/lib/expansion-validation.ts'),...await vite.ssrLoadModule('/db/network-import.ts'),...await vite.ssrLoadModule('/db/queries.ts'),...await vite.ssrLoadModule('/db/portal.ts')};}
const person=(name,extra={})=>({cityId:1,name,authorized:true,leader:false,referrerId:null,...extra});
const record=async(m,name)=>(await m.getTerritory(m.access,new URLSearchParams({q:name,category:'person'}))).records[0];
const CENTER=[-19.7628,-44.3131];

test('bairro: a pessoa sem local aparece no centro do bairro, nunca na residência; sem ponto, fica no centro da cidade',async()=>{
 const m=await modules();
 const {id:regionId,existing}=await m.mutateTerritory(m.access,'region',{cityId:1,name:'Novo Retiro'});
 assert.equal(existing,false);
 // Mesmo nome (sem acento ou caixa) não duplica.
 assert.equal((await m.mutateTerritory(m.access,'region',{cityId:1,name:'novo retiro'})).id,regionId);
 const ana=await m.mutateTerritory(m.access,'person',person('Ana do Bairro',{regionId}));
 let r=await record(m,'Ana do Bairro');
 assert.deepEqual([r.location.latitude,r.location.longitude],CENTER,'bairro sem ponto: centro da cidade');
 assert.deepEqual(r.region,{id:regionId,name:'Novo Retiro',located:false});
 // Localizar o bairro: o ponto vale para todas as pessoas dele.
 await m.mutateTerritory(m.access,'region',{id:regionId,cityId:1,name:'Novo Retiro',latitude:-19.75,longitude:-44.30,source:'Busca do bairro pelo nome'});
 r=await record(m,'Ana do Bairro');
 assert.deepEqual([r.location.latitude,r.location.longitude],[-19.75,-44.3]);
 assert.equal(r.location.region,'Novo Retiro');assert.equal(r.region.located,true);
 // O cadastro de localização direto para a pessoa continua proibido (LGPD).
 await assert.rejects(m.mutateTerritory(m.access,'location',{key:`person:${ana.id}`,latitude:-19.7,longitude:-44.3,region:'',precision:'Região aproximada',source:'Teste de LGPD',validated:true,authorized:true,visibility:'Equipe'}),/centro da cidade ou do bairro/);
 // Bairro de outra cidade é recusado.
 await assert.rejects(m.mutateTerritory(m.access,'person',person('Bia Errada',{cityId:2,regionId})),/mesma cidade/);
 // Lista para a gestão: pessoas por bairro e situação do ponto.
 const list=await m.listRegions(m.access,1);
 assert.deepEqual(list.map(x=>[x.name,x.located,x.people]),[['Novo Retiro',true,1]]);
 // Não remove bairro com pessoas.
 await assert.rejects(m.mutateTerritory(m.access,'region_delete',{id:regionId}),/pessoas neste bairro/);
 // Modos de ver: o bairro vira um ponto com a contagem de pessoas; a pessoa continua sem coordenada própria.
 const places=await m.getTerritoryPlaces(m.access,new URLSearchParams('city=1'));
 const spot=places.spots.find(s=>s.kind==='region');
 assert.deepEqual([spot.name,spot.people,spot.latitude,spot.longitude],['Novo Retiro',1,-19.75,-44.3]);
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM territory_locations WHERE entity_key LIKE 'person:%'").get().n,0);
});

test('bairro no atendimento, no portal do mentorado e na planilha; painel do dashboard lista os bairros',async()=>{
 const m=await modules();
 const {id:regionId}=await m.mutateTerritory(m.access,'region',{cityId:1,name:'Centro',latitude:-19.76,longitude:-44.31});
 // Novo atendimento com bairro: a pessoa nasce no bairro.
 await m.executeAction('create_lead',m.parseActionPayload('create_lead',{cityId:1,regionId,name:'Caio Atendido',email:'caio@example.invalid',whatsapp:'',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Teste',consentPurpose:'Teste'}),m.access);
 let r=await record(m,'Caio Atendido');assert.equal(r.region?.name,'Centro');assert.deepEqual([r.location.latitude,r.location.longitude],[-19.76,-44.31]);
 // Planilha: coluna Bairro usa o bairro existente ou cadastra um novo (sem ponto).
 const out=await m.importNetwork(m.access,{rows:[
  {line:2,cityId:1,name:'Dora Planilha',region:'centro',whatsapp:'',email:'',referrer:'',role:'',place:'',link:'',product:'',amountCents:0,paidAt:'',saleStatus:''},
  {line:3,cityId:1,name:'Edu Planilha',region:'Jardim das Flores',whatsapp:'',email:'',referrer:'Dora Planilha',role:'',place:'',link:'',product:'',amountCents:0,paidAt:'',saleStatus:''},
 ],commit:true,consent:true});
 assert.deepEqual(out.rows.map(x=>x.ok),[true,true]);
 r=await record(m,'Dora Planilha');assert.equal(r.region?.id,regionId);
 r=await record(m,'Edu Planilha');assert.deepEqual([r.region?.name,r.region?.located],['Jardim das Flores',false]);
 assert.deepEqual([r.location.latitude,r.location.longitude],CENTER,'bairro novo ainda sem ponto: centro da cidade');
 // Dashboard: lista de bairros com a situação do ponto.
 const data=await m.getDashboardData(m.access);
 assert.deepEqual(data.regions.map(x=>[x.name,x.located]),[['Centro',true],['Jardim das Flores',false]]);
 // Portal: a indicação do mentorado leva o bairro.
 sqlite.prepare("INSERT INTO app_users(organization_id,email,name,role,city_id,active,created_by,created_at) VALUES(1,'mentorada@example.invalid','Marina Mentorada','Mentorado',1,1,'t','2026-01-01')").run();
 const access=await (await vite.ssrLoadModule('/db/access.ts')).getUserAccess('mentorada@example.invalid','Marina');
 globalThis.__eliteTestUser={email:'mentorada@example.invalid',displayName:'Marina'};
 const portal=await m.getPortalData(access);
 assert.deepEqual(portal.regions.map(x=>x.name),['Centro','Jardim das Flores']);
 await m.portalAction(access,'refer',{name:'Fabi Indicada',whatsapp:'31999990077',email:'',cityId:1,regionId,note:'',consent:true});
 globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};
 r=await record(m,'Fabi Indicada');assert.equal(r.region?.name,'Centro');
});
