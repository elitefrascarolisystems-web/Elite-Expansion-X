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

const MSG='Linha de exemplo do modelo: troque pelos dados reais.';

/** Linhas de dados dos modelos de CSV, lidas do código das telas (o que a pessoa baixa). */
function templateLines(file,pattern){
 const literal=readFileSync(root+file,'utf8').match(pattern)?.[1];
 assert.ok(literal,`modelo não encontrado em ${file}`);
 const text=literal.replace(/\\uFEFF|﻿/g,'').replaceAll('\\r\\n','\n');
 const [header,...rows]=text.split('\n').filter(Boolean).map((line)=>line.split(';'));
 return {text,header,rows};
}

test('modelos de pessoas e de empresas: só linhas EXEMPLO, sem contato e sem "Elite"',()=>{
 const people=templateLines('app/people-import.tsx',/const TEMPLATE = "([^"]+)";/);
 const business=templateLines('app/business-import.tsx',/encodeURIComponent\('(\\uFEFFNome;Tipo de local[^']+)'\)/);
 for(const [name,template] of [['pessoas',people],['empresas',business]]){
  assert.equal(template.header[0],'Nome',name);assert.ok(template.rows.length>=1,name);
  for(const row of template.rows)assert.match(row[0],/^EXEMPLO /,`${name}: ${row[0]}`);
  assert.ok(!/elite|esmeraldas|@|\d{4,5}[-\s]?\d{4}/i.test(template.text),`${name}: modelo com Elite, cidade piloto ou contato`);
 }
 assert.ok(people.rows.every((row)=>row[people.header.indexOf('Cidade')]==='Cidade Exemplo'),'pessoas: cidade do exemplo');
});

test('importação de empresas: a linha EXEMPLO é recusada na prévia e na gravação, a real passa',async()=>{
 const {getUserAccess}=await vite.ssrLoadModule('/db/access.ts');const {saveCommercial}=await vite.ssrLoadModule('/db/commercial.ts');
 const access=await getUserAccess('teamfrascaroli@gmail.com','Teste');
 const row=(name)=>({id:crypto.randomUUID(),cityId:1,name,segment:'Alimentação',source:'Visita',ownerEmail:access.email,status:'Identificada',publicBusiness:true});
 const example=row('EXEMPLO Padaria Pão Dourado'),lower=row('exemplo - escritório do centro'),real=row('Padaria de Verdade');
 const preview=await saveCommercial(access,'import_preview',{rows:[example,lower,real]});
 assert.deepEqual(preview.rows.map((r)=>[r.line,r.ok,r.status]),[[2,false,MSG],[3,false,MSG],[4,true,'Válido']]);
 const saved=await saveCommercial(access,'import_commit',{rows:[example,real],confirmed:true});
 assert.deepEqual(saved.rows.map((r)=>[r.ok,r.status]),[[false,MSG],[true,'Salvo']]);
 assert.deepEqual(sqlite.prepare('SELECT name FROM businesses').all().map((r)=>r.name),['Padaria de Verdade'],'só a empresa real é gravada');
});
