import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const h=await vite.ssrLoadModule('/lib/hexgrid.ts');
const m=await vite.ssrLoadModule('/lib/map-modes.ts');
const c=await vite.ssrLoadModule('/lib/commercial.ts');

// Distância no chão (haversine), em metros.
function meters([lng1,lat1],[lng2,lat2]){const r=Math.PI/180,a=Math.sin((lat2-lat1)*r/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin((lng2-lng1)*r/2)**2;return 6371008.8*2*Math.asin(Math.sqrt(a));}
function inside([x,y],ring){let hit=false;for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}

test('hexágonos: cada ponto cai no seu hexágono, do tamanho pedido no chão',()=>{
 const points=[];let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<400;i++)points.push({latitude:-19.80+rand()*0.12,longitude:-44.36+rand()*0.12});
 const {hexes,neighbors}=h.hexBins(points,700);
 assert.equal(hexes.reduce((n,x)=>n+x.count,0),400,'nenhum ponto perdido');
 for(const p of points.slice(0,120)){const hex=hexes.filter(x=>inside([p.longitude,p.latitude],x.ring));assert.equal(hex.length,1,'um e só um hexágono');}
 for(const hex of hexes.slice(0,10)){
  assert.equal(hex.ring.length,7);assert.deepEqual(hex.ring[0],hex.ring[6]);
  for(const corner of hex.ring.slice(0,6)){const d=meters(hex.center,corner);assert.ok(Math.abs(d-700)/700<0.03,`raio ${d.toFixed(0)} m`);}
 }
 assert.ok(neighbors.every(n=>n.count===0&&!hexes.some(x=>x.id===n.id)),'vizinhos são só os vazios');
 assert.ok(hexes.every((x,i)=>i===0||hexes[i-1].count>=x.count),'do mais cheio ao mais vazio');
});

test('hexágonos: um hexágono sozinho tem seis vizinhos; pontos próximos somam, distantes separam',()=>{
 const one=h.hexBins([{latitude:-19.76,longitude:-44.31}],700);
 assert.equal(one.hexes.length,1);assert.equal(one.neighbors.length,6);
 const near=h.hexBins([{latitude:-19.76,longitude:-44.31},{latitude:-19.7603,longitude:-44.3102}],700);
 assert.deepEqual(near.hexes.map(x=>x.count),[2]);
 const far=h.hexBins([{latitude:-19.76,longitude:-44.31},{latitude:-19.80,longitude:-44.36}],700);
 assert.deepEqual(far.hexes.map(x=>x.count),[1,1]);
 assert.deepEqual(h.hexBins([],700),{hexes:[],neighbors:[]});
});

test('hexágonos: tamanho por aproximação, área na legenda e faixas',()=>{
 assert.deepEqual([6,9.5,12,14.2,17].map(h.hexRadiusForZoom),[8000,2500,700,200,80]);
 assert.equal(h.hexAreaLabel(700),'≈ 1,3 km²');assert.equal(h.hexAreaLabel(200),'≈ 10 ha');assert.equal(h.hexAreaLabel(80),'≈ 1,7 ha');
 assert.deepEqual(h.countBins(40),[1,3,7,15,26]);
 assert.deepEqual(h.binLabels([1,3,7,15,26],40),['1–2','3–6','7–14','15–25','26–40']);
 assert.deepEqual(h.countBins(3),[1,2,3]);assert.deepEqual(h.binLabels([1,2,3],3),['1','2','3']);
 assert.deepEqual(h.countBins(0),[]);
 assert.deepEqual([1,2,3,6,7,25,26,40].map(v=>h.binIndex([1,3,7,15,26],v)),[0,0,1,1,2,3,4,4]);
});

const STAGE=s=>c.STAGES.indexOf(s),TEMP=t=>c.TEMPERATURES.indexOf(t);
const spot=(key,extra={})=>({key,kind:key.startsWith('city:')?'city':'business',name:key,latitude:-19.76,longitude:-44.31,cityId:1,type:key.startsWith('city:')?'Cidade':'Empresa',sector:'',mapped:'',people:0,recent:0,...extra});
const data={
 spots:[spot('business:a',{mapped:'2026-07-03',people:3,recent:2}),spot('business:b',{mapped:'2026-09-20',longitude:-44.32}),spot('city:1',{latitude:-19.7628,longitude:-44.3131,recent:4}),spot('business:c',{mapped:'2026-09-01',longitude:-44.33})],
 deals:[
  [0,STAGE('Proposta'),TEMP('Quente'),'2026-08','',2],[0,STAGE('Ganho'),TEMP('Morno'),'2026-08','2026-09',1],
  [1,STAGE('Perdido'),TEMP('Frio'),'2026-09','',1],
  [2,STAGE('Contato'),TEMP('Frio'),'2026-09','',3],[2,STAGE('Ganho'),TEMP('Quente'),'2026-07','2026-10',1],
 ],capped:false,unplaced:0,updatedAt:'2026-10-23T10:00:00-03:00'};

