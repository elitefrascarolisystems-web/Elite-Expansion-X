import { citadas } from './catalogo.js';

// X AI: assistente por regras locais. Responde só com o catálogo, mostra a
// fonte e nunca cria registros a partir da conversa.
const TERMOS_CLINICOS = /diagn[oó]stic|doen[cç]a|tratament|rem[eé]dio|medicament|dose|dosagem|sintoma|cura|progn[oó]stic|exame de|cirurgia|vacina|infec|c[aâ]ncer|tumor/i;

export function responderXAI(pergunta) {
  const texto = pergunta.trim();
  if (!texto) return { tipo: 'vazio', texto: 'Escreva o nome de uma estrutura, por exemplo: "onde fica o baço?"' };
  if (TERMOS_CLINICOS.test(texto)) {
    return { tipo: 'recusa', texto: 'O X AI não faz diagnóstico, não indica tratamento nem dose. Ele só explica anatomia com fonte. Para questões clínicas, consulte o médico-veterinário responsável.' };
  }
  const achadas = citadas(texto);
  if (!achadas.length) return { tipo: 'nada', texto: 'Não encontrei estruturas do catálogo nessa pergunta. Tente o nome em português, latim ou inglês.' };
  return {
    tipo: 'resposta',
    itens: achadas.slice(0, 3).map((e) => ({ id: e.id, titulo: `${e.pt} (${e.latim.termo})`, texto: e.resumo, definicao: e.uberon.definicao, uberon: e.uberon.id })),
  };
}
