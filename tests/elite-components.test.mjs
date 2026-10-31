import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const f=await vite.ssrLoadModule('/lib/figures.ts');
const c=await vite.ssrLoadModule('/lib/commands.ts');
const h=React.createElement;

test('minigráfico: pontos dentro da caixa, série plana no meio, menos de 2 pontos não desenha',()=>{
 const s=f.sparkline([1,3,2,5],100,40);
 const pts=s.line.split(' ').map(p=>p.split(',').map(Number));
 assert.equal(pts.length,4);
 assert.ok(pts.every(([x,y])=>x>=0&&x<=100&&y>=0&&y<=40));
 assert.deepEqual(s.last,{x:pts[3][0],y:pts[3][1]});
 assert.ok(pts[3][1]<pts[0][1],'o maior valor fica mais alto (y menor)');
 assert.ok(f.sparkline([4,4,4],100,40).line.split(' ').every(p=>p.endsWith(',20')));
 assert.equal(f.sparkline([7],100,40),null);
});

test('medidor: porcentagem entre 0 e 100, sem total vale 0',()=>{
 assert.equal(f.percentOf(6,7).toFixed(1),'85.7');
 assert.equal(f.percentOf(9,7),100);
 assert.equal(f.percentOf(-2,7),0);
 assert.equal(f.percentOf(3,0),0);
});

test('número que conta: mantém prefixo, sufixo, milhar e casas decimais',()=>{
 assert.equal(f.figureAt('R$ 4.500',0.5),'R$ 2.250');
 assert.equal(f.figureAt('R$ 4.500',0),'R$ 0');
 assert.equal(f.figureAt('19%',0.5),'10%');
 assert.equal(f.figureAt('R$ 1,75',0.5),'R$ 0,88');
 assert.equal(f.figureAt('1/8',0),'0/8');
 assert.equal(f.figureAt('64186%',0.5),'32093%');
 assert.equal(f.figureAt('R$ 4.500',1),'R$ 4.500');
 assert.equal(f.figureAt('Sem dados',0.3),'Sem dados');
});

test('linha do tempo: agrupa por dia de Brasília, do mais novo para o mais antigo',()=>{
 const now=Date.parse('2026-10-22T15:00:00-03:00');
 const groups=f.groupByDay([
  {at:'2026-10-20T10:00:00-03:00',id:'a'},{at:'2026-10-22T09:00:00-03:00',id:'b'},
  {at:'2026-10-21T23:30:00-03:00',id:'c'},{at:'2026-10-22T01:30:00Z',id:'d'},{at:'inválido',id:'e'},
 ],now);
 assert.deepEqual(groups.map(g=>[g.label,g.items.map(i=>i.id)]),[['Hoje',['b']],['Ontem',['c','d']],['20/10/2026',['a']]]);
});

test('mês curto do período',()=>{
 assert.equal(f.monthLabel('2026-10'),'out/26');
 assert.equal(f.monthLabel('2026-01-15'),'jan/26');
});

const areas=[
 {id:'hoje',label:'Hoje',description:'O que fazer agora',views:[]},
 {id:'vendas',label:'Vendas',description:'Do primeiro contato ao pagamento',views:[{id:'agenda',label:'Agenda'},{id:'atendimentos',label:'Atendimentos'},{id:'fecha',label:'Método F.E.C.H.A.'}]},
 {id:'gestao',label:'Gestão',description:'Equipe e regras',views:[{id:'time',label:'Time e acessos'}]},
];

test('central de comandos: sem texto, as outras abas da área atual',()=>{
 const r=c.goCommands('',areas,{area:'vendas',view:'agenda'});
 assert.deepEqual(r.map(x=>[x.group,x.title]),[['Nesta área','Atendimentos'],['Nesta área','Método F.E.C.H.A.']]);
});

test('central de comandos: busca sem acento, em qualquer ordem, sem a tela atual nem telas de fora do menu',()=>{
 assert.deepEqual(c.goCommands('metodo',areas,{area:'hoje',view:''}).map(x=>x.title),['Vendas → Método F.E.C.H.A.']);
 assert.deepEqual(c.goCommands('acessos time',areas,{area:'hoje',view:''}).map(x=>x.location),[{area:'gestao',view:'time'}]);
 assert.deepEqual(c.goCommands('agenda',areas,{area:'vendas',view:'agenda'}),[]);
 assert.deepEqual(c.goCommands('assinaturas',areas,{area:'hoje',view:''}),[]);
 assert.deepEqual(c.goCommands('hoje',areas,{area:'vendas',view:'agenda'}).map(x=>x.location),[{area:'hoje',view:''}]);
});

