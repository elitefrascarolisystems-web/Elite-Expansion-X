import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false},logLevel:'silent'});
after(async()=>{await vite.close();});
const g=await vite.ssrLoadModule('/lib/goal-calculator.ts');

// Cidade Exemplo do prompt: hoje 02/11/2026, meta 40 vendas pagas até 28/12/2026.
const ex=(over={})=>({today:'2026-11-02',target:'2026-12-28',metric:'Vendas pagas',goal:40,paid:4,paidRevenue:4800,ticket:1200,v:3,c:0.2,m:14,N:15,Nmap:8,Nind:3,Nmid:0,Nout:4,Pm:32,nm:2,a:0.25,nv:2,kv:10,C:60,r:3/60,cpl:null,organicGoal:0,...over});
const json=(x)=>JSON.stringify(x);

test('exemplo: quanto falta e no ritmo atual',()=>{
 const b=ex();const n=g.goalNumbers(b);
 assert.deepEqual([n.M,n.F,n.P,n.D,n.missingRevenue],[40,36,4,56,43200]);
 const now=g.projectAtCurrentPace(b);
 assert.equal(now.kind,'date');assert.equal(now.days,84);assert.equal(now.date,'2027-01-25');assert.equal(now.diff,28);
 assert.deepEqual(now.range,[70,105]);assert.deepEqual(now.rangeDates,['2027-01-11','2027-02-15']);
 // Meta em receita: R$ 48.000 com ticket de R$ 1.200 = 40 vendas.
 const r=g.goalNumbers(ex({metric:'Receita confirmada',goal:48000,paidRevenue:4800}));
 assert.deepEqual([r.M,r.F,r.P,r.missingRevenue],[40,36,4,43200]);
});

test('exemplo: o que precisa acontecer',()=>{
 const f=g.reverseFunnel(ex());
 assert.equal(f.status,'precisa');
 assert.equal(f.E,6);assert.equal(g.addDays('2026-11-02',14),'2026-11-16');
 assert.equal(f.R,30);assert.equal(f.U,6);assert.equal(f.vn,5);
 assert.equal(f.Nn,25);assert.equal(f.leadsDelta,10);assert.equal(f.totalLeads,150);assert.equal(f.startBy,'2026-12-14');
 assert.equal(f.mappingNeeded,18);assert.equal(f.peoplePerWeek,72);assert.equal(f.peopleTotal,432);assert.equal(f.mappers,5);
 assert.equal(f.sellers,3);assert.equal(f.bottleneck,'atendimentos e vendedores');
});

test('exemplo: o que mais ajuda, menor combinação, bônus e resumo',()=>{
 const rank=g.rankAdjustments(ex());
 assert.deepEqual(rank.steps.map((s)=>[s.id,s.arrival.days,s.noGain??'']),[['conversao',70,''],['mapeador',70,''],['indicacoes',78,''],['vendedor',84,'falta atendimento']]);
 assert.equal(rank.steps[0].arrival.date,'2027-01-11');assert.equal(rank.steps[2].arrival.date,'2027-01-19');
 assert.ok(!rank.steps.some((s)=>s.id==='midia'),'mídia desligada sem custo por atendimento');
 const combo=g.smallestTeamCombo(ex());
 assert.equal(combo.status,'ok');assert.deepEqual([combo.extraMappers,combo.extraSellers,combo.arrival.days,combo.arrival.date],[3,1,53,'2026-12-25']);
 for(const [dm,dv,days] of [[2,1,60],[2,2,60],[3,0,67],[4,0,67]])assert.equal(g.projectWithLevers(ex(),{mappers:2+dm,sellers:2+dv}).days,days,`+${dm}/+${dv}`);
 assert.equal(g.r6(g.perMonth(3/60)),0.214286);
 const bonus=g.networkBonus(ex());assert.equal(g.r6(bonus),4.5);assert.equal(g.floor6(bonus),4);
 assert.equal(g.summaryText(ex(),'Cidade Exemplo'),'Meta (Cidade Exemplo): 40 vendas pagas até 28/12. Feitas: 4. Faltam 36. No ritmo atual chegamos em 25/01. Para chegar no prazo: 25 atendimentos novos por semana até 14/12 (hoje 15), por exemplo com +3 mapeadores e +1 vendedor.');
});

