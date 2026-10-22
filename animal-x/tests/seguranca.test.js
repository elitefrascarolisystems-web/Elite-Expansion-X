import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LimiteRequisicoes, conferirSenha, gerarHash, hashParaComparacao, hashToken, iguaisSeguro, novoToken } from '../server/seguranca.js';

test('scrypt: gera hash com sal próprio e confere só a senha certa', async () => {
  const a = await gerarHash('senha correta 123');
  const b = await gerarHash('senha correta 123');
  assert.match(a, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(a, b, 'cada hash usa um sal novo');
  assert.equal(await conferirSenha('senha correta 123', a), true);
  assert.equal(await conferirSenha('senha errada 123', a), false);
  assert.equal(await conferirSenha('qualquer', 'formato-invalido'), false);
});

test('hash fictício existe e nunca confere com senha alguma', async () => {
  const h = await hashParaComparacao();
  assert.equal(h, await hashParaComparacao(), 'é calculado uma vez');
  assert.equal(await conferirSenha('', h), false);
});

test('tokens: aleatórios, e a sessão guarda só o SHA-256', () => {
  const t = novoToken();
  assert.ok(t.length >= 40);
  assert.notEqual(t, novoToken());
  assert.match(hashToken(t), /^[a-f0-9]{64}$/);
  assert.equal(iguaisSeguro('abc', 'abc'), true);
  assert.equal(iguaisSeguro('abc', 'abd'), false);
  assert.equal(iguaisSeguro('', ''), false, 'vazio nunca confere');
  assert.equal(iguaisSeguro(undefined, 'x'), false);
});

test('limite de requisições: bloqueia acima do máximo e libera na janela seguinte', () => {
  let agora = 1_000;
  const l = new LimiteRequisicoes({ janelaMs: 1000, maximo: 3, relogio: () => agora, limpezaMs: 0 });
  assert.equal(l.registrar('a').permitido, true);
  assert.equal(l.registrar('a').permitido, true);
  assert.equal(l.registrar('a').permitido, true);
  const bloqueado = l.registrar('a');
  assert.equal(bloqueado.permitido, false);
  assert.equal(bloqueado.aguardarSegundos, 1);
  agora += 1001;
  assert.equal(l.registrar('a').permitido, true);
});

test('limite de requisições: limpa a memória antiga e respeita o tamanho máximo', () => {
  let agora = 0;
  const l = new LimiteRequisicoes({ janelaMs: 100, maximo: 5, maxChaves: 50, relogio: () => agora, limpezaMs: 0 });
  for (let i = 0; i < 40; i++) l.registrar(`ip-${i}`);
  assert.equal(l.mapa.size, 40);
  agora = 200;
  l.limpar();
  assert.equal(l.mapa.size, 0, 'entradas vencidas saem da memória');
  for (let i = 0; i < 500; i++) l.registrar(`novo-${i}`);
  assert.ok(l.mapa.size <= 50, `mapa limitado (tamanho ${l.mapa.size})`);
});
