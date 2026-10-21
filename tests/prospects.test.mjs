import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'cloudflare:workers',replacement:root+'tests/fixtures/cloudflare.mjs'},{find:'@/app/chatgpt-auth',replacement:root+'tests/fixtures/auth.mjs'},{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
let sqlite;
function adapter(db){return {prepare(sql){let args=[];const stmt={bind(...values){args=values.map(v=>typeof v==='boolean'?Number(v):v);return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};}};return stmt;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
beforeEach(()=>{sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(root+'drizzle/'+f,'utf8'));globalThis.__eliteTestD1=adapter(sqlite);globalThis.__eliteTestUser={email:'teamfrascaroli@gmail.com',displayName:'Administrador de teste'};});
after(async()=>{sqlite.close();await vite.close();delete globalThis.__eliteTestD1;delete globalThis.__eliteTestUser;});
async function modules(){const {getUserAccess}=await vite.ssrLoadModule('/db/access.ts');const access=await getUserAccess('teamfrascaroli@gmail.com','Teste');return {access,...await vite.ssrLoadModule('/db/prospects.ts')};}
const contact=(name,phone,extra={})=>({name,phones:[phone],email:'',tags:[],note:'',...extra});
const batch=(rows,extra={})=>({rows,cityId:null,defaultDdd:'31',extraTag:'',source:'Agenda do celular (vCard)',confirmed:true,...extra});
const count=(sql='SELECT count(*) AS n FROM prospect_contacts')=>sqlite.prepare(sql).get().n;
const consent={channel:'Orgânico',consentSource:'Resposta no WhatsApp',consentPurpose:'Contato comercial',consentAccepted:true};

test('Brazilian numbers normalize to one WhatsApp identity',async()=>{
 const {normalizePhone,formatPhone,whatsappLink,renderInvite}=await vite.ssrLoadModule('/lib/prospects.ts');
 for(const raw of ['+55 (31) 99876-5432','(31) 99876-5432','031 99876-5432','0 21 31 99876-5432','5531998765432','tel:+55-31-99876-5432','99876-5432','9876-5432'])assert.equal(normalizePhone(raw,'31'),'5531998765432',raw);
 assert.equal(normalizePhone('(31) 3333-4444'),'553133334444');
 assert.equal(normalizePhone('99876-5432'),null);assert.equal(normalizePhone('(31) 89876-5432'),null);assert.equal(normalizePhone('123'),null);
 assert.equal(normalizePhone('+1 (415) 555-0100'),'14155550100');
 assert.equal(formatPhone('5531998765432'),'(31) 99876-5432');
 assert.equal(whatsappLink('5531998765432','Oi, Ana & cia?'),'https://wa.me/5531998765432?text=Oi%2C%20Ana%20%26%20cia%3F');
 assert.equal(renderInvite('Oi, {nome}! Aqui é {meu_nome}.','Ana Maria Souza','Felipe Frascaroli'),'Oi, Ana! Aqui é Felipe.');
});

test('vCard parser reads Android quoted-printable, iPhone folding, groups and vCard 4 numbers',async()=>{
 const {parseVcf}=await vite.ssrLoadModule('/lib/contact-import.ts');
 const vcf=['BEGIN:VCARD','VERSION:2.1','N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Concei=C3=A7=C3=A3o;Jo=C3=A3o;;;','FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jo=C3=A3o Concei=C3=A7=C3=A3o =','da Silva','TEL;HOME:(31) 3333-4444','TEL;CELL;PREF:+55 31 99876-5432','EMAIL;HOME:JOAO@EXAMPLE.INVALID','CATEGORIES:Família,myContacts','PHOTO;ENCODING=BASE64;JPEG:/9j/4AAQSkZJRgABAQAAAQABAAD','END:VCARD',
  'BEGIN:VCARD','VERSION:3.0','FN:Maria',' Clara','item1.TEL;type=CELL;type=VOICE:(31) 98888-7777','NOTE:Conheci no evento\\, Centro','END:VCARD',
  'BEGIN:VCARD','VERSION:4.0','FN:Ana','TEL;VALUE=uri;TYPE="cell,voice":tel:+55-31-97777-6666','END:VCARD',
  'BEGIN:VCARD','VERSION:3.0','FN:Sem telefone','EMAIL:sem@example.invalid','END:VCARD'].join('\r\n');
 const {contacts,skipped}=parseVcf(vcf);assert.equal(skipped,1);assert.equal(contacts.length,3);
 assert.deepEqual(contacts[0],{name:'João Conceição da Silva',phones:['+55 31 99876-5432','(31) 3333-4444'],email:'joao@example.invalid',tags:['Família'],note:''});
 assert.equal(contacts[1].name,'MariaClara');assert.equal(contacts[1].note,'Conheci no evento, Centro');assert.deepEqual(contacts[1].phones,['(31) 98888-7777']);
 assert.deepEqual(contacts[2].phones,['+55-31-97777-6666']);
});

test('Google Contatos CSV keeps labels, multiple values and mobile preference',async()=>{
 const {parseContactCsv}=await vite.ssrLoadModule('/lib/contact-import.ts');
 const csv='First Name,Middle Name,Last Name,Organization Name,Notes,Labels,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value,Phone 2 - Label,Phone 2 - Value\n'+
  'Ana,,Souza,,Cliente antiga,* myContacts ::: Família ::: Igreja,Home,ana@example.invalid,Home,(31) 3333-4444,Mobile,+55 31 99876-5432 ::: +55 31 98765-4321\n'+
  ',,,Padaria Central,,* starred,,,Work,(31) 3222-1111,,\n'+
  'Sem,,Numero,,,,,,,,,\n';
 const r=parseContactCsv(csv);assert.equal(r.google,true);assert.equal(r.skipped,1);
 assert.deepEqual(r.contacts[0],{name:'Ana Souza',phones:['+55 31 99876-5432','+55 31 98765-4321','(31) 3333-4444'],email:'ana@example.invalid',tags:['Família','Igreja'],note:'Cliente antiga'});
 assert.equal(r.contacts[1].name,'Padaria Central');assert.deepEqual(r.contacts[1].tags,[]);
 const sheet=parseContactCsv('Nome;Sobrenome;Celular;Etiquetas\nJoão;Lima;31 99999-0000;Vizinhos\n');assert.equal(sheet.google,false);assert.equal(sheet.contacts[0].name,'João Lima');assert.deepEqual(sheet.contacts[0].tags,['Vizinhos']);
 assert.throws(()=>parseContactCsv('Nome;Endereço\nAna;Rua A\n'),/telefone/);
 const {parseCsv}=await vite.ssrLoadModule('/lib/commercial-import.ts');assert.throws(()=>parseCsv('Nome\n'+'x\n'.repeat(51)),/50 registros/);
});

test('import preview writes nothing; commit is idempotent, owner-scoped and pending authorization',async()=>{
 const m=await modules();
 const rows=[contact('Ana','(31) 99876-5432',{tags:['Família']}),contact('Ana duplicada','+55 31 99876-5432'),contact('Sem DDD','12345'),contact('Bruno','98888-7777')];
 const preview=await m.saveProspects(m.access,'import_preview',batch(rows));
 assert.deepEqual(preview.rows.map(r=>r.status),['Novo','Repetido no arquivo','Número inválido ou sem DDD','Novo']);assert.equal(count(),0);
 await assert.rejects(m.saveProspects(m.access,'import_commit',batch(rows,{confirmed:false})),/Confirme/);
 const first=await m.saveProspects(m.access,'import_commit',batch(rows,{extraTag:'Agenda pessoal'}));assert.equal(first.imported,2);
 const again=await m.saveProspects(m.access,'import_commit',batch(rows));assert.equal(again.imported,0);assert.equal(again.rows[0].status,'Já está na sua lista');assert.equal(count(),2);
 const stored=sqlite.prepare("SELECT * FROM prospect_contacts WHERE name='Ana'").get();assert.equal(stored.whatsapp,'5531998765432');assert.equal(stored.status,'A contatar');assert.equal(stored.tags,'|Família|Agenda pessoal|');assert.equal(stored.owner_email,'teamfrascaroli@gmail.com');
 assert.equal(count('SELECT count(*) AS n FROM leads'),0);assert.equal(count('SELECT count(*) AS n FROM territory_people'),0);
 const list=await m.getProspects(m.access,new URLSearchParams());assert.equal(list.total,2);assert.deepEqual(list.tags.map(t=>t.name),['Agenda pessoal','Família']);assert.equal(list.rows[0].phone,'(31) 99876-5432');
 assert.equal((await m.getProspects(m.access,new URLSearchParams('tag=Família'))).total,1);assert.equal((await m.getProspects(m.access,new URLSearchParams('q=8888'))).total,1);
 const other={...m.access,email:'outra@example.invalid'};assert.equal((await m.getProspects(other,new URLSearchParams())).total,0);
 await assert.rejects(m.saveProspects(other,'contacted',{id:stored.id}),/fora da sua lista/);
 await assert.rejects(m.saveProspects({...m.access,role:'Embaixador',cityId:1,ambassadorId:1},'import_preview',batch(rows)),/não possui acesso/);
 await assert.rejects(m.saveProspects({...m.access,role:'Líder',cityId:1},'import_preview',batch(rows,{cityId:2})),/Cidade fora/);
 assert.ok(count("SELECT count(*) AS n FROM audit_logs WHERE action='prospect_import'")===1);
});

test('contacted, edit with version, bulk city and tag',async()=>{
 const m=await modules();await m.saveProspects(m.access,'import_commit',batch([contact('Ana','31998765432'),contact('Bruno','31988887777')]));
 const [ana,bruno]=(await m.getProspects(m.access,new URLSearchParams())).rows;
 await m.saveProspects(m.access,'contacted',{id:ana.id});let row=sqlite.prepare('SELECT * FROM prospect_contacts WHERE id=?').get(ana.id);assert.equal(row.status,'Convidado');assert.ok(row.last_contacted_at);
 await assert.rejects(m.saveProspects(m.access,'update',{id:ana.id,version:ana.version,cityId:1,tags:[],temperature:'Quente',status:'Convidado',note:''}),/outra janela/);
 await m.saveProspects(m.access,'update',{id:ana.id,version:row.version,cityId:1,tags:['Vizinhos'],temperature:'Quente',status:'Convidado',note:'Pediu valores'});
 row=sqlite.prepare('SELECT * FROM prospect_contacts WHERE id=?').get(ana.id);assert.equal(row.city_id,1);assert.equal(row.temperature,'Quente');
 assert.equal((await m.saveProspects(m.access,'bulk',{ids:[ana.id,bruno.id],cityId:2,addTag:'Feira'})).updated,2);
 assert.deepEqual(sqlite.prepare('SELECT city_id,tags FROM prospect_contacts ORDER BY name').all().map(r=>({...r})),[{city_id:2,tags:'|Vizinhos|Feira|'},{city_id:2,tags:'|Feira|'}]);
 const byCity=(await m.getProspects(m.access,new URLSearchParams())).byCity;assert.equal(byCity[0].total,2);assert.equal(byCity[0].hot,1);
});

test('authorized contact becomes a lead with consent, map identity and no duplicate',async()=>{
 const m=await modules();await m.saveProspects(m.access,'import_commit',batch([contact('Ana Souza','31998765432',{email:'ana@example.invalid'})]));
 const [ana]=(await m.getProspects(m.access,new URLSearchParams())).rows;
 await assert.rejects(m.saveProspects(m.access,'convert',{id:ana.id,cityId:1,...consent,consentAccepted:false}),/autorizou/);
 const r=await m.saveProspects(m.access,'convert',{id:ana.id,cityId:1,...consent});assert.ok(r.leadId);
 const lead=sqlite.prepare('SELECT * FROM leads WHERE id=?').get(r.leadId);assert.equal(lead.name,'Ana Souza');assert.equal(lead.consent_source,'Resposta no WhatsApp');assert.equal(lead.normalized_whatsapp,'5531998765432');assert.equal(lead.assigned_to_email,'teamfrascaroli@gmail.com');assert.equal(lead.source_label,'Agenda pessoal');
 assert.equal(count('SELECT count(*) AS n FROM territory_people'),1);
 const row=sqlite.prepare('SELECT * FROM prospect_contacts WHERE id=?').get(ana.id);assert.equal(row.status,'Virou lead');assert.equal(row.lead_id,r.leadId);
 assert.deepEqual(await m.saveProspects(m.access,'convert',{id:ana.id,cityId:1,...consent}),{leadId:r.leadId});assert.equal(count('SELECT count(*) AS n FROM leads'),1);
 await assert.rejects(m.saveProspects(m.access,'update',{id:ana.id,version:row.version,cityId:1,tags:[],temperature:'Frio',status:'A contatar',note:''}),/já virou lead/);
 const preview=await m.saveProspects({...m.access,email:'outra@example.invalid',role:'Comercial',cityId:null},'import_preview',batch([contact('Ana','(31) 99876-5432')]));assert.equal(preview.rows[0].status,'Já é lead');
});

test('an existing lead typed without country code is linked instead of duplicated',async()=>{
 const m=await modules();const {executeAction}=await vite.ssrLoadModule('/db/mutations.ts');const {parseActionPayload}=await vite.ssrLoadModule('/lib/expansion-validation.ts');
 await m.saveProspects(m.access,'import_commit',batch([contact('Ana','31998765432')]));const [ana]=(await m.getProspects(m.access,new URLSearchParams())).rows;
 await executeAction('create_lead',parseActionPayload('create_lead',{cityId:1,name:'Ana',whatsapp:'(31) 99876-5432',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Formulário',consentPurpose:'Teste',assignedToEmail:'vendas@example.invalid'}),m.access);
 const r=await m.saveProspects(m.access,'convert',{id:ana.id,cityId:2,...consent});assert.equal(r.linked,true);assert.equal(count('SELECT count(*) AS n FROM leads'),1);
 assert.equal(sqlite.prepare('SELECT city_id FROM prospect_contacts').get().city_id,1);
});

test('refusal removes the data and blocks re-import across the organization; revoked leads are blocked too',async()=>{
 const m=await modules();await m.saveProspects(m.access,'import_commit',batch([contact('Ana','31998765432')]));const [ana]=(await m.getProspects(m.access,new URLSearchParams())).rows;
 await m.saveProspects(m.access,'remove',{id:ana.id,optOut:true});assert.equal(count(),0);
 const optout=sqlite.prepare('SELECT * FROM contact_optouts').get();assert.match(optout.identity_hash,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(optout).includes('998765432'));
 const seller={...m.access,email:'vendas@example.invalid',role:'Comercial',cityId:null};
 assert.equal((await m.saveProspects(seller,'import_commit',batch([contact('Ana','+55 31 99876-5432')]))).rows[0].status,'Pediu para não ser contatado');assert.equal(count(),0);
 const {executeAction}=await vite.ssrLoadModule('/db/mutations.ts');const {parseActionPayload}=await vite.ssrLoadModule('/lib/expansion-validation.ts');
 await executeAction('create_lead',parseActionPayload('create_lead',{cityId:1,name:'Bruno',whatsapp:'31988887777',status:'Lead válido',channel:'Orgânico',consentAccepted:true,consentSource:'Formulário',consentPurpose:'Teste'}),m.access);
 await executeAction('update_lead',parseActionPayload('update_lead',{leadId:1,status:'Cancelado',consentRevoked:true,consentRevocationReason:'Pediu para sair'}),m.access);
 assert.equal((await m.saveProspects(m.access,'import_preview',batch([contact('Bruno','(31) 98888-7777')]))).rows[0].status,'Pediu para não ser contatado');
 await m.saveProspects(m.access,'import_commit',batch([contact('Carla','31977776666')]));const [carla]=(await m.getProspects(m.access,new URLSearchParams())).rows;
 await m.saveProspects(m.access,'remove',{id:carla.id,optOut:false});assert.equal(count('SELECT count(*) AS n FROM contact_optouts'),1);
 assert.equal((await m.saveProspects(m.access,'import_preview',batch([contact('Carla','31977776666')]))).rows[0].status,'Novo');
});

test('API requires sign-in and same origin; invalid input returns a readable message',async()=>{
 await modules();const api=await vite.ssrLoadModule('/app/api/prospects/route.ts');
 const post=(body,origin='https://test.invalid')=>api.POST(new Request('https://test.invalid/api/prospects',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 let r=await post({action:'import_preview',data:batch([contact('Ana','31998765432')],{defaultDdd:'0'})});assert.equal(r.status,400);assert.match((await r.json()).error,/DDD/);
 r=await post({action:'import_preview',data:batch([contact('Ana','31998765432')])});assert.equal(r.status,200);assert.equal((await r.json()).result.rows[0].status,'Novo');
 assert.equal((await post({},'https://evil.invalid')).status,403);
 globalThis.__eliteTestUser=null;assert.equal((await api.GET(new Request('https://test.invalid/api/prospects'))).status,401);
});
