import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
// This verifier operates only in memory. It never connects to the hosted database.
const backup=JSON.parse(readFileSync(process.argv[2],'utf8'));const db=new DatabaseSync(':memory:');const migrations=readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();const quote=s=>'"'+s.replaceAll('"','""')+'"';
for(const f of migrations.filter(f=>f<'0008'))db.exec(readFileSync('drizzle/'+f,'utf8'));
for(const t of backup.tables){assert.equal(t.has_more,false);assert.equal(t.model_projection.truncated,false);for(const row of t.rows){const cols=Object.keys(row);db.prepare(`INSERT INTO ${quote(t.table_name)}(${cols.map(quote)}) VALUES(${cols.map(()=>'?')})`).run(...cols.map(k=>row[k]));}}
const snapshot=()=>Object.fromEntries(backup.tables.map(t=>[t.table_name,JSON.stringify(db.prepare(`SELECT ${t.columns.map(quote)} FROM ${quote(t.table_name)} ORDER BY rowid`).all())]));const before=snapshot();
for(const f of migrations.filter(f=>f>='0008'))db.exec(readFileSync('drizzle/'+f,'utf8'));
assert.deepEqual(snapshot(),before);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
for(const name of ['city_decisions','organization_plans','commercial_activities','seller_goals','seller_reports','opportunities','businesses'])db.exec(`DROP TABLE ${name}`);
assert.deepEqual(snapshot(),before);console.log(JSON.stringify({tables:backup.tables.length,rows:backup.tables.reduce((n,t)=>n+t.rows.length,0),preserved:true,offlineRollback:true,foreignKeys:'ok'}));db.close();
