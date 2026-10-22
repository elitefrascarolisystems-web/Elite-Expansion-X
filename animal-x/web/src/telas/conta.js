import { ESTRUTURAS, FONTES, UBERON, nome } from '../catalogo.js';
import { responderXAI } from '../xai.js';
import { TOURS } from '../conteudo.js';
import { api, cadastrar, carregarSessao, definirPreferencia, entrar, local, notificar, preferencias, sessao } from '../estado.js';
import { seloRevisao } from '../ficha.js';
import { palco } from '../palco.js';
import { avisar, botao, campo, dataBr, dataHoraBr, dialogo, h, icone, limpar, selo } from '../ui.js';
import { QUALIDADES } from '../viewer/visualizador.js';

function exigirConta(navegar, motivo) {
  if (sessao.usuario) return null;
  return h('div', { class: 'ax-pagina' }, h('div', { class: 'ax-cartao ax-cartao--centro' },
    h('h2', {}, 'Entre para continuar'),
    h('p', {}, motivo),
    sessao.servidor ? botao('Entrar ou criar conta', { icone: 'entrar', classe: 'ax-btn--primario', onClick: () => navegar('entrar') })
      : h('p', { class: 'ax-nota' }, 'Servidor indisponível: o atlas funciona offline, mas contas precisam do servidor.')));
}

const SITUACAO = [
  ['Atlas 3D do cão esquemático com camadas, isolar, ocultar, desfazer e transparência', 'Existe'],
  ['Ficha com português, latim, inglês, definição do Uberon e fonte em cada dado', 'Existe'],
  ['Tours guiados, Explicar ao tutor, quiz e modo apresentação', 'Existe'],
  ['Cortes, medida aproximada, rótulos, caneta e exportação de imagem', 'Existe'],
  ['Contas, 8 papéis, revisão profissional, biblioteca e laboratório do animal', 'Existe'],
  ['Funciona sem internet depois da primeira visita (service worker)', 'Existe'],
  ['Modelos licenciados de cão, gato, cavalo e boi (TC, fotogrametria)', 'Aguardando download e conferência'],
  ['Cortes de TC e RM com NiiVue', 'Planejado'],
  ['Oclusão de ambiente, bloom e desfoque de fundo', 'Pendente: não validado'],
  ['Turmas e relatórios para instituições', 'Planejado'],
  ['Realidade virtual (Quest, Vision Pro)', 'Planejado'],
];

export function telaInicio({ navegar }) {
  const continuar = local.ultimaCena ? botao('Continuar de onde parou', { icone: 'atlas', classe: 'ax-btn--primario', onClick: async () => { navegar('atlas'); await palco.pronto; palco.visualizador.aplicarCena(local.ultimaCena); } }) : botao('Abrir o atlas', { icone: 'atlas', classe: 'ax-btn--primario', onClick: () => navegar('atlas') });
  const atalho = (titulo, texto, rota, nomeIcone) => h('button', { type: 'button', class: 'ax-cartao ax-cartao--acao', onClick: () => navegar(rota) }, icone(nomeIcone, 22), h('h3', {}, titulo), h('p', {}, texto));
  return { elemento: h('div', { class: 'ax-pagina ax-inicio' },
    h('section', { class: 'ax-heroi' },
      h('p', { class: 'ax-sobretitulo' }, 'Atlas de anatomia veterinária 3D'),
      h('h1', {}, 'Animal X'),
      h('p', { class: 'ax-heroi-texto' }, 'Para especialistas, professores e estudantes: ensino e explicação ao tutor, com a fonte de cada dado. Não é ferramenta de diagnóstico.'),
      h('div', { class: 'ax-grade-botoes' }, continuar, botao('Modo apresentação', { icone: 'apresentacao', onClick: () => document.dispatchEvent(new CustomEvent('ax:apresentar')) }))),
    h('div', { class: 'ax-faixa ax-faixa--aviso' }, icone('alerta', 16), h('span', {}, 'Versão de demonstração: o espécime é um cão esquemático feito pela equipe. Nomes e definições vêm do Uberon; textos em português ainda não foram revisados.')),
    h('div', { class: 'ax-grade-cartoes' },
      atalho('Atlas 3D', 'Sistemas, camadas e fichas com fonte.', 'atlas', 'atlas'),
      atalho('Tours', `${TOURS.length} tours guiados.`, 'tours', 'tours'),
      atalho('Explicar ao tutor', 'Cenas em linguagem simples.', 'tutor', 'tutor'),
      atalho('Avaliação', 'Quiz por estrutura e sistema.', 'avaliacao', 'avaliacao'),
      atalho('Evidências e referências', 'Fontes, licenças e créditos.', 'evidencias', 'evidencias')),
    h('div', { class: 'ax-duas-colunas' },
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Recentes'),
        local.recentes.length ? h('ul', { class: 'ax-lista-links' }, local.recentes.map((id) => h('li', {}, h('a', { href: `#/atlas/${id}` }, nome(id, preferencias.idiomaTermos))))) : h('p', { class: 'ax-nota' }, 'As estruturas abertas aparecem aqui.')),
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Favoritos'),
        local.favoritos.length ? h('ul', { class: 'ax-lista-links' }, local.favoritos.map((id) => h('li', {}, h('a', { href: `#/atlas/${id}` }, nome(id, preferencias.idiomaTermos))))) : h('p', { class: 'ax-nota' }, 'Marque estruturas com a estrela na ficha.'))),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Situação desta versão'),
      h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Recurso'), h('th', {}, 'Situação'))),
        h('tbody', {}, SITUACAO.map(([r, s]) => h('tr', {}, h('td', {}, r), h('td', {}, selo(s, s === 'Existe' ? 'ok' : s.startsWith('Pendente') ? 'aviso' : 'neutro')))))))) };
}