test('coerência: sem ajuste, "Com ajustes" é igual a "Hoje" (inclusive a faixa) e sem aviso de divergência',()=>{
 const b=ex();
 assert.deepEqual(json(g.projectWithLevers(b,{})),json(g.projectAtCurrentPace(b)));
 assert.deepEqual(g.projectWithLevers(b,{mappers:2,sellers:2,conversion:0.2}).range,[70,105]);
 // Com uma alavanca que não muda nada de fato (vendedor a mais com falta de atendimento), a faixa é a mesma de hoje.
 assert.deepEqual(g.projectWithLevers(b,{sellers:3}).range,[70,105]);
 assert.equal(g.divergence(b),false);
});

test('bordas: meta batida, ritmo zero, andamento basta, prazo curto e dados faltando',()=>{
 assert.equal(g.goalNumbers(ex({paid:40})).reached,true);
 assert.equal(g.reverseFunnel(ex({paid:41})).status,'batida');
 const rev=g.goalNumbers(ex({metric:'Receita confirmada',goal:48000,paidRevenue:50400}));
 assert.deepEqual([rev.F,rev.P,rev.reached],[0,40,true],'receita acima da meta');
 assert.equal(g.projectAtCurrentPace(ex({v:0})).kind,'never');
 assert.equal(g.projectAtCurrentPace(ex({v:null})).kind,'nodata');
 assert.equal(g.projectWithLevers(ex({v:null}),{}).kind,'nodata','ritmo sem dados: "Com ajustes" sem ajuste também sem dados');
 const inc=g.projectWithLevers(ex({v:null,N:null}),{conversion:0.3});
 assert.ok(inc.kind==='date'&&inc.increaseOnly,'com ajuste e sem ritmo: conta só o acréscimo');
 // v′ = 0: com conversão zerada, o que está em andamento não basta e nada novo vende.
 assert.equal(g.projectWithLevers(ex(),{conversion:0}).kind,'never');
 assert.equal(g.reverseFunnel(ex({goal:10})).status,'andamento-basta');
 assert.equal(g.reverseFunnel(ex({target:'2026-11-12',goal:40})).status,'estenda');
 assert.equal(g.networkBonus(ex({target:'2026-11-12'})),null,'sem bônus negativo');
 // Tempo até pagar sem dados: só "No ritmo atual".
 const noM=ex({m:null});
 assert.equal(g.projectAtCurrentPace(noM).days,84);
 assert.equal(g.reverseFunnel(noM).status,'sem-tempo-ate-pagar');assert.deepEqual(g.rankAdjustments(noM).steps,[]);
 assert.equal(g.smallestTeamCombo(noM).status,'sem-dados');
 // Meta que já chega no ritmo de hoje.
 const keep=ex({goal:20});
 assert.equal(g.reverseFunnel(keep).status,'mantenha');assert.equal(g.smallestTeamCombo(keep).status,'basta');
 assert.match(g.summaryText(keep,'Cidade Exemplo'),/No ritmo atual chegamos em \d\d\/\d\d, \d+ dias antes do prazo\.$/);
 // Nem com +10 mapeadores e +5 vendedores.
 assert.equal(g.smallestTeamCombo(ex({goal:400})).status,'nenhuma');
});

