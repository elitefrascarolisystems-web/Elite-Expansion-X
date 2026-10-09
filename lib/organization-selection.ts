export function organizationIdFromCookie(cookie:string|null):number|undefined {
 const raw=cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('elite-org='))?.slice(10);
 if(raw===undefined)return undefined;
 if(!/^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw new Error('Organização inválida.');
 return Number(raw);
}