export function telaEntrar({ navegar }) {
  if (!sessao.servidor) return { elemento: h('div', { class: 'ax-pagina' }, h('p', { class: 'ax-cartao' }, 'Servidor indisponível. Contas precisam do servidor; o atlas segue funcionando.')) };
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, maxlength: '254' });
  const senha = h('input', { type: 'password', autocomplete: 'current-password', required: true, maxlength: '200' });
  const nomeCampo = h('input', { type: 'text', autocomplete: 'name', maxlength: '100' });
  const erro = h('p', { class: 'ax-erro', role: 'alert' });
  let modo = 'entrar';
  const form = h('form', { class: 'ax-form' });
  const desenhar = () => limpar(form,
    h('h2', {}, modo === 'entrar' ? 'Entrar' : 'Criar conta'),
    modo === 'cadastro' ? campo('Nome', nomeCampo) : null,
    campo('E-mail', email),
    campo('Senha', senha, modo === 'cadastro' ? 'Pelo menos 10 caracteres.' : null),
    erro,
    botao(modo === 'entrar' ? 'Entrar' : 'Criar conta', { tipo: 'submit', classe: 'ax-btn--primario' }),
    sessao.cadastroAberto ? botao(modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta', { classe: 'ax-btn--fantasma', onClick: () => { modo = modo === 'entrar' ? 'cadastro' : 'entrar'; senha.autocomplete = modo === 'entrar' ? 'current-password' : 'new-password'; desenhar(); } }) : null,
    h('p', { class: 'ax-nota' }, sessao.modo === 'memoria' ? 'Servidor em modo demonstração: contas somem quando ele reiniciar.' : 'Sessão protegida (HttpOnly, SameSite=Strict).'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    try {
      if (modo === 'entrar') await entrar(email.value, senha.value);
      else await cadastrar(nomeCampo.value, email.value, senha.value);
      avisar(`Bem-vindo(a), ${sessao.usuario.nome}.`);
      navegar('inicio');
    } catch (err) {
      erro.textContent = err.message;
    }
  });
  desenhar();
  return { elemento: h('div', { class: 'ax-pagina' }, h('div', { class: 'ax-cartao ax-cartao--centro' }, form)) };
}

