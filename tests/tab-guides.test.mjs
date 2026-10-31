import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const keys=await vite.ssrLoadModule('/lib/tab-guide-keys.ts');
const guides=await vite.ssrLoadModule('/lib/tab-guides.ts');
const nav=await vite.ssrLoadModule('/lib/navigation.ts');
const commands=await vite.ssrLoadModule('/lib/commands.ts');

const TEAM=['Administrador','Coordenação','Líder','Comercial'];
const access=(role,extra={})=>({role,organizationId:1,isPlatformOwner:false,active:true,email:'x@y.z',name:'X',cityId:1,ambassadorId:null,id:1,organizationName:'Empresa Teste',canManageGlobal:false,canManageCity:false,canManagePipeline:false,canManageContent:false,...extra});
// Todas as combinações que mudam as abas: dona da plataforma, empresa assinante e assessoria.
const CONFIGS=[[{},false],[{isPlatformOwner:true},false],[{organizationId:7},false],[{organizationId:7},true]];
const LIMIT=guides.GUIDE_LIMITS;
const words=(text)=>text.split(/\s+/).filter(Boolean).length;
const sentences=(text)=>text.split(/[.!?](?:\s|$)/).filter((part)=>part.trim()).length;

/** Telas que cada função vê, em qualquer configuração (Embaixador e Mentorado entram pelos portais). */
function visible(){
 const seen=new Map();
 for(const role of TEAM)for(const [extra,hasAdvisors] of CONFIGS)for(const area of nav.navigationFor(access(role,extra),{hasAdvisors})){
  for(const view of area.views.length?area.views:[{id:''}]){
   const key=keys.guideKeyFor({area:area.id,view:view.id});
   assert.ok(key,`${role}: ${area.id}/${view.id} sem chave de guia`);
   if(!seen.has(key))seen.set(key,new Set());
   seen.get(key).add(role);
  }
 }
 seen.set('portal:embaixador',new Set(['Embaixador']));
 seen.set('portal:mentorado',new Set(['Mentorado']));
 return seen;
}

test('guias: 32 chaves, uma por tela e uma por portal, cada uma com o seu guia',()=>{
 assert.equal(keys.GUIDE_KEYS.length,32);
 assert.deepEqual(Object.keys(guides.TAB_GUIDES).sort(),[...keys.GUIDE_KEYS].sort());
 const seen=visible();
 assert.deepEqual([...seen.keys()].sort(),[...keys.GUIDE_KEYS].sort(),'toda chave é uma tela que alguém vê');
});

test('guias: cada função tem o guia de cada tela que vê, e só delas',()=>{
 for(const [key,roles] of visible()){
  const guide=guides.TAB_GUIDES[key];
  assert.deepEqual([...guide.funcoes].sort(),[...roles].sort(),`${key}: funções do guia`);
  for(const role of Object.keys(guide.porFuncao??{}))assert.ok(guide.funcoes.includes(role),`${key}: variação para ${role}, que não vê a tela`);
 }
});

