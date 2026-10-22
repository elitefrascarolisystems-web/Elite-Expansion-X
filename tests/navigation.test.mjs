import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const nav=await vite.ssrLoadModule('/lib/navigation.ts');
const access=(role,extra={})=>({role,organizationId:1,isPlatformOwner:false,active:true,email:'x@y.z',name:'X',cityId:1,ambassadorId:null,id:1,organizationName:'Elite',canManageGlobal:false,canManageCity:false,canManagePipeline:false,canManageContent:false,...extra});
const shape=(a,opts={hasAdvisors:false})=>Object.fromEntries(nav.navigationFor(a,opts).map(x=>[x.id,x.views.map(v=>v.id)]));

test('navegação: cada função vê só as áreas dela',()=>{
 assert.deepEqual(shape(access('Administrador',{isPlatformOwner:true})),{
  hoje:[],territorio:['mapa','cidades','locais'],vendas:['agenda','atendimentos','ganchos','fecha','pagamentos','posvenda'],
  rede:['embaixadores','indicacoes','mentorados','parceiros','materiais'],resultados:['visao','metas','mapeamento','custos'],
  gestao:['time','regras','historico','privacidade'],plataforma:['assinaturas','pedidos','assessores'],
 });
 const client=shape(access('Administrador',{organizationId:7}),{hasAdvisors:true});
 assert.deepEqual(client.gestao,['time','regras','identidade','plano','historico','privacidade','assessoria'],'empresa assinante vê o plano e a assessoria');
 assert.equal(client.plataforma,undefined,'só os donos veem a plataforma');
 for(const role of ['Coordenação','Líder']){
  const s=shape(access(role));
  assert.deepEqual(Object.keys(s),['hoje','territorio','vendas','rede','resultados'],role);
  assert.ok(!s.rede.includes('mentorados'),'portal de mentorados é do administrador');
 }
 assert.deepEqual(shape(access('Comercial')),{hoje:[],territorio:['mapa','locais'],vendas:['agenda','atendimentos','ganchos','fecha','pagamentos','posvenda'],rede:['indicacoes'],resultados:['metas']});
});

test('navegação: área inicial e endereços inválidos',()=>{
 assert.deepEqual(nav.defaultLocation(access('Comercial')),{area:'vendas',view:'agenda'});
 assert.deepEqual(nav.defaultLocation(access('Coordenação')),{area:'territorio',view:'mapa'});
 assert.deepEqual(nav.defaultLocation(access('Líder')),{area:'hoje',view:''});
 const seller=access('Comercial'),areas=nav.navigationFor(seller,{hasAdvisors:false});
 assert.deepEqual(nav.resolveLocation(areas,seller,'gestao','time'),{area:'vendas',view:'agenda'},'área proibida volta ao início da função');
 assert.deepEqual(nav.resolveLocation(areas,seller,'territorio','cidades'),{area:'territorio',view:'mapa'},'sub-aba proibida vai para a primeira permitida');
 assert.deepEqual(nav.resolveLocation(areas,seller,'vendas','pagamentos'),{area:'vendas',view:'pagamentos'});
 assert.deepEqual(nav.parseTarget('vendas/agenda'),{area:'vendas',view:'agenda'});
});
