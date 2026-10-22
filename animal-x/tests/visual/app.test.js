// Teste de ponta a ponta no Chromium: renderização 3D, telas, conta,
// laboratório, X AI, apresentação, celular e uso sem internet.
// Requer o build (npm run build) e um Chromium do Playwright.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { chromium } from 'playwright-core';
import { criarConta, iniciarServidor } from '../ajudantes/servidor.js';

const ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'];
const ROTAS = ['inicio', 'atlas', 'comparada', 'especialidades', 'estruturas', 'ferramentas', 'tours', 'tours/torax', 'tutor', 'tutor/coracao',
  'avaliacao', 'biblioteca', 'evidencias', 'revisao', 'laboratorio', 'instituicao', 'configuracoes', 'administracao', 'entrar', 'estruturas/femur', 'atlas/rim'];

let srv;
let navegador;

async function abrir({ largura = 1366, altura = 860, webgl = true, offline = false } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura }, serviceWorkers: offline ? 'allow' : 'block' });
  if (webgl) {
    await contexto.addInitScript(() => {
      try { localStorage.setItem('animalx:v1', JSON.stringify({ preferencias: { forcarWebGL: true, qualidade: 'leve' } })); } catch { /* sem armazenamento */ }
    });
  }
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !/GL Driver|Instance|Device Lost|WebGPU/i.test(m.text())) erros.push(`console: ${m.text()}`);
  });
  return { contexto, pagina, erros };
}

async function esperarPalco(pagina) {
  await pagina.waitForFunction(() => window.__axPronto === true, null, { timeout: 120_000 });
}

// Conta cores distintas numa captura do quadro 3D: uma tela vazia tem 1 ou 2.
async function coresNaCaptura(pagina) {
  return pagina.evaluate(async () => {
    const blob = await window.__ax.palco.visualizador.capturarImagem();
    const bitmap = await createImageBitmap(blob);
    const tela = new OffscreenCanvas(96, 64);
    const ctx = tela.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, 96, 64);
    const { data } = ctx.getImageData(0, 0, 96, 64);
    const cores = new Set();
    for (let i = 0; i < data.length; i += 4) cores.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
    return cores.size;
  });
}