test('guias: tamanhos, 3 passos, exemplo fictício e cuidado curto, como cada função lê',()=>{
 for(const key of keys.GUIDE_KEYS){
  const guide=guides.TAB_GUIDES[key];
  for(const role of guide.funcoes){
   const g=guides.resolveGuide(key,role,'Empresa Teste');
   const where=`${key} (${role})`;
   assert.match(g.titulo,/^Como usar: /,where);
   assert.ok(g.titulo.length<=LIMIT.titulo,`${where}: título com ${g.titulo.length}`);
   assert.ok(g.paraQueServe.length<=LIMIT.paraQueServe,`${where}: para que serve com ${g.paraQueServe.length}`);
   assert.equal(g.passos.length,3,where);
   for(const step of g.passos)assert.ok(step.length<=LIMIT.passo,`${where}: passo com ${step.length}: ${step}`);
   assert.ok(g.exemplo.length<=LIMIT.exemplo,`${where}: exemplo com ${g.exemplo.length}`);
   if(g.cuidado){assert.ok(g.cuidado.length<=LIMIT.cuidado,`${where}: cuidado com ${g.cuidado.length}`);assert.ok(sentences(g.cuidado)<=2,`${where}: cuidado com mais de 2 frases`);}
   const total=words([g.paraQueServe,...g.passos,g.exemplo,g.cuidado??''].join(' '));
   assert.ok(total<=LIMIT.palavras,`${where}: ${total} palavras`);
   const all=[g.titulo,g.paraQueServe,...g.passos,g.exemplo,g.cuidado??''].join(' ');
   assert.ok(!all.includes('{empresa}'),`${where}: {empresa} sem trocar`);
   // Textos sempre fictícios: sem e-mail, telefone, a Elite ou a cidade piloto.
   assert.ok(!/@|\d{4,5}[-\s]?\d{4}/.test(all),`${where}: texto com e-mail ou telefone`);
   // Cartão da 1ª visita em até 3 linhas a 390 px, mesmo com um nome de empresa longo.
   const long=guides.resolveGuide(key,role,'Empresa Com Nome Bem Longo');
   const card=`${long.paraQueServe} 1º passo: ${long.passos[0]}`;
   assert.ok(card.length<=LIMIT.cartao,`${where}: cartão com ${card.length} caracteres`);
   assert.ok(!/esmeraldas/i.test(all),`${where}: cita a cidade piloto`);
   if(!key.startsWith('plataforma/'))assert.ok(!/elite/i.test(all.replaceAll('Assessoria Elite','')),`${where}: cita a Elite numa tela que a empresa assinante vê`);
  }
 }
});

test('guias: "Fazer agora" só com ação que a função pode fazer (mesma regra do + Novo)',async()=>{
 const perm=await vite.ssrLoadModule('/lib/expansion-permissions.ts');
 const source=readFileSync(root+'app/expansion-dashboard.tsx','utf8');
 const block=source.slice(source.indexOf('const actions: NewAction[] = ['),source.indexOf('// "Fazer agora" do guia'));
 const can=(action)=>(a)=>perm.canPerform(a,action);
 const map=(a)=>['Administrador','Coordenação','Líder','Comercial'].includes(a.role);
 // Mesmas condições do + Novo em app/expansion-dashboard.tsx.
 const NOVO={mapear:map,'atendimento-mapa':map,'atendimento-novo':can('create_lead'),venda:can('record_sale'),cidade:can('create_city'),embaixador:can('create_ambassador'),parceiro:can('create_partner'),evento:can('create_partner'),material:can('create_content'),tarefa:can('create_task'),custo:can('create_cost'),convidar:(a)=>a.role==='Administrador'};
 assert.deepEqual([...block.matchAll(/id: "([a-z-]+)"/g)].map((m)=>m[1]).sort(),Object.keys(NOVO).sort(),'a lista do + Novo mudou: atualize este teste');
 const PORTAL={'portal:embaixador':['portal:atendimento','portal:atividade'],'portal:mentorado':['portal:indicar']};
 for(const key of keys.GUIDE_KEYS){
  for(const role of guides.TAB_GUIDES[key].funcoes){
   const action=guides.resolveGuide(key,role,'Empresa Teste').acao;
   if(!action)continue;
   const where=`${key} (${role}): ${action}`;
   if(key.startsWith('portal:')){assert.ok(PORTAL[key].includes(action),where);continue;}
   const a=access(role,key.startsWith('plataforma/')?{isPlatformOwner:true}:key==='gestao/assessoria'?{organizationId:7}:{});
   if(action==='mapear'||action.startsWith('novo:')){const id=action==='mapear'?'mapear':action.slice(5);assert.ok(NOVO[id]?.(a),where);}
   else if(action.startsWith('aba:')){const [area,view]=action.slice(4).split('/');assert.ok(nav.navigationFor(a,{hasAdvisors:true}).some((x)=>x.id===area&&(x.views.length?x.views.some((v)=>v.id===view):!view)),where);}
   else assert.fail(where);
  }
 }
});

// Seções com o mesmo nome de uma aba: o painel "Avisos por e-mail" de Hoje (preferências da
// própria pessoa) não é a aba Gestão → Avisos por e-mail.
const SECTIONS={'Avisos por e-mail':['hoje/']};