export function telaBiblioteca({ navegar }) {
  const bloqueio = exigirConta(navegar, 'A biblioteca guarda suas cenas e anotações na sua conta.');
  if (bloqueio) return { elemento: bloqueio };
  const lista = h('div', { class: 'ax-grade-cartoes' });
  const nota = h('textarea', { maxlength: '2000', rows: '3', placeholder: 'Escreva uma anotação de estudo' });
  const titulo = h('input', { type: 'text', maxlength: '120', placeholder: 'Título da anotação' });
  const carregar = async () => {
    try {
      const { itens } = await api('/api/biblioteca');
      limpar(lista, itens.length ? itens.map((item) => h('article', { class: 'ax-cartao' },
        h('p', { class: 'ax-sobretitulo' }, item.tipo === 'cena' ? 'Cena' : 'Anotação', ' · ', dataHoraBr(item.criadoEm)),
        h('h3', {}, item.titulo),
        item.tipo === 'anotacao' ? h('p', {}, item.dados.texto) : h('p', { class: 'ax-nota' }, `${item.dados.ocultas?.length ?? 0} peças ocultas${item.dados.selecionada ? ` · selecionada: ${item.dados.selecionada}` : ''}`),
        h('div', { class: 'ax-grade-botoes' },
          item.tipo === 'cena' ? botao('Abrir', { icone: 'atlas', classe: 'ax-btn--pequeno', onClick: async () => { navegar('atlas'); await palco.pronto; palco.visualizador.aplicarCena(item.dados); } }) : null,
          botao('Apagar', { icone: 'lixo', classe: 'ax-btn--pequeno ax-btn--perigo', onClick: async () => { await api(`/api/biblioteca/${item.id}`, { metodo: 'DELETE' }); carregar(); } }))))
        : h('p', { class: 'ax-nota' }, 'Nada salvo ainda. No atlas, use "Salvar cena".'));
    } catch (erro) {
      limpar(lista, h('p', { class: 'ax-erro' }, erro.message));
    }
  };
  carregar();
  return { elemento: h('div', { class: 'ax-pagina' },
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Nova anotação'), campo('Título', titulo), campo('Texto', nota),
      botao('Salvar anotação', { icone: 'salvar', classe: 'ax-btn--primario', onClick: async () => {
        try {
          await api('/api/biblioteca', { metodo: 'POST', corpo: { tipo: 'anotacao', titulo: titulo.value || 'Anotação', dados: { texto: nota.value } } });
          titulo.value = '';
          nota.value = '';
          carregar();
        } catch (erro) { avisar(erro.message, 'erro'); }
      } })),
    lista) };
}