test('modos: endereço com o modo e nomes válidos',()=>{
 assert.equal(m.parseMode('calor'),'calor');assert.equal(m.parseMode('cidade-acesa'),'cidade-acesa');
 assert.equal(m.parseMode('outra'),'explorar');assert.equal(m.parseMode(null),'explorar');
 assert.equal(m.withMode('https://x.invalid/?area=territorio&ver=mapa','funil'),'https://x.invalid/?area=territorio&ver=mapa&modo=funil');
 assert.equal(m.withMode('https://x.invalid/?area=territorio&ver=mapa&modo=funil','explorar'),'https://x.invalid/?area=territorio&ver=mapa');
 assert.deepEqual(m.MAP_MODES.map(x=>x.id),['explorar','calor','cobertura','funil','linha-do-tempo','cidade-acesa']);
});

test('calor: cada medida pesa o que diz, e o centro da cidade não conta como local',()=>{
 assert.deepEqual(m.heatWeights(data,'locais'),[1,1,0,1]);
 assert.deepEqual(m.heatWeights(data,'abertos'),[2,0,3,0]);
 assert.deepEqual(m.heatWeights(data,'vendas'),[1,0,1,0]);
 assert.deepEqual(m.heatWeights(data,'atividade'),[2,0,4,0]);
 const fc=m.heatCollection(data,m.heatWeights(data,'abertos'));
 assert.deepEqual(fc.features.map(f=>[f.id,f.properties.weight]),[[0,2],[2,3]],'sem os pesos zero');
});

test('funil: etapa mais avançada, perdido só quando tudo foi perdido, filtro de temperatura',()=>{
 const rows=m.funnelSpots(data);
 assert.deepEqual(rows.map(r=>[r.spot,c.STAGES[r.stage],m.FUNNEL_GROUPS[r.group].label]),[[0,'Ganho','Ganho'],[1,'Perdido','Perdido'],[2,'Ganho','Ganho']]);
 assert.deepEqual(rows.map(r=>[r.open,r.won,r.lost,r.hot]),[[2,1,0,2],[0,0,1,0],[3,1,0,0]]);
 const frio=m.funnelSpots(data,'Frio');
 assert.deepEqual(frio.map(r=>[r.spot,m.FUNNEL_GROUPS[r.group].label]),[[1,'Perdido'],[2,'Novo e Contato']]);
 const quente=m.funnelSpots(data,'Quente');
 assert.deepEqual(quente.map(r=>[r.spot,c.STAGES[r.stage]]),[[0,'Proposta'],[2,'Ganho']]);
 assert.deepEqual(m.funnelTotals(rows),{places:3,open:5,won:2,hot:2,byGroup:[0,0,0,2,1]});
 assert.deepEqual(m.funnelCollection(data,quente).features.map(f=>[f.id,f.properties.group,f.properties.size,f.properties.city]),[[0,2,2,false],[2,3,1,true]]);
});

test('linha do tempo: régua de meses, locais do mês em destaque e vendas acumuladas',()=>{
 assert.deepEqual(m.monthRange('2025-11','2026-02'),['2025-11','2025-12','2026-01','2026-02']);
 assert.deepEqual(m.timelineMonths(data,'2026-10'),['2026-07','2026-08','2026-09','2026-10']);
 assert.deepEqual(m.timelineMonths(data,'2026-10',2),['2026-09','2026-10']);
 assert.deepEqual(m.timelineMonths({...data,spots:[],deals:[]},'2026-10'),[]);
 const sep=m.timelineFrame(data,'2026-09');
 assert.deepEqual([sep.mapped,sep.newMapped,sep.sales,sep.newSales],[3,2,1,1]);
 assert.deepEqual(sep.spots.map(s=>[s.spot,s.fresh,s.paid]),[[0,false,true],[1,true,false],[3,true,false]],'a cidade ainda sem venda não aparece');
 const oct=m.timelineFrame(data,'2026-10');
 assert.deepEqual(oct.spots.map(s=>s.spot),[0,1,2,3]);assert.equal(oct.sales,2);
 assert.deepEqual(m.timelineFrame(data,'2026-06').spots,[]);
 assert.deepEqual(m.timelineSeries(data,['2026-07','2026-08','2026-09','2026-10']),{mapped:[1,0,2,0],sales:[0,0,1,1]});
});

