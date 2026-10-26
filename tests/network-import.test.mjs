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
const lib=await vite.ssrLoadModule('/lib/network-import.ts');
async function modules(){const a=await vite.ssrLoadModule('/db/access.ts');const access=await a.getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/network-import.ts'),...await vite.ssrLoadModule('/db/territory.ts'),...await vite.ssrLoadModule('/db/followup.ts')};}
const cities=[{id:1,name:'Esmeraldas'},{id:2,name:'Betim'}];
const grid=(...lines)=>lines.map(l=>l.split(';'));

test('planilha: colunas por apelido, valor, data, situação e erros claros por linha',()=>{
 assert.deepEqual(lib.mapColumns(['Nome','Telefone','Email','Indicado por','Valor pago','Pagamento']),{name:0,whatsapp:1,email:2,referrer:3,amount:4,paidAt:5});
 assert.equal(lib.parseAmountCents('1.500,00'),150000);assert.equal(lib.parseAmountCents('R$ 1500'),150000);assert.equal(lib.parseAmountCents('1500.50'),150050);assert.equal(lib.parseAmountCents('1,500.00'),150000);assert.equal(lib.parseAmountCents(''),0);assert.equal(lib.parseAmountCents('mil'),null);
 assert.equal(lib.parseDateBR('10/03/2026'),'2026-03-10');assert.equal(lib.parseDateBR('2026-03-10'),'2026-03-10');assert.equal(lib.parseDateBR('45000'),'2023-03-15');assert.equal(lib.parseDateBR('31/02/2026'),null);assert.equal(lib.parseDateBR(''),'');
 assert.equal(lib.parseSaleStatus('pago',true),'Pagamento confirmado');assert.equal(lib.parseSaleStatus('',true),'Pagamento confirmado');assert.equal(lib.parseSaleStatus('',false),'');assert.equal(lib.parseSaleStatus('pendente',true),'Venda confirmada');assert.equal(lib.parseSaleStatus('xyz',true),null);
 const {rows,problems}=lib.buildNetworkRows(grid('Nome;Cidade;WhatsApp;Quem indicou;Valor;Data do pagamento','Ana;Esmeraldas;31999990001;;1.500,00;10/03/2026','Bia;Esmeraldas;;Ana;;','Caio;Betim;;Caio;;','Dé;Contagem;;;;','Edu;Esmeraldas;;;900;','Fá;Esmeraldas;31 9;;;'),cities,null);
 assert.deepEqual(rows.map(r=>[r.name,r.cityId,r.amountCents,r.paidAt,r.saleStatus,r.referrer]),[['Ana',1,150000,'2026-03-10','Pagamento confirmado',''],['Bia',1,0,'','','Ana']]);
 assert.deepEqual(problems.map(p=>[p.line,p.status.slice(0,20)]),[[4,'A pessoa não pode in'],[5,'Cidade "Contagem" nã'],[6,'Para registrar a ven'],[7,'WhatsApp "31 9" inco']]);
 // Sem coluna Cidade, vale a cidade escolhida na tela.
 assert.equal(lib.buildNetworkRows(grid('Nome','Zé'),cities,2).rows[0].cityId,2);
});

test('ordem: quem indica vem antes de quem foi indicado; lotes de 50; resumo',()=>{
 const {rows}=lib.buildNetworkRows(grid('Nome;Quem indicou','Caio;Bia','Bia;Ana','Ana;','Dani;Caio','Edu;Zé fora da planilha','Loop1;Loop2','Loop2;Loop1'),cities,1);
 assert.deepEqual(lib.orderByReferrer(rows).map(r=>r.name),['Ana','Edu','Bia','Caio','Dani','Loop1','Loop2']);
 assert.deepEqual(lib.batches(Array.from({length:120},(_,i)=>i)).map(b=>b.length),[50,50,20]);
 assert.deepEqual(lib.summarize([{line:2,ok:true,status:'',person:'nova',referrer:'ok',lead:true,sale:true},{line:3,ok:true,status:'',person:'existente',referrer:'planilha'},{line:4,ok:false,status:'x'}]),{ok:2,failed:1,newPeople:1,existing:1,referrals:2,leads:1,sales:1});
 assert.equal(lib.describeRow(rows[0],{line:2,ok:true,status:'',person:'nova',referrer:'planilha'}),'Nova no mapa · Indicada por Bia');
});

test('servidor: prévia sem gravar, gravação com pessoa, papel, quem indicou, atendimento e venda com a data da planilha',async()=>{
 const m=await modules();
 const file=[
  {line:2,cityId:1,name:'Ana Souza',whatsapp:'31 99999-0001',email:'',referrer:'',role:'Mentorado',place:'',link:'',product:'Mentoria Elite',amountCents:150000,paidAt:'2026-03-10',saleStatus:'Pagamento confirmado'},
  {line:3,cityId:1,name:'Bruno Lima',whatsapp:'31 99999-0002',email:'',referrer:'Ana Souza',role:'Mentorado',place:'',link:'',product:'Mentoria Elite',amountCents:150000,paidAt:'2026-04-22',saleStatus:'Pagamento confirmado'},
  {line:4,cityId:1,name:'Carla Dias',whatsapp:'',email:'',referrer:'Bruno Lima',role:'',place:'',link:'',product:'',amountCents:0,paidAt:'',saleStatus:''},
  {line:5,cityId:1,name:'Dora Erro',whatsapp:'',email:'',referrer:'Ninguém Assim',role:'',place:'',link:'',product:'',amountCents:0,paidAt:'',saleStatus:''},
 ];
 const fileKeys=file.map(r=>r.cityId+'|'+r.name.toLowerCase());
 await assert.rejects(m.importNetwork(m.access,{rows:file,commit:false}),/autorizaram o contato/);
 const preview=await m.importNetwork(m.access,{rows:file,commit:false,consent:true,fileKeys});
 assert.deepEqual(preview.rows.map(r=>[r.line,r.ok,r.person,r.referrer??'',!!r.lead,!!r.sale]),[[2,true,'nova','',true,true],[3,true,'nova','planilha',true,true],[4,true,'nova','planilha',false,false],[5,false,'nova','',false,false]]);
 assert.match(preview.rows[3].status,/não está no mapa nesta cidade nem na planilha/);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM territory_people').get().n,0,'a prévia não grava nada');
 const saved=await m.importNetwork(m.access,{rows:file.slice(0,3),commit:true,consent:true});
 assert.deepEqual(saved.rows.map(r=>[r.line,r.ok,r.status]),[[2,true,'Salvo'],[3,true,'Salvo'],[4,true,'Salvo']]);
 const ana=await (await m.getTerritory(m.access,new URLSearchParams({q:'Ana Souza',category:'person'}))).records[0];
 assert.ok(ana.roles.includes('Cliente')&&ana.roles.includes('Multiplicador')&&ana.roles.includes('Mentorado'),ana.roles.join());
 const bruno=(await m.getTerritory(m.access,new URLSearchParams({q:'Bruno Lima',category:'person'}))).records[0];
 assert.equal(bruno.referrerName,'Ana Souza');assert.ok(bruno.roles.includes('Cliente')&&bruno.roles.includes('Indicador'));
 assert.equal(sqlite.prepare("SELECT paid_at FROM sales s JOIN leads l ON l.id=s.lead_id WHERE l.name='Bruno Lima'").get().paid_at,'2026-04-22 12:00:00','a data da planilha vale como data do pagamento');
 assert.equal(sqlite.prepare("SELECT channel FROM leads WHERE name='Bruno Lima'").get().channel,'Indicação');
 const carla=(await m.getTerritory(m.access,new URLSearchParams({q:'Carla Dias',category:'person'}))).records[0];
 assert.equal(carla.referrerName,'Bruno Lima');assert.ok(!carla.roles.includes('Lead'),'sem contato não há atendimento');
 // Importar de novo: reaproveita as pessoas, mantém o indicador já registrado e não duplica a venda.
 const again=await m.importNetwork(m.access,{rows:[{...file[2],referrer:'Ana Souza',whatsapp:'31 99999-0003'},{...file[1],amountCents:200000}],commit:true,consent:true});
 assert.deepEqual(again.rows.map(r=>[r.ok,r.person,r.referrer,!!r.lead]),[[true,'existente','mantido',true],[true,'existente','ok',false]]);
 assert.equal(sqlite.prepare("SELECT referrer_id FROM territory_people WHERE name='Carla Dias'").get().referrer_id,sqlite.prepare("SELECT id FROM territory_people WHERE name='Bruno Lima'").get().id);
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM sales").get().n,2);assert.equal(sqlite.prepare("SELECT amount_cents FROM sales s JOIN leads l ON l.id=s.lead_id WHERE l.name='Bruno Lima'").get().amount_cents,200000);
 // Ciclo e contato repetido são recusados com mensagem clara.
 const bad=await m.importNetwork(m.access,{rows:[{...file[0],referrer:'Carla Dias'},{line:9,cityId:1,name:'Outra Pessoa',whatsapp:'31999990002',email:'',referrer:'',role:'',place:'',link:'',product:'',amountCents:0,paidAt:'',saleStatus:''}],commit:true,consent:true});
 assert.match(bad.rows[0].status,/ciclo/);assert.match(bad.rows[1].status,/já está no atendimento de "Bruno Lima"/);
 // A rede mostra os níveis.
 const net=await m.getNetwork(m.access,new URLSearchParams({q:'Ana Souza'}));
 assert.ok(JSON.stringify(net).includes('Multiplicador'));
});
