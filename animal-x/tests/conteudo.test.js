import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { before, test } from 'node:test';
import { RAIZ } from '../server/config.js';
import { carregarModuloWeb } from './ajudantes/web.js';

const ler = async (arquivo) => JSON.parse(await readFile(path.join(RAIZ, arquivo), 'utf8'));
let estruturas;
let fontes;
before(async () => {
  estruturas = await ler('content/estruturas.json');
  fontes = await ler('content/fontes.json');
});

test('toda estrutura tem ID do Uberon, nome em três idiomas, definição e fonte por campo', () => {
  assert.equal(estruturas.estruturas.length, 53);
  const idsFonte = new Set([...fontes.emUso, ...fontes.planejadas].map((f) => f.id));
  for (const e of estruturas.estruturas) {
    assert.match(e.uberon.id, /^UBERON:\d{7}$/, e.id);
    assert.ok(e.pt && e.en && e.latim.termo, `${e.id}: nomes`);
    assert.ok(e.uberon.definicao, `${e.id}: definição do Uberon`);
    assert.ok(e.resumo && e.tutor, `${e.id}: textos`);
    for (const [campo, fonte] of Object.entries(e.fontes)) assert.ok(idsFonte.has(fonte), `${e.id}.${campo}: fonte ${fonte} registrada`);
    assert.equal(e.revisao.status, 'nao_revisado', 'nada nasce revisado');
    assert.match(e.latim.nota, /Conferir com a NAV/);
  }
});

test('o Uberon usado está identificado por versão e SHA-256', () => {
  assert.equal(estruturas.uberon.dataVersion, 'releases/2026-10-01');
  assert.match(estruturas.uberon.sha256, /^[a-f0-9]{64}$/);
  assert.ok(estruturas.uberon.termos > 10_000);
});

test('licenças: nada NC/ND, fontes em uso com grau D, BY-SA sinalizado', () => {
  for (const f of [...fontes.emUso, ...fontes.planejadas]) {
    assert.doesNotMatch(f.licenca.nome, /\bNC\b|\bND\b|NonCommercial|NoDerivs/i, `${f.id} tem licença proibida`);
    if (/BY-SA/.test(f.licenca.nome)) assert.equal(f.mesmaLicencaNosDerivados, true, `${f.id} deve sinalizar ShareAlike`);
  }
  for (const f of fontes.emUso) assert.equal(f.grau, 'D', `${f.id} em uso precisa de licença lida diretamente`);
  for (const s of fontes.software) assert.match(s.licenca, /^(MIT|OFL-1\.1|Apache-2\.0)$/);
});

test('o espécime gera exatamente as estruturas do catálogo, com lados coerentes', async () => {
  const { gerarCao } = await carregarModuloWeb('web/src/viewer/especime-cao.js');
  const partes = gerarCao(0.55);
  const catalogo = new Map(estruturas.estruturas.map((e) => [e.id, e]));
  const geradas = new Set(partes.map((p) => p.estrutura));
  assert.deepEqual([...geradas].sort(), [...catalogo.keys()].sort());
  for (const p of partes) {
    const e = catalogo.get(p.estrutura);
    assert.equal(p.sistema, e.sistema, `${p.chave}: sistema`);
    if (e.bilateral) assert.ok(['esquerdo', 'direito'].includes(p.lado), `${p.chave}: lado`);
    else assert.equal(p.lado, null, `${p.chave}: estrutura ímpar`);
    assert.ok(p.geometria.attributes.position.count > 0, `${p.chave}: geometria vazia`);
    for (const v of p.geometria.attributes.position.array) assert.ok(Number.isFinite(v), `${p.chave}: coordenada inválida`);
  }
  const chaves = partes.map((p) => p.chave);
  assert.equal(new Set(chaves).size, chaves.length, 'chaves únicas');
});

test('X AI: responde com o catálogo, recusa pergunta clínica e não cria registros', async () => {
  const { responderXAI } = await carregarModuloWeb('web/src/xai.js');
  const r = responderXAI('Onde fica o baço?');
  assert.equal(r.tipo, 'resposta');
  assert.equal(r.itens[0].id, 'baco');
  assert.equal(r.itens[0].uberon, 'UBERON:0002106');
  assert.equal(responderXAI('o fêmur e a patela').itens.map((i) => i.id).sort().join(), 'femur,patela');
  assert.equal(responderXAI('qual o diagnóstico do meu cão?').tipo, 'recusa');
  assert.equal(responderXAI('dose de remédio para o rim').tipo, 'recusa');
  assert.equal(responderXAI('e se eu testar').tipo, 'nada', 'palavras soltas não viram nada');
  assert.equal(responderXAI('   ').tipo, 'vazio');
  assert.equal(responderXAI('heart').itens[0].id, 'coracao', 'inglês');
  assert.equal(responderXAI('Ren').itens[0].id, 'rim', 'latim');
});
