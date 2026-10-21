import assert from 'node:assert/strict';
import test from 'node:test';
import {inviteMessage,mentorshipFromText,mentorshipLabel,parseTeamLines,roleFromText} from '../lib/team.ts';

const cities=[{id:1,name:'Esmeraldas'},{id:2,name:'Belo Horizonte'}];

test('convite em lote: lê a lista colada, entende "Executiva de Vendas" e aponta o que falta',()=>{
 const rows=parseTeamLines(`nome; e-mail; função; cidade; cargo; mentoria
Flávia Silva; Flavia@Elite.invalid; Executiva de Vendas; ; ; 2º ciclo
Fabricio\tfabricio@elite.invalid\tComercial\tesmeraldas\tExecutivo de Vendas\t1
Sem Email; ; Comercial
Coord Sem Cidade; coord@elite.invalid; Coordenadora
Repetida; flavia@elite.invalid; Admin
Exemplo; alguem@exemplo.com; Comercial
Embaixadora; emb@elite.invalid; Embaixadora; Esmeraldas
Cidade Nova; nova@elite.invalid; Comercial; Contagem
Função Errada; errada@elite.invalid; Gerente`,cities);
 const [flavia,fabricio,...bad]=rows;
 assert.deepEqual({...flavia},{line:2,name:'Flávia Silva',email:'flavia@elite.invalid',role:'Comercial',cityId:null,cityName:'',title:'Executiva de Vendas',mentorshipCycle:2});
 assert.equal(fabricio.role,'Comercial');assert.equal(fabricio.cityId,1,'cidade sem acento/maiúscula também vale');assert.equal(fabricio.title,'Executivo de Vendas');assert.equal(fabricio.mentorshipCycle,1);assert.equal(fabricio.error,undefined);
 assert.deepEqual(bad.map(r=>r.error),[
  'E-mail inválido.',
  'Coordenação precisa de uma cidade.',
  'E-mail repetido na lista.',
  'Troque o e-mail de exemplo pelo e-mail real da pessoa.',
  'Embaixador precisa ser ligado ao cadastro dele: use "Adicionar pessoa".',
  'Cidade não cadastrada: "Contagem". Cadastre a cidade antes.',
  'Função não reconhecida: "Gerente". Use Administrador, Coordenação, Líder, Comercial (Executivo de Vendas) ou Mentorado.',
 ]);
 assert.equal(parseTeamLines('\n  \n',cities).length,0);
});

test('função, mentoria e mensagem de convite',()=>{
 assert.equal(roleFromText('Líder'),'Líder');assert.equal(roleFromText('lider'),'Líder');assert.equal(roleFromText('Executivo de vendas'),'Comercial');assert.equal(roleFromText('Mentorada exclusiva'),'Mentorado');assert.equal(roleFromText('empresa assinante'),null,'assinante ganha organização própria, não login de portal');assert.equal(roleFromText('x'),null);
 assert.equal(mentorshipFromText(''),0);assert.equal(mentorshipFromText('não'),0);assert.equal(mentorshipFromText('sim'),1);assert.equal(mentorshipFromText('3'),3);assert.equal(mentorshipFromText('talvez'),null);assert.equal(mentorshipFromText('99'),null);
 assert.equal(mentorshipLabel(0),'');assert.equal(mentorshipLabel(2),'Mentoria · 2º ciclo');
 const msg=inviteMessage('Flávia Silva','https://elite.invalid/definir-senha#abc');
 assert.match(msg,/^Olá, Flávia! Seja bem-vindo\(a\) à Elite Expansion X/);
 assert.match(msg,/https:\/\/elite\.invalid\/entrar/);
 assert.match(inviteMessage('Ana','https://elite.invalid/definir-senha#abc',true),/novo link/);
});

test('convite de mentorado e assinante usa a mensagem do portal',()=>{
 const msg=inviteMessage('Maria Souza','https://elite.invalid/definir-senha#abc',false,true,'Loja Modelo');
 assert.match(msg,/^Olá, Maria! Seu portal de mentoria na Loja Modelo está pronto/);
 assert.match(msg,/https:\/\/elite\.invalid\/entrar/);
});

test('convite de empresa assinante fala da organização dela, não da Elite',()=>{
 const msg=inviteMessage('Paulo Lima','https://elite.invalid/definir-senha#abc',false,false,'Loja Modelo');
 assert.match(msg,/plataforma de expansão da Loja Modelo/);assert.ok(!/Elite Frascaroli/.test(msg));
});