export function telaLaboratorio({ navegar }) {
  const bloqueio = exigirConta(navegar, 'O laboratório guarda dados dos seus animais. Só você vê esses dados; o administrador não tem acesso.');
  const conversa = h('div', { class: 'ax-xai-conversa', 'aria-live': 'polite' });
  const entrada = h('input', { type: 'text', maxlength: '300', placeholder: 'Pergunte sobre anatomia: "onde fica o rim?"', 'aria-label': 'Pergunta ao X AI' });
  const xai = h('section', { class: 'ax-cartao ax-xai' },
    h('h2', {}, 'X AI ', selo('Regras locais · sem IA externa', 'neutro')),
    h('p', { class: 'ax-nota' }, 'Responde só com o catálogo do Animal X, mostra a fonte e não registra nada.'),
    conversa,
    h('form', { class: 'ax-xai-form', onSubmit: (e) => {
      e.preventDefault();
      const r = responderXAI(entrada.value);
      conversa.append(h('p', { class: 'ax-xai-pergunta' }, entrada.value));
      if (r.tipo === 'resposta') {
        conversa.append(h('div', { class: 'ax-xai-resposta' }, r.itens.map((it) => h('div', {},
          h('strong', {}, it.titulo), h('p', {}, it.texto, ' ', h('small', { class: 'ax-fonte ax-fonte--propria' }, 'Equipe · não revisado')),
          it.definicao ? h('p', { class: 'ax-nota' }, `“${it.definicao}” — Uberon ${it.uberon}`) : null,
          botao('Ver no 3D', { classe: 'ax-btn--pequeno', onClick: () => navegar(`atlas/${it.id}`) })))));
      } else {
        conversa.append(h('p', { class: `ax-xai-resposta ax-xai-resposta--${r.tipo}` }, r.texto));
      }
      entrada.value = '';
      conversa.scrollTop = conversa.scrollHeight;
    } }, entrada, botao('', { icone: 'enviar', titulo: 'Perguntar', tipo: 'submit', classe: 'ax-btn--icone' })));
  if (bloqueio) return { elemento: h('div', { class: 'ax-pagina' }, bloqueio, xai) };

  const listaAnimais = h('div', { class: 'ax-lista-animais' });
  const detalhe = h('div', { class: 'ax-lab-detalhe' });
  let selecionado = null;
  const carregar = async () => {
    const { animais } = await api('/api/laboratorio/animais');
    limpar(listaAnimais, animais.map((a) => h('button', { type: 'button', class: `ax-animal ${selecionado === a.id ? 'ax-animal--ativo' : ''}`, onClick: () => { selecionado = a.id; carregar(); abrir(a); } },
      h('strong', {}, a.nome), h('span', {}, a.especie))),
    botao('Novo animal', { icone: 'laboratorio', onClick: novoAnimal }));
    if (!animais.length) limpar(detalhe, h('p', { class: 'ax-nota' }, 'Cadastre um animal para registrar peso, escore de condição corporal e contexto.'));
  };
  const novoAnimal = () => {
    const n = h('input', { type: 'text', maxlength: '80', required: true });
    const esp = h('select', {}, ['Cão', 'Gato', 'Equino', 'Bovino', 'Outra'].map((x) => h('option', {}, x)));
    const nasc = h('input', { type: 'date' });
    const sexo = h('select', {}, h('option', { value: '' }, 'Não informado'), h('option', { value: 'macho' }, 'Macho'), h('option', { value: 'femea' }, 'Fêmea'));
    dialogo('Novo animal', [campo('Nome', n), campo('Espécie', esp), campo('Nascimento', nasc), campo('Sexo', sexo)], { acoes: [{ rotulo: 'Salvar', classe: 'ax-btn--primario', acao: async (fechar) => {
      try {
        const { animal } = await api('/api/laboratorio/animais', { metodo: 'POST', corpo: { nome: n.value, especie: esp.value, nascimento: nasc.value || null, sexo: sexo.value || null } });
        selecionado = animal.id;
        fechar();
        await carregar();
        abrir(animal);
      } catch (erro) { avisar(erro.message, 'erro'); }
    } }] });
  };
  const abrir = async (animal) => {
    const { registros } = await api(`/api/laboratorio/animais/${animal.id}/registros`);
    const pesos = registros.filter((r) => r.tipo === 'peso');
    const eccs = registros.filter((r) => r.tipo === 'ecc');
    const idade = animal.nascimento ? Math.floor((Date.now() - new Date(`${animal.nascimento}T12:00:00`)) / (365.25 * 864e5)) : null;
    const tipo = h('select', {}, h('option', { value: 'peso' }, 'Peso (kg)'), h('option', { value: 'ecc' }, 'Escore de condição corporal (1–9)'), h('option', { value: 'contexto' }, 'Contexto (rotina, ambiente, alimentação)'));
    const valor = h('input', { type: 'text', maxlength: '1000' });
    const data = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
    // Simulação educativa: projeção linear simples entre os dois últimos pesos.
    let simulacao = h('p', { class: 'ax-nota' }, 'Registre ao menos dois pesos em datas diferentes para ver a projeção.');
    if (pesos.length >= 2) {
      const [a, b] = pesos.slice(-2);
      const dias = (new Date(b.data) - new Date(a.data)) / 864e5;
      if (dias > 0) {
        const porDia = (b.valor - a.valor) / dias;
        simulacao = h('p', {}, `E se a tendência entre ${dataBr(a.data)} e ${dataBr(b.data)} continuasse por 30 dias? Projeção: ${(b.valor + porDia * 30).toFixed(1)} kg. `,
          h('small', { class: 'ax-nota' }, 'Exercício educativo de matemática, sem conclusão clínica.'));
      }
    }
    limpar(detalhe,
      h('section', { class: 'ax-cartao' }, h('h2', {}, `Gêmeo de ${animal.nome}`),
        h('dl', { class: 'ax-gemeo' },
          h('dt', {}, 'Espécie'), h('dd', {}, animal.especie),
          h('dt', {}, 'Idade'), h('dd', {}, idade === null ? 'Não informada' : `${idade} ano(s)`),
          h('dt', {}, 'Sexo'), h('dd', {}, animal.sexo === 'femea' ? 'Fêmea' : animal.sexo === 'macho' ? 'Macho' : 'Não informado'),
          h('dt', {}, 'Último peso'), h('dd', {}, pesos.length ? `${pesos.at(-1).valor} kg (${dataBr(pesos.at(-1).data)})` : '—'),
          h('dt', {}, 'Último ECC'), h('dd', {}, eccs.length ? `${eccs.at(-1).valor}/9 (${dataBr(eccs.at(-1).data)})` : '—')),
        h('p', { class: 'ax-nota' }, 'Representação a partir dos dados que você registrou. Sem análise automática de padrões.')),
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Data Hub'),
        h('div', { class: 'ax-form-linha' }, campo('Tipo', tipo), campo('Valor', valor), campo('Data', data),
          botao('Registrar', { icone: 'salvar', classe: 'ax-btn--primario', onClick: async () => {
            try {
              const corpo = { tipo: tipo.value, data: data.value };
              if (tipo.value === 'contexto') corpo.texto = valor.value;
              else corpo.valor = Number(String(valor.value).replace(',', '.'));
              await api(`/api/laboratorio/animais/${animal.id}/registros`, { metodo: 'POST', corpo });
              abrir(animal);
            } catch (erro) { avisar(erro.message, 'erro'); }
          } })),
        registros.length ? h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Data'), h('th', {}, 'Tipo'), h('th', {}, 'Registro'))),
          h('tbody', {}, [...registros].reverse().map((r) => h('tr', {}, h('td', {}, dataBr(r.data)), h('td', {}, { peso: 'Peso', ecc: 'ECC', contexto: 'Contexto' }[r.tipo]), h('td', {}, r.tipo === 'contexto' ? r.texto : r.tipo === 'peso' ? `${r.valor} kg` : `${r.valor}/9`)))))
          : h('p', { class: 'ax-nota' }, 'Nenhum registro ainda. Registro manual, sem importação de dispositivos.')),
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Simulação "e se…"'), simulacao),
      h('section', { class: 'ax-cartao ax-cartao--pendente' }, h('h2', {}, 'Conexões e experimentos'), h('p', {}, 'Planejado. Ligações entre dados sem análise automática, como no Human X.')),
      botao('Apagar este animal', { icone: 'lixo', classe: 'ax-btn--perigo', onClick: () => dialogo('Apagar animal', h('p', {}, `Apagar ${animal.nome} e todos os registros? Não dá para desfazer.`), { acoes: [{ rotulo: 'Apagar', classe: 'ax-btn--perigo', acao: async (fechar) => {
        await api(`/api/laboratorio/animais/${animal.id}`, { metodo: 'DELETE' });
        fechar();
        selecionado = null;
        limpar(detalhe);
        carregar();
      } }] }) }));
  };
  carregar().catch((erro) => limpar(listaAnimais, h('p', { class: 'ax-erro' }, erro.message)));
  return { elemento: h('div', { class: 'ax-pagina' },
    h('div', { class: 'ax-lab' }, h('aside', { class: 'ax-cartao' }, h('h2', {}, 'Meus animais'), listaAnimais), detalhe),
    xai) };
}

