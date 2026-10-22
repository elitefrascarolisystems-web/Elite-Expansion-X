// Gera dist/: app empacotado com hash, CSS, fontes, ícones, manifesto,
// service worker para uso offline, licenças e o inventário SHA-256.

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(raiz, 'dist');
const web = path.join(raiz, 'web');

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// Todas as importações de "three" usam a mesma build WebGPU, para que o
// núcleo e os addons compartilhem uma única instância.
const threeUnico = {
  name: 'three-unico',
  setup(build) {
    build.onResolve({ filter: /^three$/ }, () => ({ path: path.join(raiz, 'node_modules/three/build/three.webgpu.js') }));
  },
};

async function listar(pasta, base = pasta) {
  const saida = [];
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) saida.push(...await listar(caminho, base));
    else saida.push(path.relative(base, caminho).split(path.sep).join('/'));
  }
  return saida.sort();
}

export async function build({ silencioso = false } = {}) {
  const inicio = Date.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(dist, 'fontes'), { recursive: true });
  await mkdir(path.join(dist, 'licencas'), { recursive: true });

  const resultado = await esbuild.build({
    entryPoints: [path.join(web, 'src/main.js')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    legalComments: 'linked',
    outdir: dist,
    entryNames: 'app.[hash]',
    write: true,
    metafile: true,
    plugins: [threeUnico],
    logLevel: silencioso ? 'silent' : 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = Object.keys(resultado.metafile.outputs).map((s) => path.basename(s)).find((n) => /^app\.[A-Z0-9]+\.js$/i.test(n));

  const fontes = [
    ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-latin-wght.woff2'],
    ['node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2', 'inter-latin-ext-wght.woff2'],
    ['node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2', 'space-grotesk-latin-500.woff2'],
    ['node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2', 'space-grotesk-latin-700.woff2'],
  ];
  for (const [origem, destino] of fontes) await copyFile(path.join(raiz, origem), path.join(dist, 'fontes', destino));

  const licencas = [
    ['node_modules/three/LICENSE', 'three-MIT.txt'],
    ['node_modules/@fontsource-variable/inter/LICENSE', 'inter-OFL-1.1.txt'],
    ['node_modules/@fontsource/space-grotesk/LICENSE', 'space-grotesk-OFL-1.1.txt'],
  ];
  for (const [origem, destino] of licencas) await copyFile(path.join(raiz, origem), path.join(dist, 'licencas', destino));

  const css = await readFile(path.join(web, 'estilo.css'));
  const cssNome = `estilo.${sha(css).slice(0, 12)}.css`;
  await writeFile(path.join(dist, cssNome), css);

  for (const arquivo of ['icone.svg', 'manifest.webmanifest']) await copyFile(path.join(web, arquivo), path.join(dist, arquivo));

  const html = (await readFile(path.join(web, 'index.html'), 'utf8'))
    .replace('%CSS%', cssNome)
    .replace('%JS%', js);
  await writeFile(path.join(dist, 'index.html'), html);

  // Service worker: guarda todos os arquivos para funcionar sem internet.
  const arquivos = (await listar(dist)).filter((a) => a !== 'sw.js');
  const versao = sha(Buffer.from((await Promise.all(arquivos.map((a) => readFile(path.join(dist, a))))).map(sha).join(''))).slice(0, 16);
  const sw = (await readFile(path.join(web, 'sw.js'), 'utf8'))
    .replace('__VERSAO__', versao)
    .replace('[/* __ARQUIVOS__ */]', JSON.stringify(['./', ...arquivos.filter((a) => !a.endsWith('.LEGAL.txt'))]));
  await writeFile(path.join(dist, 'sw.js'), sw);

  // Inventário de integridade.
  const inventario = {};
  for (const a of await listar(dist)) inventario[a] = sha(await readFile(path.join(dist, a)));
  await writeFile(path.join(dist, 'integridade.json'), `${JSON.stringify({ versao, arquivos: inventario }, null, 2)}\n`);

  const tamanho = (await Promise.all(Object.keys(inventario).map(async (a) => (await stat(path.join(dist, a))).size))).reduce((x, y) => x + y, 0);
  if (!silencioso) console.log(`Build ${versao}: ${Object.keys(inventario).length} arquivos, ${(tamanho / 1048576).toFixed(2)} MB, ${Date.now() - inicio} ms.`);
  return { versao, js, css: cssNome, arquivos: inventario };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  build().catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}
