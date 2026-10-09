// Offline only: restores a snapshot into in-memory SQLite. Never connects to production.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const backup=JSON.parse(readFileSync(process.argv[2],'utf8'));
const db=new DatabaseSync(':memory:');
const migrations=readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();
for(const f of migrations.filter(f=>f<'0007'))db.exec(readFileSync('drizzle/'+f,'utf8'));
const quote=s=>'"'+s.replaceAll('"','""')+'"';
for(const t of backup.tables){
 assert.equal(t.has_more,false);assert.equal(t.model_projection.truncated,false);
 for(const row of t.rows){const columns=Object.keys(row);db.prepare(`INSERT INTO ${quote(t.table_name)} (${columns.map(quote)}) VALUES(${columns.map(()=>'?')})`).run(...columns.map(c=>row[c]));}
}
const original=Object.fromEntries(backup.tables.map(t=>[t.table_name,JSON.stringify(db.prepare(`SELECT * FROM ${quote(t.table_name)} ORDER BY rowid`).all())]));
for(const f of migrations.filter(f=>f>='0007'))db.exec(readFileSync('drizzle/'+f,'utf8'));
for(const t of backup.tables)assert.equal(JSON.stringify(db.prepare(`SELECT ${t.columns.map(quote)} FROM ${quote(t.table_name)} ORDER BY rowid`).all()),original[t.table_name]);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
// Reverse only the in-memory migration before any organization-specific writes exist.
db.exec('DROP INDEX app_users_email_unique; DROP INDEX cities_name_unique;');
for(const table of ['app_users','cities','audit_logs','contents','settings','tasks'])db.exec(`ALTER TABLE ${table} DROP COLUMN organization_id`);
db.exec('CREATE UNIQUE INDEX app_users_email_unique ON app_users(email); CREATE UNIQUE INDEX cities_name_unique ON cities(name,state); DROP TABLE organizations;');
for(const t of backup.tables)assert.equal(JSON.stringify(db.prepare(`SELECT * FROM ${quote(t.table_name)} ORDER BY rowid`).all()),original[t.table_name]);
console.log(JSON.stringify({tables:backup.tables.length,rows:backup.tables.reduce((n,t)=>n+t.rows.length,0),preserved:true,foreignKeys:'ok',offlineReverse:'ok'}));db.close();
