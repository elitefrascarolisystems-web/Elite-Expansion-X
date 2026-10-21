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
      "Na primeira entrada aparece o resumo do que a sua função faz. O administrador acompanha tudo em “Time e acessos”.",
    ],
  },
  {
    title: "A ordem do mapeamento",
    ordered: true,
    items: [
      "Cidade: confira se a cidade já está cadastrada (aba Cidades). Se não estiver, peça ao administrador.",
      "Local: use o botão “Mapear”, no topo. Escolha a cidade e depois o local: um já cadastrado ou um novo, com tipo (Empresa, Escritório Elite, Network / comunidade, Instituição de ensino ou Ponto de encontro), setor e endereço comercial.",
      "Ponto no mapa: busque o endereço e escolha o resultado certo. Se não achar, deixe pendente e valide depois em Mapa → local → “Validar localização”.",
      "Pessoas: no mesmo passo a passo, adicione as pessoas do local com o vínculo (sócio/dono, colaborador, mentorado, membro do network, responsável ou frequenta) e, se quiser, o papel (Mentorado, Mentor, Parceiro, Assinante, Network...).",
      "Nome repetido: se aparecer o aviso de que já existe alguém com esse nome na cidade, confira no mapa. Só salve se for mesmo outra pessoa.",
      "Muitos de uma vez: use as planilhas “Importar empresas e locais” (aba Empresas e locais) e “Importar pessoas” (aba Mapa). Importe os locais antes das pessoas.",
      "Lead: só se a pessoa autorizou o contato. Depois acompanhe em “Vendas e relacionamento” com o roteiro do Método F.E.C.H.A.",
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
      "Locais: dourado = Escritório Elite · roxo = Network / comunidade · azul = Empresa (o ícone mostra o setor) · verde-azulado = Instituição de ensino · marrom = Ponto de encontro.",
      "Pessoas: o ícone mostra o papel principal (Líder, Embaixador, Mentorado, Assinante, Lead...).",
      "Use os filtros de categoria (Pessoas, Locais, Setores) para ver um grupo de cada vez.",
    ],
  },
  {
    title: "Dúvidas",
    items: ["Fale com o administrador da plataforma. Se algo der erro, anote a tela e a mensagem que apareceu."],
  },
];