test('cidade acesa: torre mais alta com mais pessoas e atendimentos, base de 14 m',()=>{
 assert.equal(m.towerHeight(0,0),40);assert.equal(m.towerHeight(3,2),180);assert.equal(m.towerHeight(100,100),480);
 const ring=m.squareRing(-44.31,-19.76,7);
 assert.equal(ring.length,5);assert.ok(Math.abs(meters(ring[0],ring[1])-14)<0.2);assert.ok(Math.abs(meters(ring[1],ring[2])-14)<0.2);
 const towers=m.towerCollection(data,m.openBySpot(data));
 assert.deepEqual(towers.features.map(f=>[f.id,f.properties.height]),[[0,m.towerHeight(3,2)],[1,40],[3,40]],'só locais, nunca o centro da cidade');
 assert.deepEqual([16,15,14.6,13,10,5].map(m.towerScale),[1,1,2,4,16,16]);
 const far=m.towerCollection(data,m.openBySpot(data),4);
 assert.equal(far.features[0].properties.height,m.towerHeight(3,2)*4);assert.ok(Math.abs(meters(far.features[0].geometry.coordinates[0][0],far.features[0].geometry.coordinates[0][1])-56)<0.5);
});

test('cores dos modos: escalas completas e faixas espalhadas',()=>{
 for(const dark of [true,false]){const p=m.modePalette(dark);assert.equal(p.sequential.length,5);assert.equal(p.stages.length,4);}
 assert.equal(m.modePalette(true).sequential[4],'#f3e3a3','no escuro, o muito é o dourado claro');
 assert.equal(m.modePalette(false).sequential[4],'#866915','no claro, o muito é o dourado escuro');
 assert.deepEqual(m.rampFor(3,['a','b','c','d','e']),['a','c','e']);assert.deepEqual(m.rampFor(1,['a','b']),['b']);
 const hexes=h.hexBins([{latitude:-19.76,longitude:-44.31},{latitude:-19.7601,longitude:-44.3101}],700).hexes;
 assert.deepEqual(m.hexCollection(hexes,[1,2]).features.map(f=>[f.properties.count,f.properties.bin]),[[2,1]]);
});

test('pinos desenhados: nome da imagem pelo tipo, ícone, situação e vários papéis',async()=>{
 const p=await vite.ssrLoadModule('/app/map-pins.ts');
 assert.equal(p.pinImageId({kind:'person',roles:['Pessoa','Embaixador'],status:'Ativo'}),'pin|person|Embaixador|AT|');
 assert.equal(p.pinImageId({kind:'person',roles:['Pessoa','Embaixador','Lead'],status:'Lead válido'}),'pin|person|Embaixador||+');
 assert.equal(p.pinImageId({kind:'person',roles:['Pessoa','Embaixador','Lead'],status:'Lead válido'},'Lead'),'pin|person|Lead||+','o filtro escolhe o ícone');
 assert.equal(p.pinImageId({kind:'business',roles:['Escritório'],status:'Selecionada'}),'pin|Escritório|Escritório||');
 assert.equal(p.pinImageId({kind:'business',roles:['Empresa','Saúde'],status:'Cliente'}),'pin|Empresa|Saúde|PG|');
 assert.equal(p.pinImageId({kind:'city',roles:['Cidade'],status:'Ativa'}),'pin|city|Cidade|AT|');
 const shapes=p.iconShapes('Cidade');assert.ok(shapes.length>=3);assert.ok(shapes.every(s=>s.tag==='path'&&s.attrs.d));
 assert.ok(p.iconShapes('Inexistente').length>0,'ícone padrão');
 assert.deepEqual([999,1000,1234,15890].map(p.countLabel),['999','1 mil','1,2 mil','15,8 mil']);
});