export function telaRevisao({ navegar }) {
  const ehRevisor = sessao.usuario?.papel === 'revisor';
  const corpo = h('tbody', {});
  const desenhar = () => limpar(corpo, ESTRUTURAS.map((e) => {
    const r = sessao.revisoes[e.id];
    return h('tr', {},
      h('td', {}, h('a', { href: `#/estruturas/${e.id}` }, e.pt), h('br'), h('small', { class: 'ax-latim' }, e.latim.termo)),
      h('td', {}, seloRevisao(e.id)),
      h('td', {}, r ? `${r.revisorNome ?? '—'} · ${dataHoraBr(r.atualizadoEm)}` : '—'),
      h('td', {}, ehRevisor ? botao('Revisar', { classe: 'ax-btn--pequeno', onClick: () => revisar(e) }) : null));
  }));
  const revisar = (e) => {
    const status = h('select', {}, Object.entries(sessao.statusRevisao).map(([v, rot]) => h('option', { value: v, selected: (sessao.revisoes[e.id]?.status ?? 'nao_revisado') === v }, rot)));
    const nota = h('textarea', { rows: '4', maxlength: '2000', placeholder: 'Evidência usada na revisão (obrigatória para "Revisado"): livro, página, peça, exame.' }, sessao.revisoes[e.id]?.nota ?? '');
    dialogo(`Revisar: ${e.pt}`, [
      h('p', {}, h('strong', {}, 'Latim: '), e.latim.termo, ' · ', h('strong', {}, 'Inglês: '), e.en),
      h('p', {}, h('strong', {}, 'Descrição: '), e.resumo),
      h('p', {}, h('strong', {}, 'Tutor: '), e.tutor),
      campo('Status', status), campo('Nota da revisão', nota)], { acoes: [{ rotulo: 'Registrar revisão', classe: 'ax-btn--primario', acao: async (fechar) => {
      try {
        const { revisao } = await api('/api/revisoes', { metodo: 'POST', corpo: { estrutura: e.id, status: status.value, nota: nota.value } });
        sessao.revisoes[e.id] = revisao;
        notificar('revisoes');
        desenhar();
        fechar();
        avisar('Revisão registrada e auditada.');
      } catch (erro) { avisar(erro.message, 'erro'); }
    } }] });
  };
  desenhar();
  const resumo = Object.values(sessao.revisoes).filter((r) => r.status === 'revisado').length;
  return { elemento: h('div', { class: 'ax-pagina' },
    h('p', { class: 'ax-intro' }, ehRevisor ? 'Você é revisor científico: só você altera o status. Toda alteração é auditada.' : 'Somente revisores científicos alteram o status. Aqui você acompanha o andamento.'),
    h('p', {}, selo(`${resumo} de ${ESTRUTURAS.length} revisadas`, resumo ? 'ok' : 'aviso')),
    !sessao.usuario && sessao.servidor ? botao('Entrar como revisor', { icone: 'entrar', onClick: () => navegar('entrar') }) : null,
    h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Estrutura'), h('th', {}, 'Status'), h('th', {}, 'Última revisão'), h('th', {}, ''))), corpo)) };
}

export function telaAdministracao({ navegar }) {
  if (!sessao.usuario || !['admin', 'suporte'].includes(sessao.usuario.papel)) {
    return { elemento: exigirConta(navegar, 'Área de administração.') ?? h('div', { class: 'ax-pagina' }, h('p', { class: 'ax-cartao' }, 'Seu papel não tem acesso à administração.')) };
  }
  const ehAdmin = sessao.usuario.papel === 'admin';
  const usuarios = h('tbody', {});
  const auditoria = h('tbody', {});
  const status = h('div', {});
  const carregar = async () => {
    const [{ usuarios: lista }, st] = await Promise.all([api('/api/admin/usuarios'), api('/api/admin/status')]);
    limpar(status, h('p', {}, `Banco: ${st.status.modo === 'memoria' ? 'memória (demonstração)' : 'PostgreSQL'} · contas: ${st.status.usuarios}${st.status.migracoes ? ` · migrações: ${st.status.migracoes}` : ''} · backup diário: ${st.backupDiario ? 'ligado' : 'desligado'}`));
    limpar(usuarios, lista.map((u) => h('tr', {},
      h('td', {}, u.nome), h('td', {}, u.email), h('td', {}, dataBr(u.criadoEm)),
      h('td', {}, ehAdmin ? h('select', { 'aria-label': `Papel de ${u.nome}`, onChange: async (e) => {
        try {
          await api(`/api/admin/usuarios/${u.id}/papel`, { metodo: 'POST', corpo: { papel: e.target.value } });
          avisar('Papel alterado e auditado.');
          carregar();
        } catch (erro) { avisar(erro.message, 'erro'); carregar(); }
      } }, Object.entries(sessao.papeis).map(([v, rot]) => h('option', { value: v, selected: v === u.papel }, rot))) : sessao.papeis[u.papel]))));
    if (ehAdmin) {
      const { registros } = await api('/api/admin/auditoria');
      limpar(auditoria, registros.map((r) => h('tr', {}, h('td', {}, dataHoraBr(r.quando)), h('td', {}, r.acao), h('td', {}, r.alvo ?? '—'), h('td', {}, r.resumo ?? ''))));
    }
  };
  carregar().catch((erro) => avisar(erro.message, 'erro'));
  return { elemento: h('div', { class: 'ax-pagina' },
    h('div', { class: 'ax-faixa ax-faixa--info' }, icone('info', 16), h('span', {}, 'O administrador gerencia contas e auditoria. Dados de animais, laboratório e biblioteca dos usuários não aparecem aqui.')),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Sistema'), status),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Contas'), h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Nome'), h('th', {}, 'E-mail'), h('th', {}, 'Criada'), h('th', {}, 'Papel'))), usuarios)),
    ehAdmin ? h('section', { class: 'ax-cartao' }, h('h2', {}, 'Auditoria'), h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Ação'), h('th', {}, 'Alvo'), h('th', {}, 'Resumo'))), auditoria)) : null) };
}

export function telaConfiguracoes() {
  const estat = h('p', { class: 'ax-nota' });
  const atualizarEstat = () => {
    const e = palco.visualizador?.estatisticas?.();
    estat.textContent = e ? `Renderizador: ${e.backend}${palco.visualizador.motivoWebGL ? ' (WebGPU indisponível)' : ''} · ${e.fps} quadros/s · ${e.malhas} malhas · ${e.estruturas} estruturas · ${e.triangulos.toLocaleString('pt-BR')} triângulos · ${e.geometriaMB} MB de geometria · gerado em ${e.geracaoMs} ms` : 'Visualizador ainda carregando.';
  };
  const intervalo = setInterval(atualizarEstat, 1000);
  atualizarEstat();
  const opcao = (rotulo, chave, valores, aoMudar) => campo(rotulo, h('select', { onChange: async (e) => { definirPreferencia(chave, e.target.value); await aoMudar?.(e.target.value); } },
    Object.entries(valores).map(([v, r]) => h('option', { value: v, selected: preferencias[chave] === v }, r))));
  const alternar = (rotulo, chave, aoMudar) => h('label', { class: 'ax-alternador' }, h('input', { type: 'checkbox', checked: preferencias[chave], onChange: (e) => { definirPreferencia(chave, e.target.checked); aoMudar?.(e.target.checked); } }), h('span', {}, rotulo));
  const senhaAtual = h('input', { type: 'password', autocomplete: 'current-password' });
  const senhaNova = h('input', { type: 'password', autocomplete: 'new-password' });
  return {
    elemento: h('div', { class: 'ax-pagina ax-config' },
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Aparência'),
        opcao('Tema', 'tema', { escuro: 'Escuro', claro: 'Claro', misto: 'Misto (menu escuro, conteúdo claro)', auto: 'Automático (sistema)' }),
        opcao('Densidade', 'densidade', { confortavel: 'Confortável', compacta: 'Compacta' }),
        opcao('Idioma dos termos', 'idiomaTermos', { pt: 'Português', la: 'Latim', en: 'Inglês' })),
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Qualidade gráfica'),
        opcao('Nível de detalhe', 'qualidade', Object.fromEntries(Object.keys(QUALIDADES).map((q) => [q, { leve: 'Leve (celular)', balanceado: 'Balanceado', alto: 'Alto (dispersão subsuperficial)' }[q]])), async (q) => { await palco.pronto; palco.visualizador.definirQualidade(q); }),
        alternar('Forçar WebGL 2 (vale ao recarregar)', 'forcarWebGL'),
        estat),
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Acessibilidade'),
        alternar('Reduzir movimento (sem animações de câmera)', 'reduzirMovimento', (v) => { if (palco.visualizador) palco.visualizador.reduzirMovimento = v; })),
      sessao.usuario ? h('section', { class: 'ax-cartao' }, h('h2', {}, 'Conta'),
        h('p', {}, `${sessao.usuario.nome} · ${sessao.usuario.email} · ${sessao.usuario.papelNome}`),
        campo('Senha atual', senhaAtual), campo('Nova senha', senhaNova, 'Pelo menos 10 caracteres. As outras sessões serão encerradas.'),
        botao('Alterar senha', { classe: 'ax-btn--primario', onClick: async () => {
          try {
            await api('/api/senha', { metodo: 'POST', corpo: { atual: senhaAtual.value, nova: senhaNova.value } });
            senhaAtual.value = '';
            senhaNova.value = '';
            avisar('Senha alterada.');
          } catch (erro) { avisar(erro.message, 'erro'); }
        } })) : null,
      h('section', { class: 'ax-cartao' }, h('h2', {}, 'Dados neste navegador'),
        h('p', { class: 'ax-nota' }, 'Preferências, recentes e favoritos ficam só neste navegador.'),
        botao('Recarregar sessão', { onClick: () => carregarSessao() }))),
    sair: () => clearInterval(intervalo),
  };
}

export function telaEvidencias() {
  const integridade = h('p', { class: 'ax-nota' }, 'Conferindo o inventário do pacote…');
  fetch('integridade.json').then((r) => r.json()).then((d) => {
    integridade.textContent = `Pacote ${d.versao}: ${Object.keys(d.arquivos).length} arquivos com SHA-256 registrado (integridade.json).`;
  }).catch(() => { integridade.textContent = 'Inventário de integridade indisponível.'; });
  const linhaFonte = (f) => h('tr', {},
    h('td', {}, f.url ? h('a', { href: f.url, rel: 'noopener noreferrer', target: '_blank' }, f.titulo) : f.titulo, h('br'), h('small', {}, f.autor)),
    h('td', {}, f.licenca.url ? h('a', { href: f.licenca.url, rel: 'noopener noreferrer', target: '_blank' }, f.licenca.nome) : f.licenca.nome),
    h('td', {}, selo(f.grau, f.grau === 'D' ? 'ok' : f.grau === 'B' ? 'aviso' : 'neutro')),
    h('td', {}, f.usadoPara ?? f.conteudo, f.mesmaLicencaNosDerivados ? h('small', { class: 'ax-nota' }, ' Derivados mantêm a mesma licença (BY-SA).') : null));
  return { elemento: h('div', { class: 'ax-pagina' },
    h('p', { class: 'ax-intro' }, 'Cada dado mostra de onde veio. Grau D: licença lida diretamente na fonte. Grau B: lida em trecho de busca, a reconferir no download. NV: não verificada. Nada com grau B ou NV entra no pacote antes da conferência.'),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Em uso nesta versão'),
      h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Fonte'), h('th', {}, 'Licença'), h('th', {}, 'Grau'), h('th', {}, 'Uso'))), h('tbody', {}, FONTES.emUso.map(linhaFonte))),
      h('h3', {}, 'Créditos'),
      FONTES.emUso.map((f) => h('p', { class: 'ax-credito' }, f.credito)),
      h('p', { class: 'ax-nota' }, `Uberon: data-version ${UBERON.dataVersion}, ${UBERON.termos} termos lidos, SHA-256 ${UBERON.sha256}, acesso em ${dataBr(UBERON.acesso)}.`)),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Software e fontes tipográficas'),
      h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Componente'), h('th', {}, 'Licença'), h('th', {}, 'Uso'))),
        h('tbody', {}, FONTES.software.map((s) => h('tr', {}, h('td', {}, s.titulo), h('td', {}, s.licenca), h('td', {}, s.uso))))),
      h('p', {}, 'Textos das licenças incluídos no pacote: ', ['three-MIT.txt', 'inter-OFL-1.1.txt', 'space-grotesk-OFL-1.1.txt'].map((a, i) => [i ? ' · ' : '', h('a', { href: `licencas/${a}`, target: '_blank' }, a)]))),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Kit inicial previsto (a conferir)'),
      h('table', { class: 'ax-tabela' }, h('thead', {}, h('tr', {}, h('th', {}, 'Fonte'), h('th', {}, 'Licença'), h('th', {}, 'Grau'), h('th', {}, 'Conteúdo'))), h('tbody', {}, FONTES.planejadas.map(linhaFonte)))),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Fontes proibidas no pacote'),
      h('ul', {}, FONTES.proibidas.map((p) => h('li', {}, h('strong', {}, p.titulo), ` — ${p.motivo}`)))),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Integridade'), integridade),
    h('section', { class: 'ax-cartao' }, h('h2', {}, 'Aviso legal'),
      h('p', {}, 'Material de estudo e de explicação ao tutor. Não é ferramenta de diagnóstico nem substitui a avaliação do médico-veterinário. Não é prontuário (Res. CFMV 1.321/2020).'))) };
}

export function telaInstituicao() {
  return { elemento: h('div', { class: 'ax-pagina' },
    h('section', { class: 'ax-cartao ax-cartao--pendente' }, h('h2', {}, 'Instituição — planejado para a Fase 2'),
      h('ul', {},
        h('li', {}, 'Turmas com professores e estudantes vinculados.'),
        h('li', {}, 'Tours e quizzes atribuídos pelo professor.'),
        h('li', {}, 'Relatórios de uso sem dados pessoais além do necessário (LGPD: a instituição é controladora).'),
        h('li', {}, 'Projeto Acervo Aberto: digitalização de cadáveres doados e peças de museu, com coautoria e licença aberta.'))),
    h('p', { class: 'ax-nota' }, 'Nada desta tela está implementado ainda; ela existe para mostrar o caminho, não para simular o recurso.')) };
}

