import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:[{find:'@',replacement:root}]},server:{middlewareMode:true,hmr:false}});
after(async()=>{await vite.close();});
const v=await vite.ssrLoadModule('/lib/expansion-validation.ts');
const m=await vite.ssrLoadModule('/lib/validation-message.ts');
const message=(name,payload)=>{const r=v.actionSchemas[name].safeParse(payload);return r.success?'ok':m.validationMessage(r.error);};
// O que o formulário "Novo atendimento" manda quando o campo não aparece na tela: FormData.get devolve null.
const lead={cityId:1,ambassadorId:2,partnerId:null,eventId:null,contentId:null,name:'Ana Souza',email:'',whatsapp:'31999990000',status:'Lead informado',channel:'Embaixador',sourceLabel:'',campaign:'',utmSource:'',utmMedium:'',utmCampaign:'',consentAccepted:true,consentSource:'WhatsApp',consentPurpose:'Contato comercial',assignedToEmail:null};

test('formulários: campo que a função não vê chega vazio e não trava o envio',()=>{
 assert.equal(message('create_lead',lead),'ok','embaixador registra atendimento sem o campo Responsável comercial');
 assert.equal(v.actionSchemas.create_lead.parse(lead).assignedToEmail,'');
 assert.equal(message('update_lead',{leadId:1,status:'Lead válido',assignedToEmail:'a@b.com',consentRevoked:false,consentRevocationReason:null}),'ok','mudar a etapa sem revogar a autorização');
 assert.equal(message('update_lead',{leadId:1,status:'Lead válido',assignedToEmail:null,consentRevoked:true,consentRevocationReason:null}),'Informe o motivo da revogação.');
});

test('formulários: a mensagem de erro diz qual campo corrigir',()=>{
 assert.equal(message('create_lead',{...lead,whatsapp:'9'.repeat(31)}),'WhatsApp: use no máximo 30 caracteres.');
 assert.equal(message('create_lead',{...lead,email:'nao-e-email'}),'Informe um e-mail válido.','a mensagem já diz o campo');
 assert.equal(message('create_lead',{...lead,assignedToEmail:'x'}),'Responsável comercial: informe um e-mail válido.');
 const amb=message('create_ambassador',{cityId:1,name:'Ana',code:'ANA SOUZA',email:'',whatsapp:'',level:'Indicador',status:'Candidato'});
 assert.match(amb,/^Código único: use letras, números, hífen ou sublinhado/);
});

test('responsável padrão: quem usa; pela Assessoria Elite, alguém da equipe da empresa',async()=>{
 const o=await vite.ssrLoadModule('/lib/owners.ts');
 const users=[{id:1,email:'coord@x.invalid',name:'Coord',role:'Coordenação',active:true,cityId:7},{id:2,email:'dona@x.invalid',name:'Dona',role:'Administrador',active:true,cityId:null},{id:3,email:'saiu@x.invalid',name:'Saiu',role:'Administrador',active:false,cityId:null},{id:4,email:'mentorada@x.invalid',name:'M',role:'Mentorado',active:true,cityId:7}];
 const data=(access)=>({users,access:{email:'Quem@Usa.invalid',name:'Q',role:'Administrador',organizationId:2,...access}});
 assert.equal(o.defaultOwnerEmail(data({}),7),'quem@usa.invalid','equipe própria: quem está usando');
 assert.equal(o.defaultOwnerEmail(data({isAdvisory:true}),7),'dona@x.invalid','assessoria: administrador ativo da empresa');
 assert.deepEqual(o.eligibleOwners(data({}),7).map(u=>u.email),['coord@x.invalid','dona@x.invalid'],'só equipe ativa que atende a cidade');
 assert.deepEqual(o.eligibleOwners(data({}),8).map(u=>u.email),['dona@x.invalid'],'coordenação de outra cidade não entra');
 assert.equal(o.defaultOwnerEmail({users:[],access:{email:'adv@elite.invalid',isAdvisory:true}},7),'adv@elite.invalid','sem equipe: o servidor explica o que fazer');
});