before(async () => {
  srv = await iniciarServidor({ estruturas: ['coracao', 'femur', 'rim', 'baco'] });
  await criarConta(srv.armazem, { email: 'admin@visual.br', papel: 'admin', nome: 'Admin Visual' });
  navegador = await chromium.launch({ args: ARGS, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => {
  await navegador?.close();
  await srv?.fechar();
});

describe('Animal X no navegador', () => {
  test('o atlas renderiza o cão (WebGL 2)', async () => {
    const { contexto, pagina, erros } = await abrir();
    await pagina.goto(`${srv.base}/#/atlas`);
    await esperarPalco(pagina);
    await pagina.waitForTimeout(800);
    const est = await pagina.evaluate(() => window.__ax.palco.visualizador.estatisticas());
    assert.equal(est.backend, 'WebGL 2');
    assert.equal(est.estruturas, 53);
    assert.ok(est.triangulos > 20_000);
    assert.ok(await coresNaCaptura(pagina) > 40, 'a captura tem conteúdo');
    assert.deepEqual(erros, []);
    await contexto.close();
  });

  test('sem forçar WebGL, inicia em WebGPU ou volta sozinho para WebGL 2 e desenha', async () => {
    const { contexto, pagina, erros } = await abrir({ webgl: false });
    await pagina.goto(`${srv.base}/#/atlas`);
    await esperarPalco(pagina);
    await pagina.waitForTimeout(2500);
    const backend = await pagina.evaluate(() => window.__ax.palco.visualizador.backend);
    assert.ok(['WebGPU', 'WebGL 2'].includes(backend));
    assert.ok(await coresNaCaptura(pagina) > 40, `captura com conteúdo em ${backend}`);
    assert.deepEqual(erros, []);
    await contexto.close();
  });

  test('clicar numa estrutura abre a ficha com as fontes', async () => {
    const { contexto, pagina } = await abrir();
    await pagina.goto(`${srv.base}/#/atlas`);
    await esperarPalco(pagina);
    const ponto = await pagina.evaluate(async () => {
      const v = window.__ax.palco.visualizador;
      v.isolar(['femur']);
      v.irPara('membroPelvico', 0);
      await new Promise((r) => setTimeout(r, 300));
      const m = v.malhas.get('femur:esquerdo');
      const p = m.userData.centro.clone().project(v.camera);
      const r = v.canvas.getBoundingClientRect();
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
    });
    await pagina.mouse.click(ponto.x, ponto.y);
    await pagina.waitForSelector('.ax-ficha h2');
    assert.equal(await pagina.textContent('.ax-ficha h2'), 'Fêmur');
    const ficha = await pagina.textContent('.ax-ficha');
    assert.match(ficha, /UBERON:0000981/);
    assert.match(ficha, /Equipe · não revisado/);
    assert.match(ficha, /Uberon/);
    assert.match(ficha, /lado esquerdo/);
    await contexto.close();
  });

  test('todas as telas abrem sem erro', async () => {
    const { contexto, pagina, erros } = await abrir();
    for (const rota of ROTAS) {
      await pagina.goto(`${srv.base}/#/${rota}`);
      await pagina.waitForSelector('.ax-titulo');
      await pagina.waitForTimeout(rota.startsWith('atlas') || rota.startsWith('tours/') || rota.startsWith('tutor/') ? 1200 : 250);
      const texto = await pagina.textContent('.ax-conteudo');
      assert.doesNotMatch(texto, /Erro ao abrir a tela/, rota);
    }
    assert.deepEqual(erros, []);
    await contexto.close();
  });

  test('celular (390 px): sem rolagem horizontal e menu recolhível', async () => {
    const { contexto, pagina } = await abrir({ largura: 390, altura: 844 });
    for (const rota of ['inicio', 'atlas', 'estruturas', 'evidencias', 'tours/torax', 'tutor/rins', 'laboratorio', 'configuracoes']) {
      await pagina.goto(`${srv.base}/#/${rota}`);
      await pagina.waitForTimeout(rota.includes('/') || rota === 'atlas' ? 1500 : 300);
      const largura = await pagina.evaluate(() => Math.max(document.documentElement.scrollWidth, document.querySelector('.ax-conteudo').scrollWidth));
      assert.ok(largura <= 390, `${rota}: largura ${largura}`);
    }
    const direitaDoMenu = () => pagina.evaluate(() => document.querySelector('.ax-lateral').getBoundingClientRect().right);
    assert.ok(await direitaDoMenu() <= 0, 'menu recolhido fora da tela');
    await pagina.click('.ax-topo .ax-btn--icone');
    await pagina.waitForTimeout(400);
    assert.ok(await direitaDoMenu() > 200, 'menu aberto');
    await contexto.close();
  });

  test('conta, laboratório e X AI pela interface', async () => {
    const { contexto, pagina, erros } = await abrir();
    await pagina.goto(`${srv.base}/#/entrar`);
    await pagina.click('text=Não tenho conta');
    await pagina.fill('.ax-form input[autocomplete="name"]', 'Dra. Teste');
    await pagina.fill('.ax-form input[type="email"]', 'dra@visual.br');
    await pagina.fill('.ax-form input[type="password"]', 'senha-visual-123');
    await pagina.click('.ax-form button[type="submit"]');
    await pagina.waitForSelector('.ax-usuario');
    assert.match(await pagina.textContent('.ax-usuario'), /Dra\. Teste/);
    await pagina.goto(`${srv.base}/#/laboratorio`);
    await pagina.click('text=Novo animal');
    await pagina.fill('.ax-dialogo input[type="text"]', 'Thor');
    await pagina.click('.ax-dialogo footer button');
    await pagina.waitForSelector('text=Gêmeo de Thor');
    await pagina.fill('.ax-form-linha input[type="text"]', '28,4');
    await pagina.click('.ax-form-linha button');
    await pagina.waitForSelector('text=28.4 kg');
    await pagina.fill('.ax-xai input', 'onde fica o baço?');
    await pagina.press('.ax-xai input', 'Enter');
    await pagina.waitForSelector('.ax-xai-resposta strong');
    assert.match(await pagina.textContent('.ax-xai-resposta'), /Baço \(Lien\)/);
    await pagina.fill('.ax-xai input', 'qual o diagnóstico?');
    await pagina.press('.ax-xai input', 'Enter');
    await pagina.waitForSelector('.ax-xai-resposta--recusa');
    // O X AI não cria nada: o laboratório continua com um animal e um registro.
    assert.equal(srv.armazem.mapaAnimais.size, 1);
    assert.equal(srv.armazem.mapaRegistros.size, 1);
    assert.deepEqual(erros, []);
    await contexto.close();
  });

  test('tour por teclado e modo apresentação com 7 passos', async () => {
    const { contexto, pagina, erros } = await abrir();
    await pagina.goto(`${srv.base}/#/tours/torax`);
    await esperarPalco(pagina);
    await pagina.waitForSelector('.ax-legenda-tour h2');
    assert.equal(await pagina.textContent('.ax-legenda-tour h2'), 'A caixa torácica');
    await pagina.keyboard.press('ArrowRight');
    await pagina.waitForTimeout(200);
    assert.equal(await pagina.textContent('.ax-legenda-tour h2'), 'Pulmões');
    await pagina.goto(`${srv.base}/#/inicio`);
    await pagina.click('.ax-heroi >> text=Modo apresentação');
    await pagina.waitForSelector('.ax-apresentacao-legenda h1');
    const titulos = [];
    for (let i = 0; i < 7; i++) {
      titulos.push(await pagina.textContent('.ax-apresentacao-legenda h1'));
      await pagina.keyboard.press('ArrowRight');
      await pagina.waitForTimeout(250);
    }
    assert.equal(titulos.length, 7);
    assert.equal(titulos[0], 'Animal X');
    assert.equal(titulos[6], 'Proposta para universidades');
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.$('.ax-apresentacao'), null);
    assert.deepEqual(erros, []);
    await contexto.close();
  });

  test('funciona sem internet depois da primeira visita', async () => {
    const { contexto, pagina } = await abrir({ offline: true });
    await pagina.goto(`${srv.base}/#/inicio`);
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.reload();
    await pagina.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await contexto.setOffline(true);
    await pagina.goto(`${srv.base}/#/atlas`);
    await esperarPalco(pagina);
    await pagina.waitForTimeout(800);
    assert.equal(await pagina.evaluate(() => navigator.onLine), false);
    assert.ok(await coresNaCaptura(pagina) > 40, 'o atlas desenha sem rede');
    assert.match(await pagina.textContent('.ax-status'), /Sem internet/);
    await contexto.close();
  });
});
