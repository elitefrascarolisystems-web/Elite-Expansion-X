import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const f=await vite.ssrLoadModule('/lib/field.ts');
// Pontos fictícios numa grade (sem endereço real): ~111 m por 0,001 grau de latitude.
const here={latitude:-10,longitude:-40};
const at=(dLat,dLng,key)=>({key,name:key,cityId:1,type:'Empresa',sector:'',latitude:-10+dLat,longitude:-40+dLng});

test('distância e formato', ()=>{
 assert.ok(Math.abs(f.distanceMeters(here,at(0.001,0))-111)<2);
 assert.equal(f.formatDistance(111),'110 m');assert.equal(f.formatDistance(1430),'1,4 km');assert.equal(f.formatDistance(3),'1 m');
});

test('perto de mim: só os do raio, do mais perto; sem nenhum, os mais perto mesmo assim', ()=>{
 const spots=[at(0.002,0,'b'),at(0.001,0,'a'),at(0.01,0,'longe')];
 const r=f.nearby(spots,here,300);
 assert.equal(r.within,true);assert.deepEqual(r.items.map(s=>s.key),['a','b']);
 const none=f.nearby([at(0.01,0,'x'),at(0.02,0,'y')],here,300,1);
 assert.equal(none.within,false);assert.deepEqual(none.items.map(s=>s.key),['x']);
});

test('rota: sempre o próximo mais perto, a partir de onde estou', ()=>{
 const stops=[at(0.03,0,'c'),at(0.01,0,'a'),at(0.02,0,'b')];
 assert.deepEqual(f.routeOrder(stops,here).map(s=>s.key),['a','b','c']);
 assert.deepEqual(f.routeOrder(stops).map(s=>s.key),['c','b','a'],'sem posição, começa no primeiro');
 assert.ok(Math.abs(f.routeLength(f.routeOrder(stops,here),here)-3*1112)<20);
});

test('links: Google Maps com paradas (até 10) e Waze para a próxima', ()=>{
 const stops=Array.from({length:12},(_,i)=>at(i*0.001,0,'p'+i));
 const url=new URL(f.googleMapsRoute(stops));
 assert.equal(url.searchParams.get('api'),'1');
 assert.equal(url.searchParams.get('destination'),'-9.991000,-40.000000');
 assert.equal(url.searchParams.get('waypoints').split('|').length,9);
 assert.equal(f.wazeTo(stops[1]),'https://waze.com/ul?ll=-9.999000%2C-40.000000&navigate=yes');
});

test('cidade mais perto do ponto', ()=>{
 assert.equal(f.nearestCity([{cityId:1,latitude:-10.5,longitude:-40},{cityId:2,latitude:-10.01,longitude:-40}],here),2);
 assert.equal(f.nearestCity([],here),null);
});
