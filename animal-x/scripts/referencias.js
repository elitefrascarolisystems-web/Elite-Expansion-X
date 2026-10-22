// Referências visuais de cães (vídeos baixados da internet).
//
// Os vídeos servem só de referência para modelar: ficam em data/referencias/
// (fora do Git) e nada deles entra no app. O que vai para o repositório são
// as medidas e anotações feitas pela equipe, com o link de origem.
//
// Uso:
//   npm run ref:baixar -- <link da pasta do Google Drive>
//   npm run ref:quadros
//
// "baixar" usa o gdown (pip install gdown) e exige que a pasta esteja
// compartilhada como "Qualquer pessoa com o link: Leitor". "quadros" extrai
// quadros espaçados de cada vídeo e monta uma folha de contato com o ffmpeg.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.resolve(process.env.ANIMALX_REFERENCIAS ?? path.join(raiz, 'data/referencias/caes'));
const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const QUADROS_POR_VIDEO = 24;

function sha256(arquivo) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(arquivo).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

async function listarVideos(pasta) {
  const saida = [];
  for (const item of await readdir(pasta, { withFileTypes: true }).catch(() => [])) {
    if (item.name.startsWith('_')) continue;
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) saida.push(...await listarVideos(caminho));
    else if (VIDEO.test(item.name)) saida.push(caminho);
  }
  return saida.sort();
}

function sondar(arquivo) {
  const r = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', arquivo], { encoding: 'utf8' });
  const dados = JSON.parse(r);
  const s = dados.streams?.[0] ?? {};
  const [n, d] = String(s.r_frame_rate ?? '0/1').split('/').map(Number);
  return { largura: s.width ?? null, altura: s.height ?? null, fps: d ? +(n / d).toFixed(2) : null, duracao: +Number(dados.format?.duration ?? 0).toFixed(2) };
}

async function baixar(link) {
  if (!link) throw new Error('Informe o link da pasta do Google Drive.');
  if (spawnSync('gdown', ['--version']).status !== 0) throw new Error('gdown não encontrado. Instale com: pip install gdown');
  await mkdir(PASTA, { recursive: true });
  // --remaining-ok: o Drive lista no máximo 50 arquivos por pasta; subpastas são baixadas uma a uma.
  const r = spawnSync('gdown', ['--folder', link, '-O', `${PASTA}/`, '--remaining-ok'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('O download falhou. Confira se a pasta está compartilhada como "Qualquer pessoa com o link" e se a rede permite drive.google.com e drive.usercontent.google.com.');
  console.log(`Vídeos em ${PASTA}`);
}

async function quadros() {
  const videos = await listarVideos(PASTA);
  if (!videos.length) {
    console.log(`Nenhum vídeo em ${PASTA}.`);
    return;
  }
  const inventario = [];
  for (const video of videos) {
    const relativo = path.relative(PASTA, video);
    const nome = relativo.replace(/[\\/]/g, '__').replace(VIDEO, '');
    const info = sondar(video);
    const destino = path.join(PASTA, '_quadros', nome);
    await rm(destino, { recursive: true, force: true });
    await mkdir(destino, { recursive: true });
    // Quadros igualmente espaçados ao longo do vídeo, com 960 px de largura.
    const taxa = info.duracao > 0 ? Math.min(QUADROS_POR_VIDEO / info.duracao, info.fps || 30) : 1;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `fps=${taxa.toFixed(4)},scale=960:-2`, '-frames:v', String(QUADROS_POR_VIDEO), '-q:v', '3', path.join(destino, 'q%03d.jpg')]);
    // Folha de contato 6×4 para a visão geral.
    await mkdir(path.join(PASTA, '_folhas'), { recursive: true });
    const folha = path.join(PASTA, '_folhas', `${nome}.jpg`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(destino, 'q*.jpg'), '-vf', 'scale=320:-2,tile=6x4:padding=4:margin=4', '-frames:v', '1', '-q:v', '3', folha]);
    const extraidos = (await readdir(destino)).filter((a) => a.endsWith('.jpg')).length;
    inventario.push({ arquivo: relativo, sha256: await sha256(video), bytes: (await stat(video)).size, ...info, quadros: extraidos, folha: path.relative(PASTA, folha) });
    console.log(`${relativo}: ${info.duracao}s, ${info.largura}×${info.altura}, ${extraidos} quadros`);
  }
  await writeFile(path.join(PASTA, '_inventario.json'), `${JSON.stringify({ geradoEm: new Date().toISOString(), videos: inventario }, null, 2)}\n`);
  console.log(`${inventario.length} vídeos processados. Inventário: ${path.join(PASTA, '_inventario.json')}`);
}

const [comando, argumento] = process.argv.slice(2);
const acoes = { baixar: () => baixar(argumento), quadros };
if (!acoes[comando]) {
  console.error('Uso: node scripts/referencias.js baixar <link da pasta> | quadros');
  process.exit(1);
}
acoes[comando]().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
