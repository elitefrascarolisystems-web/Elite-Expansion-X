// Cruza o catálogo-base com o Uberon e gera content/estruturas.json.
//
// Uso:
//   node scripts/import-uberon.js [caminho/uberon.obo]
//   node scripts/import-uberon.js --download
//
// Sem argumento, lê data/uberon/uberon.obo. Com --download, baixa o arquivo
// do repositório oficial no GitHub. O SHA-256 e a data-version do arquivo
// usado ficam registrados no resultado, para conferência.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_UBERON = 'https://raw.githubusercontent.com/obophenotype/uberon/master/uberon.obo';
const TIPO_LATIM = 'OMO:0003011';

export function lerObo(texto) {
  const cabecalho = {};
  for (const linha of texto.slice(0, texto.indexOf('[Term]')).split('\n')) {
    const m = linha.match(/^([\w-]+): (.*)$/);
    if (m && !(m[1] in cabecalho)) cabecalho[m[1]] = m[2];
  }
  const termos = new Map();
  for (const bloco of texto.split(/\n\[Term\]\n/).slice(1)) {
    const corpo = bloco.split(/\n\[(?:Typedef|Instance)\]\n/)[0];
    const termo = { sinonimos: [], isA: [], partOf: [], taxon: [] };
    for (const linha of corpo.split('\n')) {
      let m;
      if ((m = linha.match(/^id: (\S+)/))) termo.id = m[1];
      else if ((m = linha.match(/^name: (.*)$/))) termo.nome = m[1];
      else if ((m = linha.match(/^def: "((?:[^"\\]|\\.)*)" \[(.*)\]/))) {
        termo.definicao = m[1].replace(/\\"/g, '"');
        termo.refsDefinicao = m[2] ? m[2].split(/,\s*/).filter(Boolean) : [];
      } else if ((m = linha.match(/^synonym: "((?:[^"\\]|\\.)*)" (\w+)(?: ([\w:]+))? \[(.*)\]/))) {
        termo.sinonimos.push({ texto: m[1], escopo: m[2], tipo: m[3] ?? null, refs: m[4] ? m[4].split(/,\s*/) : [] });
      } else if ((m = linha.match(/^is_a: (\S+)(?: \{[^}]*\})? ! (.*)$/))) termo.isA.push({ id: m[1], nome: m[2] });
      else if ((m = linha.match(/^relationship: part_of (\S+)(?: \{[^}]*\})? ! (.*)$/))) termo.partOf.push({ id: m[1], nome: m[2] });
      else if ((m = linha.match(/^relationship: (only_in_taxon|in_taxon) (\S+)(?: \{[^}]*\})?(?: ! (.*))?$/))) termo.taxon.push({ relacao: m[1], id: m[2], nome: m[3] ?? m[2] });
      else if (linha === 'is_obsolete: true') termo.obsoleto = true;
    }
    if (termo.id?.startsWith('UBERON:') && !termo.obsoleto) termos.set(termo.id, termo);
  }
  return { cabecalho, termos };
}

export function resolverNome(termos, nome) {
  const alvo = nome.toLowerCase();
  const porNome = [...termos.values()].filter((t) => t.nome?.toLowerCase() === alvo);
  if (porNome.length === 1) return porNome[0];
  if (porNome.length > 1) throw new Error(`Nome ambíguo no Uberon: "${nome}" (${porNome.map((t) => t.id).join(', ')})`);
  const porSinonimo = [...termos.values()].filter((t) =>
    t.sinonimos.some((s) => s.escopo === 'EXACT' && s.texto.toLowerCase() === alvo));
  if (porSinonimo.length === 1) return porSinonimo[0];
  throw new Error(`Nome não encontrado de forma única no Uberon: "${nome}" (${porSinonimo.length} sinônimos exatos)`);
}

function extrair(termo) {
  return {
    id: termo.id,
    nome: termo.nome,
    definicao: termo.definicao ?? null,
    refsDefinicao: termo.refsDefinicao ?? [],
    latim: termo.sinonimos.filter((s) => s.tipo === TIPO_LATIM).map((s) => s.texto),
    sinonimosExatos: termo.sinonimos.filter((s) => s.escopo === 'EXACT' && s.tipo !== TIPO_LATIM).map((s) => s.texto).slice(0, 6),
    isA: termo.isA.slice(0, 6),
    partOf: termo.partOf.slice(0, 6),
    taxon: termo.taxon,
  };
}

