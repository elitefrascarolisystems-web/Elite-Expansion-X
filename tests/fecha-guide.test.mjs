import assert from 'node:assert/strict';
import test from 'node:test';
import {fechaStep,personalize} from '../lib/fecha-guide.ts';

test('roteiro F.E.C.H.A.: cada etapa orienta o passo certo do treinamento',()=>{
 assert.equal(fechaStep('pending').letter,'F · E');
 assert.match(fechaStep('pending').say,/o que te impediu de finalizar/);
 assert.deepEqual(fechaStep('pending').scripts.map(s=>s.key),['retomada','sumiu']);
 assert.equal(fechaStep('blocker','Limite / cartão').guidance,'Veja outra forma de pagamento ou condição disponível.');
 assert.deepEqual(fechaStep('blocker','Dinheiro').scripts.map(s=>s.key),['financeiro']);
 assert.deepEqual(fechaStep('blocker','Dúvida').scripts,[],'mensagem financeira só para trava financeira');
 assert.match(fechaStep('resolved').say,/faz sentido concluirmos sua entrada agora/);
 assert.match(fechaStep('resolved').avoid,/Qualquer coisa me chama/);
 assert.equal(fechaStep('link').title,'Acompanhar');
 assert.equal(fechaStep('paid'),null,'pago não tem roteiro de cobrança');
});

test('mensagem pronta usa só o primeiro nome',()=>{
 const s=fechaStep('pending').scripts[0];
 assert.match(personalize(s,'Ana Maria Souza'),/^Oi, Ana! Vi que você tinha decidido entrar/);
 assert.equal(personalize(s,'  '),s.text);
});
