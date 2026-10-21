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
      "Local: em “Empresas e locais”, use “Cadastrar empresa ou local”. Escolha o tipo (Empresa, Escritório Elite, Network / comunidade, Instituição de ensino ou Ponto de encontro) e, se for empresa, o setor. Use sempre o endereço comercial.",
      "Localização: no Mapa, abra o local e use “Validar localização”. Só local validado aparece no ponto certo.",
      "Pessoa: no Mapa, use “+ Pessoa”, escolha a cidade, o local vinculado e o vínculo (sócio/dono, colaborador, mentorado, membro do network, responsável ou frequenta).",
      "Papel: na ficha da pessoa, use “Papéis e responsáveis” para registrar Mentorado, Mentor, Parceiro, Assinante, Network...",
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