test('bordas: modo absoluto, mapeamento sem base, rede e mídia',()=>{
 // N = 0 (ou sem dados): Nn = N + (vn − v) ÷ c, mostrado como acréscimo.
 const abs=g.reverseFunnel(ex({N:0,Nmap:0,Nind:0,Nout:0}));
 assert.equal(abs.absolute,true);assert.equal(abs.Nn,10);
 const noC=g.reverseFunnel(ex({N:null,c:null}));assert.equal(noC.status,'sem-conversao');
 assert.equal(g.rankAdjustments(ex({N:null,c:null})).needs,'conversao');
 assert.deepEqual(json(g.projectWithLevers(ex({N:0}),{})),json(g.projectAtCurrentPace(ex({N:0}))),'absoluto sem ajuste = hoje');
 // Nmap = 0: mapeadores pelo modo absoluto; tirar um mapeador não muda a data.
 const nomap=ex({Nmap:0,N:7});
 const f=g.reverseFunnel(nomap);assert.ok(f.peoplePerWeek>32);assert.ok(f.mappers>=2);
 assert.equal(g.projectWithLevers(nomap,{mappers:1}).days,g.projectAtCurrentPace(nomap).days);
 // Pm sem dados e sem a: alavanca de mapeadores desligada.
 assert.equal(g.leversAvailable(ex({Nmap:0,a:null})).mappers,false);
 // r sem dados: indicações desligadas, o resto funciona.
 const nor=g.rankAdjustments(ex({r:null}));assert.ok(!nor.steps.some((s)=>s.id==='indicacoes'));assert.equal(nor.steps[0].id,'conversao');
 assert.equal(g.networkBonus(ex({r:null})),null);
 // Conversão sem dados: só a alavanca de conversão espera.
 const noc=g.rankAdjustments(ex({c:null}));assert.ok(!noc.steps.some((s)=>s.id==='conversao'));assert.ok(noc.steps.some((s)=>s.id==='mapeador'&&s.arrival.days===70));
 // Mídia com custo por atendimento: aparece; aviso orgânico só com critério > 0 e verba simulada.
 const med=ex({cpl:50,organicGoal:90});
 assert.ok(g.rankAdjustments(med).steps.some((s)=>s.id==='midia'));
 assert.equal(g.leverFlow(med,{mediaPerMonth:5000}).organicWarning,true);
 assert.equal(g.leverFlow(med,{}).organicWarning,false);
 assert.equal(g.leverFlow(ex({cpl:50}),{mediaPerMonth:5000}).organicWarning,false,'sem critério, sem aviso');
});

test('capacidade editada abaixo da oferta (kv = 5)',()=>{
 const b=ex({kv:5});
 const f=g.reverseFunnel(b);assert.equal(f.sellers,4);assert.equal(f.bottleneck,'atendimentos e vendedores juntos');
 const combo=g.smallestTeamCombo(b);assert.deepEqual([combo.extraMappers,combo.extraSellers,combo.arrival.days],[3,2,56]);
 const rank=g.rankAdjustments(b).steps;
 assert.deepEqual(rank.filter((s)=>!s.noGain).map((s)=>s.id),['conversao'],'só a conversão ganha dias sozinha');
 assert.equal(rank.find((s)=>s.id==='mapeador').noGain,'falta vendedor');
});

test('divergência, ritmo zero no ranking, receita no gráfico, datas distantes, sem NaN',()=>{
 assert.equal(g.divergence(ex({v:5})),true);
 assert.equal(g.divergence(ex({c:0.26})),false,'exatamente 30%: sem aviso por sobra de conta');
 const zero=g.rankAdjustments(ex({v:0}));
 assert.ok(zero.steps.length>0&&zero.steps.every((s)=>s.wasNever||s.noGain));
 const rev=ex({metric:'Receita confirmada',goal:48000,paidRevenue:4500});
 assert.equal(g.goalNumbers(rev).P,3);assert.equal(g.paceProjection(rev,null,10)[0].value,3);
 const far=g.projectAtCurrentPace(ex({v:0.01}));assert.ok(far.kind==='date'&&far.days>g.MAX_DAYS&&far.range[1]===null);
 const values=[];
 for(const v of [null,0,0.001,3])for(const N of [null,0,15])for(const c of [null,0,0.2])for(const m of [null,0,14,60])for(const kv of [null,5,10]){
  const b=ex({v,N,c,m,kv});
  values.push(g.goalNumbers(b),g.projectAtCurrentPace(b),g.reverseFunnel(b),g.projectWithLevers(b,{mappers:3,sellers:3,conversion:0.3}),g.rankAdjustments(b),g.smallestTeamCombo(b),g.networkBonus(b),g.summaryText(b,'X'));
 }
 const text=JSON.stringify(values,(k,x)=>typeof x==='number'&&!Number.isFinite(x)?'INVALIDO':x);
 assert.ok(!/NaN|INVALIDO|null\.|undefined/.test(text.replace(/"(kind|status)":"[a-z-]+"/g,'')),'sem NaN nem Infinity');
});
