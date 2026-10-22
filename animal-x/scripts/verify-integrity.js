// Confere os arquivos de dist/ contra o inventário SHA-256 gerado no build.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

export async function verificar(pasta = dist) {
  const { arquivos } = JSON.parse(await readFile(path.join(pasta, 'integridade.json'), 'utf8'));
  const problemas = [];
  for (const [arquivo, esperado] of Object.entries(arquivos)) {
    if (arquivo === 'integridade.json') continue;
    try {
      const obtido = createHash('sha256').update(await readFile(path.join(pasta, arquivo))).digest('hex');
      if (obtido !== esperado) problemas.push(`${arquivo}: SHA-256 diferente`);
    } catch {
      problemas.push(`${arquivo}: ausente`);
    }
  }
  return { total: Object.keys(arquivos).length, problemas };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = await verificar();
  if (r.problemas.length) {
    console.error(r.problemas.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`${r.total} arquivos conferidos.`);
  }
}