test('guias: nenhum guia cita aba que a função não tem',()=>{
 // Todas as abas e áreas, com o rótulo da tela; cada função só pode citar as que vê.
 const all=new Map();
 for(const role of TEAM)for(const [extra,hasAdvisors] of CONFIGS)for(const area of nav.navigationFor(access(role,extra),{hasAdvisors})){all.set(area.label,area.id);for(const view of area.views)all.set(view.label,`${area.id}/${view.id}`);}
 for(const role of TEAM){
  const seen=new Set();
  for(const [extra,hasAdvisors] of CONFIGS)if(!extra.isPlatformOwner||role==='Administrador')for(const area of nav.navigationFor(access(role,extra),{hasAdvisors})){seen.add(area.id);for(const view of area.views)seen.add(`${area.id}/${view.id}`);}
  const hidden=[...all].filter(([,id])=>!seen.has(id)).map(([label])=>label);
  for(const key of keys.GUIDE_KEYS){
   if(!guides.TAB_GUIDES[key].funcoes.includes(role))continue;
   const g=guides.resolveGuide(key,role,'Empresa Teste');
   const text=[g.paraQueServe,...g.passos,g.exemplo,g.cuidado??''].join(' ');
   for(const label of hidden){
    if(SECTIONS[label]?.includes(key))continue;
    const cited=text.includes(`"${label}"`)||text.includes(`→ ${label}`)||text.includes(`${label} →`)||text.includes(`aba ${label}`);
    assert.ok(!cited,`${key} (${role}) cita "${label}", que a função não vê`);
   }
  }
 }
});

test('guias: chave da tela, lista do "já vi" e nome da empresa',()=>{
 assert.equal(keys.guideKeyFor({area:'hoje',view:''}),'hoje/');
 assert.equal(keys.guideKeyFor({area:'vendas',view:'agenda'}),'vendas/agenda');
 assert.equal(keys.guideKeyFor({area:'vendas',view:'nada'}),null);
 assert.deepEqual(keys.parseGuidesSeen('hoje/,x/y,hoje/, vendas/agenda,'),['hoje/','vendas/agenda']);
 assert.deepEqual(keys.parseGuidesSeen(null),[]);assert.deepEqual(keys.parseGuidesSeen(''),[]);
 assert.equal(keys.isGuideKey("hoje/' OR 1=1"),false);
 assert.equal(keys.guidesStorageKey(7,3),'elite-guides-seen:7:3');
 const withCompany=keys.GUIDE_KEYS.find((key)=>JSON.stringify(guides.TAB_GUIDES[key]).includes('{empresa}'));
 if(withCompany){const g=guides.TAB_GUIDES[withCompany];const text=JSON.stringify(guides.resolveGuide(withCompany,g.funcoes[0],'Loja Modelo'));assert.ok(text.includes('Loja Modelo')&&!text.includes('{empresa}'));}
});

test('Ctrl+K: "retorno" acha "Ajuda: Agenda"; busca vazia traz a ajuda da tela atual',()=>{
 for(const role of TEAM){
  const areas=nav.navigationFor(access(role),{hasAdvisors:false});
  const text=(location)=>{const key=keys.guideKeyFor(location);if(!key||!guides.TAB_GUIDES[key].funcoes.includes(role))return null;return guides.guideSearchText(guides.resolveGuide(key,role,'Empresa Teste'));};
  const hits=commands.helpCommands('retorno',areas,{area:'hoje',view:''},text);
  assert.ok(hits.some((hit)=>hit.title==='Ajuda: Agenda'),`${role}: ${hits.map((h)=>h.title)}`);
  assert.ok(hits.every((hit)=>hit.group==='Ajuda'&&hit.detail.startsWith('Como usar')));
  assert.deepEqual(commands.helpCommands('',areas,{area:'vendas',view:'agenda'},text).map((hit)=>hit.title),['Ajuda: Agenda']);
  assert.deepEqual(commands.helpCommands('',areas,{area:'hoje',view:''},text).map((hit)=>[hit.title,hit.detail]),[['Ajuda: Hoje','Como usar']]);
 }
});
