/**
 * Guia do mapeador: o mesmo texto da página /guia e de docs/guia-do-mapeador.md.
 * Curto de propósito: cabe numa tela de celular e numa folha impressa.
 */
export type GuideSection = { title: string; items: string[]; ordered?: boolean };

export const MAPPER_GUIDE: GuideSection[] = [
  {
    title: "Antes de começar",
    items: [
      "Seu link de acesso é pessoal: vale por 72 horas e só funciona uma vez. Nele você cria a sua senha.",
      "Depois, entre sempre por /entrar com seu e-mail e sua senha. Não compartilhe o seu login.",
      "Na primeira entrada aparece o resumo do que a sua função faz. O administrador acompanha tudo em Gestão → Time e acessos.",
    ],
  },
  {
    title: "A ordem do mapeamento",
    ordered: true,
    items: [
      "Cidade: confira se a cidade já está cadastrada (Território → Cidades). Se não estiver, peça ao administrador.",
      "Local: use “+ Novo → Mapear local e pessoas”, no topo. Escolha a cidade e depois o local: um já cadastrado ou um novo, com tipo (Empresa, Escritório, Network / comunidade, Instituição de ensino ou Ponto de encontro), setor e endereço comercial.",
      "Ponto no mapa: busque o endereço e escolha o resultado certo. Se não achar, deixe pendente e valide depois em Mapa → local → “Validar localização”.",
      "Pessoas: no mesmo passo a passo, adicione as pessoas do local com o vínculo (sócio/dono, colaborador, mentorado, membro do network, responsável ou frequenta) e, se quiser, o papel (Mentorado, Mentor, Parceiro, Cliente assinante, Network...).",
      "Nome repetido: se aparecer o aviso de que já existe alguém com esse nome na cidade, confira no mapa. Só salve se for mesmo outra pessoa.",
      "Muitos de uma vez: use as planilhas “Importar empresas e locais” (Território → Locais) e “Importar pessoas” (Território → Mapa). Importe os locais antes das pessoas.",
      "Atendimento: se a pessoa autorizou o contato, use “Iniciar atendimento” (na ficha do mapa ou logo depois de cadastrá-la). O atendimento começa com o primeiro retorno já marcado na agenda. Depois siga em Vendas → Agenda com o roteiro do Método F.E.C.H.A.; ao confirmar o pagamento, a oportunidade fecha sozinha como Ganho.",
      "Agenda: ao entrar, “Sua agenda” mostra seus retornos atrasados e os de hoje. Comece por eles.",
    ],
  },
  {
    title: "No celular e sem internet",
    items: [
      "Instale o app: no Android (Chrome), toque em “Instalar” na faixa do topo; no iPhone (Safari), Compartilhar → Adicionar à Tela de Início. O ícone Elite X abre a plataforma em tela cheia.",
      "Antes de ir a campo, abra a plataforma uma vez com internet, em Território. Assim ela abre no celular mesmo sem sinal.",
      "Para achar alguém rápido, toque na lupa no topo (no computador, Ctrl+K): busque pessoa, local, atendimento ou cidade, ou digite o nome de uma tela (ex.: agenda) para ir até ela.",
      "Sem internet, o mapeamento guiado continua: locais e pessoas ficam guardados no celular com o aviso “Aguardando envio” e são enviados sozinhos quando o sinal voltar.",
      "Sem sinal não dá para buscar o endereço: deixe o local pendente e marque o ponto no mapa depois.",
      "Se aparecer “precisa da sua revisão” (por exemplo, nome repetido na cidade), toque em Ver e decida: enviar mesmo assim ou descartar. Envie tudo antes de sair da plataforma.",
    ],
  },
  {
    title: "Regras que não mudam (LGPD)",
    items: [
      "Nunca cadastre o endereço da casa de ninguém. A pessoa aparece no local ligado a ela ou no centro da cidade.",
      "Registre só o necessário para o trabalho: nome, cidade, local e vínculo.",
      "Lead só com autorização de contato. Se a pessoa pedir para sair, avise o administrador e registre.",
      "Antes de cadastrar, procure no mapa ou na lista para não duplicar.",
    ],
  },
  {
    title: "Como ler o mapa",
    items: [
      "Locais: dourado = Escritório · roxo = Network / comunidade · azul = Empresa (o ícone mostra o setor) · verde-azulado = Instituição de ensino · marrom = Ponto de encontro.",
      "Pessoas: o ícone mostra o papel principal (Líder, Embaixador, Mentorado, Cliente assinante, Lead...).",
      "Use os filtros de categoria (Pessoas, Locais, Setores) para ver um grupo de cada vez.",
    ],
  },
  {
    title: "Dúvidas",
    items: ["Fale com o administrador da plataforma. Se algo der erro, anote a tela e a mensagem que apareceu."],
  },
];
