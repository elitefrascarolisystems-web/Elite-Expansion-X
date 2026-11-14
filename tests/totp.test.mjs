import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const t=await vite.ssrLoadModule('/lib/totp.ts');
// Vetores oficiais da RFC 6238 (SHA-1, chave "12345678901234567890").
const rfcSecret=t.base32Encode(new TextEncoder().encode('12345678901234567890'));

test('base32: ida e volta', ()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(20));
 assert.deepEqual([...t.base32Decode(t.base32Encode(bytes))],[...bytes]);
 assert.equal(t.base32Encode(new TextEncoder().encode('foobar')),'MZXW6YTBOI');
 assert.equal(t.newSecret().length,32);
});

test('TOTP: vetores da RFC 6238 (8 dígitos) e os 6 dígitos que o app mostra', async()=>{
 for(const [time,code] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037']])
  assert.equal(await t.totp(rfcSecret,time*1000,8),code,`t=${time}`);
 assert.equal(await t.totp(rfcSecret,59*1000),'287082');
});

test('confere o código: aceita o passo vizinho, recusa o repetido e o errado', async()=>{
 const secret=t.newSecret(),now=Date.UTC(2026,10,14,12,0,10);
 const code=await t.totp(secret,now),step=t.stepAt(now);
 assert.equal(await t.verifyTotp(secret,code,now),step);
 assert.equal(await t.verifyTotp(secret,code,now+30_000),step,'até 30 s depois ainda vale');
 assert.equal(await t.verifyTotp(secret,code,now+90_000),null,'90 s depois não vale');
 assert.equal(await t.verifyTotp(secret,code,now,step),null,'o mesmo código não vale duas vezes');
 assert.equal(await t.verifyTotp(secret,'12345',now),null);assert.equal(await t.verifyTotp(secret,'abcdef',now),null);
 assert.equal(await t.verifyTotp(secret,code.slice(0,3)+' '+code.slice(3),now),step,'aceita com espaço');
});

test('endereço do app e códigos de recuperação', ()=>{
 const url=new URL(t.otpauthUrl('Elite Expansion X','pessoa@example.invalid','JBSWY3DPEHPK3PXP'));
 assert.equal(url.protocol,'otpauth:');assert.equal(url.searchParams.get('secret'),'JBSWY3DPEHPK3PXP');assert.equal(url.searchParams.get('issuer'),'Elite Expansion X');
 const codes=t.newRecoveryCodes();
 assert.equal(codes.length,10);assert.equal(new Set(codes).size,10);
 for(const c of codes)assert.match(c,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
 assert.equal(t.normalizeRecoveryCode('ab2d-ef34'),'AB2DEF34');
 assert.equal(t.looksLikeRecoveryCode('AB2D-EF34'),true);assert.equal(t.looksLikeRecoveryCode('123456'),false);
 assert.equal(t.groupSecret('JBSWY3DPEHPK3PXP'),'JBSW Y3DP EHPK 3PXP');
});
