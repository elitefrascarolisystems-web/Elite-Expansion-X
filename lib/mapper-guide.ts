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
      "Muitos de uma vez: use as planilhas “Importar empresas e locais” (Território → Locais) e “Importar pessoas” (Território → Mapa). Importe os locais antes das pessoas. Para trazer a rede inteira de uma vez (mentorados, quem indicou, contato e vendas já feitas), use “Importar a rede por planilha” em Rede → Indicações: uma linha por pessoa, e o mapa e a rede ficam prontos.",
      "Quem indicou: ao cadastrar a pessoa ou ao iniciar o atendimento, escolha “Quem indicou”. A rede de indicações e o ícone de quem indicou se atualizam sozinhos.",
      "Venda: na ficha da pessoa no mapa, “Registrar venda”. Com o pagamento confirmado o círculo fica dourado (Cliente); se ela indicar alguém vira Indicador; se a indicação comprar, Multiplicador.",
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
      "Círculos dourados com número juntam vários cadastros: clique para abrir. Passe o mouse para ver o que há em cada ponto.",
      "Modos de ver, no alto do mapa: Explorar (o padrão), Calor (onde está a força), Cobertura (hexágonos: os tracejados vazios mostram onde mapear a seguir), Funil (cada local na etapa mais avançada dos atendimentos), Linha do tempo (a expansão mês a mês, com play) e Cidade acesa (torres de luz em 3D).",
      "O modo fica no endereço da página: copie o link para mostrar o mesmo modo a alguém.",
      "Os filtros ficam no botão Filtros; a legenda e os números de cada modo ficam sobre o mapa (no celular, no botão Legenda). A lista ao lado mostra os mesmos dados para quem prefere ler.",
    ],
  },
  {
    title: "Dúvidas",
    items: ["Fale com o administrador da plataforma. Se algo der erro, anote a tela e a mensagem que apareceu."],
  },
];