test('componentes: medidor e minigráfico com leitura para leitor de tela; linha do tempo com hora',async()=>{
 const {Meter}=await vite.ssrLoadModule('/components/elite/meter.tsx');
 const ring=renderToStaticMarkup(h(Meter,{value:6,max:7,label:'Primeiros passos concluídos',valueText:'6/7'}));
 assert.match(ring,/role="meter"/);assert.match(ring,/aria-valuenow="6"/);assert.match(ring,/aria-valuetext="6\/7"/);assert.match(ring,/>6\/7</);
 const bar=renderToStaticMarkup(h(Meter,{variant:'bar',value:12,max:10,label:'Usuários'}));
 assert.match(bar,/width:100%/);assert.match(bar,/aria-valuenow="10"/);
 const {StatTile}=await vite.ssrLoadModule('/components/elite/stat-tile.tsx');
 const {Users}=await import('lucide-react');
 const tile=renderToStaticMarkup(h(StatTile,{label:'Leads válidos',value:'21',helper:'teste',icon:Users,series:{values:[2,5,9],label:'Leads válidos por mês: ago/26 2, set/26 5, out/26 9.'}}));
 assert.match(tile,/role="img"/);assert.match(tile,/aria-label="Leads válidos por mês: ago\/26 2, set\/26 5, out\/26 9\."/);
 assert.match(tile,/>21</,'o número vem pronto do servidor (a contagem só roda depois)');
 const empty=renderToStaticMarkup(h(StatTile,{label:'CAC',value:'Sem dados suficientes',helper:'Custo por cliente',icon:Users,series:{values:[1,2],label:'x'}}));
 assert.doesNotMatch(empty,/role="img"/,'sem dado, sem minigráfico');
 const {Timeline}=await vite.ssrLoadModule('/components/elite/timeline.tsx');
 const tl=renderToStaticMarkup(h(Timeline,{now:Date.parse('2026-10-22T15:00:00-03:00'),items:[{id:'1',at:'2026-10-22T09:05:00-03:00',title:'Cidade criada'}]}));
 assert.match(tl,/Hoje/);assert.match(tl,/09:05/);assert.match(tl,/Cidade criada/);
});

test('guia "Como usar": cartão, botão e miolo da gaveta renderizados, sem pedido ao servidor',async()=>{
 const g=await vite.ssrLoadModule('/components/elite/tab-guide.tsx');
 const guide={key:'vendas/agenda',titulo:'Como usar: Agenda',paraQueServe:'Saber com quem falar hoje.',passos:['Comece por "Atrasados".','Toque em "Abrir ficha".','Toque em "Registrar retorno".'],exemplo:'Carla estava atrasada desde segunda.',cuidado:'Fale só com quem autorizou o contato.'};
 const realFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('sem servidor');};
 try{
  const button=renderToStaticMarkup(h(g.GuideButton,{onClick(){}}));
  assert.match(button,/aria-label="Como usar esta aba"/);assert.match(button,/Como usar<\/span>/);
  const clean=(html)=>html.replaceAll('<!-- -->','');
  const card=clean(renderToStaticMarkup(h(g.TabGuideCard,{guide,action:{label:'Novo atendimento',run(){}},onOpen(){},onDone(){}})));
  assert.match(card,/aria-label="Como usar: Agenda"/);assert.match(card,/Saber com quem falar hoje\. 1º passo: Comece por/);
  for(const label of ['Ver como usar','Fazer agora','Entendi'])assert.match(card,new RegExp(`>${label}<`),label);
  assert.doesNotMatch(renderToStaticMarkup(h(g.TabGuideCard,{guide,onOpen(){},onDone(){}})),/Fazer agora/,'sem ação, sem "Fazer agora"');
  const body=clean(renderToStaticMarkup(h(g.TabGuideBody,{guide,action:{label:'Novo atendimento',disabled:'sem cidade',run(){}},onClose(){},onResetAll(){}})));
  assert.equal((body.match(/<li /g)??[]).length,3,'3 passos');
  assert.match(body,/class="elite-guide-badge">Exemplo</);assert.match(body,/Carla estava atrasada/);
  assert.match(body,/Cuidado:<\/strong> Fale só com quem autorizou/);
  assert.match(body,/disabled="" title="sem cidade"[^>]*>Fazer agora: Novo atendimento</,'indisponível com o mesmo motivo do + Novo');
  assert.match(body,/>Fechar</);assert.match(body,/>Mostrar os guias de novo</);
  const chip=renderToStaticMarkup(h(g.TabGuideChip,{label:'Como usar o mapa',onOpen(){},onDone(){}}));
  assert.match(chip,/Como usar o mapa/);assert.match(chip,/aria-label="Fechar o aviso do guia"/);
  assert.equal(calls,0,'nenhum pedido ao servidor');
 }finally{globalThis.fetch=realFetch;}
});

test('Ctrl+K: "retorno" acha "Ajuda: Agenda" com o texto dos guias',async()=>{
 const nav=await vite.ssrLoadModule('/lib/navigation.ts');const keys=await vite.ssrLoadModule('/lib/tab-guide-keys.ts');const guides=await vite.ssrLoadModule('/lib/tab-guides.ts');
 const access={role:'Comercial',organizationId:1,isPlatformOwner:false,active:true,email:'x@y.z',name:'X',cityId:1,ambassadorId:null,id:1,organizationName:'Empresa Teste',canManageGlobal:false,canManageCity:false,canManagePipeline:false,canManageContent:false};
 const areas=nav.navigationFor(access,{hasAdvisors:false});
 const text=(location)=>{const key=keys.guideKeyFor(location);return key?guides.guideSearchText(guides.resolveGuide(key,'Comercial','Empresa Teste')):null;};
 assert.ok(c.helpCommands('retorno',areas,{area:'hoje',view:''},text).some((x)=>x.title==='Ajuda: Agenda'));
 assert.ok(c.helpCommands('retorno',areas,{area:'hoje',view:''},text).every((x)=>areas.some((a)=>a.id===x.location.area)),'só telas da função');
});
