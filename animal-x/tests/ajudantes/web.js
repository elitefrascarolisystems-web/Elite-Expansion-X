// Empacota um módulo de web/src para rodar no Node (sem DOM), com o mesmo
// apontamento único de "three" usado no build.
import path from 'node:path';
import * as esbuild from 'esbuild';
import { RAIZ } from '../../server/config.js';

export async function carregarModuloWeb(caminho) {
  const r = await esbuild.build({
    entryPoints: [path.join(RAIZ, caminho)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
    plugins: [{ name: 'three-unico', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: path.join(RAIZ, 'node_modules/three/build/three.webgpu.js') })); } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
