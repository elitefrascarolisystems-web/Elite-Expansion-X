/** Every mounted page is pinned by its URL, never a cross-tab cookie. */
export function tenantFetch(input:string,init:RequestInit={}){
 const org=typeof window==='undefined'?null:new URL(window.location.href).searchParams.get('org');
 const headers=new Headers(init.headers);if(org)headers.set('X-Elite-Organization',org);
 return fetch(input,{...init,headers,cache:'no-store'});
}
export function organizationFromRequest(request:Request):number{
 const raw=request.headers.get('X-Elite-Organization')??new URL(request.url).searchParams.get('org');
 if(!raw||! /^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(Number(raw)))return -1;
 return Number(raw);
}