export function montarEstruturas(base, obo, meta) {
  const estruturas = base.estruturas.map((e) => {
    const termo = resolverNome(obo.termos, e.en);
    const u = extrair(termo);
    // Latim: o termo da equipe só leva o Uberon como fonte quando coincide com
    // um sinônimo latino registrado lá. Os sinônimos latinos do Uberon nem
    // sempre seguem a Nomina Anatomica Veterinaria (e alguns estão errados),
    // então nunca são promovidos sozinhos.
    const normalizar = (t) => t.toLowerCase().replace(/^m\. /, 'musculus ');
    const coincide = u.latim.some((l) => normalizar(l) === normalizar(e.la));
    const outros = [...new Set(u.latim.filter((l) => normalizar(l) !== normalizar(e.la)))];
    const latim = {
      termo: e.la,
      fonte: coincide ? 'uberon' : 'animalx-traducao',
      nota: coincide
        ? 'Coincide com um sinônimo latino do Uberon (OMO:0003011). Conferir com a NAV.'
        : 'Termo da equipe. Conferir com a NAV.',
      outrosNoUberon: outros,
    };
    return {
      id: e.id,
      pt: e.pt,
      en: u.nome,
      latim,
      sistema: e.sistema,
      regiao: e.regiao,
      bilateral: e.bilateral,
      resumo: e.resumo,
      tutor: e.tutor,
      uberon: u,
      fontes: {
        pt: 'animalx-traducao',
        en: 'uberon',
        definicao: 'uberon',
        latim: latim.fonte,
        resumo: 'animalx-traducao',
        tutor: 'animalx-traducao',
        geometria: 'animalx-esquematico',
      },
      revisao: { status: 'nao_revisado' },
    };
  });
  const comparada = base.comparada.map((c) => {
    const termo = resolverNome(obo.termos, c.en);
    return { pt: c.pt, especies: c.especies, uberon: extrair(termo) };
  });
  return {
    gerado: 'scripts/import-uberon.js',
    uberon: meta,
    sistemas: base.sistemas,
    regioes: base.regioes,
    estruturas,
    comparada,
  };
}

async function principal() {
  const arg = process.argv[2];
  let texto;
  let origem;
  if (arg === '--download') {
    const resposta = await fetch(URL_UBERON);
    if (!resposta.ok) throw new Error(`Falha ao baixar o Uberon: HTTP ${resposta.status}`);
    texto = await resposta.text();
    origem = URL_UBERON;
    await mkdir(path.join(raiz, 'data/uberon'), { recursive: true });
    await writeFile(path.join(raiz, 'data/uberon/uberon.obo'), texto);
  } else {
    const arquivo = path.resolve(arg ?? path.join(raiz, 'data/uberon/uberon.obo'));
    texto = await readFile(arquivo, 'utf8');
    origem = URL_UBERON;
  }
  const sha256 = createHash('sha256').update(texto).digest('hex');
  const obo = lerObo(texto);
  const base = JSON.parse(await readFile(path.join(raiz, 'content/catalogo-base.json'), 'utf8'));
  const meta = {
    url: origem,
    dataVersion: obo.cabecalho['data-version'] ?? null,
    sha256,
    termos: obo.termos.size,
    acesso: new Date().toISOString().slice(0, 10),
  };
  const resultado = montarEstruturas(base, obo, meta);
  await writeFile(path.join(raiz, 'content/estruturas.json'), `${JSON.stringify(resultado, null, 2)}\n`);
  const comUberon = resultado.estruturas.filter((e) => e.latim.fonte === 'uberon').length;
  console.log(`Uberon ${meta.dataVersion} (${meta.termos} termos, SHA-256 ${sha256.slice(0, 12)}…)`);
  console.log(`${resultado.estruturas.length} estruturas e ${resultado.comparada.length} termos comparados gerados.`);
  console.log(`Latim: ${comUberon} termos coincidem com o Uberon; ${resultado.estruturas.length - comUberon} só têm o termo da equipe.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  principal().catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}
