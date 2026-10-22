import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { before, test } from 'node:test';
import { RAIZ } from '../server/config.js';
import { verificar } from '../scripts/verify-integrity.js';

const dist = path.join(RAIZ, 'dist');
let inventario;
before(async () => {
  inventario = JSON.parse(await readFile(path.join(dist, 'integridade.json'), 'utf8'));
});

test('inventário SHA-256 confere com os arquivos e detecta alteração', async () => {
  const ok = await verificar(dist);
  assert.deepEqual(ok.problemas, []);
  const alvo = path.join(dist, 'manifest.webmanifest');
  const original = await readFile(alvo);
  await writeFile(alvo, Buffer.concat([original, Buffer.from(' ')]));
  try {
    const r = await verificar(dist);
    assert.deepEqual(r.problemas, ['manifest.webmanifest: SHA-256 diferente']);
  } finally {
    await writeFile(alvo, original);
  }
});

test('pacote offline: service worker lista todos os arquivos e nada vem de fora', async () => {
  const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
  const lista = JSON.parse(sw.match(/const ARQUIVOS = (\[.*\]);/)[1]);
  for (const arquivo of Object.keys(inventario.arquivos)) {
    if (['sw.js', 'integridade.json'].includes(arquivo) || arquivo.endsWith('.LEGAL.txt')) continue;
    assert.ok(lista.includes(arquivo), `${arquivo} fora do cache offline`);
  }
  assert.ok(sw.includes(`animalx-${inventario.versao}`));
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const css = await readFile(path.join(dist, Object.keys(inventario.arquivos).find((a) => a.startsWith('estilo.'))), 'utf8');
  for (const texto of [html, css]) assert.doesNotMatch(texto, /https?:\/\/(?!www\.w3\.org)/, 'sem recursos externos');
  assert.match(html, /src="app\.[A-Za-z0-9]+\.js"/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)/, 'sem script inline (CSP)');
});

test('licenças dos componentes distribuídos acompanham o pacote', () => {
  for (const arquivo of ['licencas/three-MIT.txt', 'licencas/inter-OFL-1.1.txt', 'licencas/space-grotesk-OFL-1.1.txt']) {
    assert.ok(inventario.arquivos[arquivo], `${arquivo} ausente`);
  }
});
