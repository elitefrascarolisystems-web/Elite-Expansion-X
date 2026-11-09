import type { GuideKey } from "@/lib/tab-guide-keys";
import type { TabGuide } from "@/lib/tab-guides";

/**
 * Textos dos guias "Como usar" (gerados a partir das telas; revise aqui mesmo).
 * `funcoes` = quem vê a aba (conferido em tests/tab-guides.test.mjs). Exemplos fictícios:
 * nunca gravados no banco. `acao` vazia numa variação tira o "Fazer agora" daquela função.
 */
export const GUIDE_CONTENT: Record<GuideKey, TabGuide> = {
  "hoje/": {
    "titulo": "Como usar: Hoje",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Começar o dia: retornos, números, primeiros passos e alertas.",
    "passos": [
      "Toque em \"Abrir a agenda\" e comece pelos retornos atrasados.",
      "Em \"Primeiros passos\", toque no botão dourado do próximo passo e siga a ordem.",
      "Em \"Alertas da operação\", veja o que travou, como cidade sem líder ou venda sem pagamento."
    ],
    "exemplo": "Ana abriu Hoje e viu 2 retornos atrasados. Tocou em \"Abrir atendimento\", falou com Carla, que já tinha autorizado o contato, e registrou o retorno para quinta. Em \"Primeiros passos\", o próximo era empresas: tocou em \"Mapear empresa\" e cadastrou a Padaria Pão Dourado.",
    "acao": "aba:vendas/agenda",
    "porFuncao": {
      "Comercial": {
        "paraQueServe": "Começar o dia: seus retornos, seus números e atalhos.",
        "passos": [
          "Toque em \"Abrir a agenda\" e comece pelos retornos atrasados.",
          "Use os atalhos do alto: \"Mapear local e pessoas\" ou \"Novo atendimento\".",
          "Em \"Avisos por e-mail\", deixe ligado o \"Lembrete diário dos retornos\": chega às 7h30."
        ],
        "exemplo": "Maria abriu Hoje e viu 2 retornos atrasados. Tocou em \"Abrir a agenda\", começou por Carla, que já tinha autorizado o contato, e registrou o retorno para quinta. No alto, os números são só dos atendimentos de Maria.",
        "cuidado": "Atendimento só com a autorização de contato registrada."
      }
    }
  },
  "territorio/mapa": {
    "titulo": "Como usar: Mapa",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Ver onde a rede está e cadastrar locais e pessoas sem sair do mapa.",
    "passos": [
      "Toque em \"Mapear\" e siga: cidade, local e pessoas.",
      "No alto do mapa, troque o jeito de ver: \"Explorar\" para agir, \"Cobertura\" para ver o que falta.",
      "Toque num ponto e em \"Abrir página da pessoa\" para ver o próximo passo."
    ],
    "exemplo": "Ana mapeou a Padaria Pão Dourado e ligou Bruno como Colaborador. Bruno aparece no ponto da padaria, nunca na casa dele; sem local, apareceria no centro do bairro ou da cidade. Ele autorizou o contato, e Ana registrou isso em \"Iniciar atendimento\".",
    "cuidado": "Nunca cadastre endereço de casa; atendimento só com a autorização de contato registrada.",
    "acao": "novo:mapear",
    "porFuncao": {
      "Comercial": {
        "passos": [
          "Toque em \"Mapear\" e siga: cidade, local e pessoas.",
          "No alto do mapa, troque o jeito de ver: \"Explorar\" para agir, \"Cobertura\" para ver o que falta.",
          "Toque numa pessoa para abrir a ficha: você vê as que cadastrou e as do seu atendimento."
        ]
      }
    }
  },
  "territorio/cidades": {
    "titulo": "Como usar: Cidades",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Acompanhar cada cidade, seus bairros e a decisão.",
    "passos": [
      "Em \"Saúde das cidades\", veja a \"Decisão\" de cada uma e o motivo.",
      "Em \"Bairros\", toque em \"Cadastrar bairro\"; se ficar \"Sem ponto no mapa\", use \"Localizar\".",
      "Em \"Decisão registrada da cidade\", escolha a cidade, justifique e toque em \"Salvar registro\"."
    ],
    "exemplo": "A Cidade Exemplo está em \"Ajustar\": \"Falta atingir: embaixadores ativos\". Ana cadastrou o primeiro bairro, que ficou \"No mapa\": Bruno, sem local ligado, aparece no centro do bairro, nunca em casa. Ana registrou a decisão \"Ajustar\", com revisão em 30 dias.",
    "cuidado": "Cadastre só o nome do bairro, nunca rua ou número de casa.",
    "porFuncao": {
      "Administrador": {
        "passos": [
          "Toque em \"Cadastrar cidade\"; depois, use \"Configurar\" em cada uma.",
          "Em \"Bairros\", toque em \"Cadastrar bairro\"; se ficar \"Sem ponto no mapa\", use \"Localizar\".",
          "Veja a \"Decisão\" de cada cidade e registre a sua em \"Decisão registrada da cidade\"."
        ],
        "acao": "novo:cidade"
      },
      "Coordenação": {
        "passos": [
          "Veja a \"Decisão\" de cada cidade e use \"Configurar\" para líder e limites.",
          "Em \"Bairros\", toque em \"Cadastrar bairro\"; se ficar \"Sem ponto no mapa\", use \"Localizar\".",
          "Em \"Decisão registrada da cidade\", escolha a cidade, justifique e toque em \"Salvar registro\"."
        ]
      }
    }
  },
  "territorio/locais": {
    "titulo": "Como usar: Locais",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Ver e cadastrar empresas, escritórios e networks.",
    "passos": [
      "Toque em \"Cadastrar empresa ou local\": tipo, setor e fonte.",
      "Abra \"Importar empresas e locais por CSV ou XLSX\", envie a planilha e toque em \"Validar prévia\".",
      "No Mapa, abra a ficha do local e toque em \"Validar localização\" para marcar o ponto."
    ],
    "exemplo": "Bruno cadastrou o Escritório Contábil Modelo, setor Serviços profissionais, fonte \"Site do escritório\". Até o ponto ser validado no Mapa, Carla, a sócia, aparece no centro do bairro ou da cidade; depois, no ponto do escritório, nunca em casa.",
    "cuidado": "Cadastre só dados públicos do estabelecimento, nunca endereço de casa. A importação não cria atendimento nem autorização de contato.",
    "acao": "novo:mapear",
    "porFuncao": {
      "Comercial": {
        "cuidado": "Cadastre só dados públicos do estabelecimento, nunca endereço de casa. Você vê só os locais em que é o responsável."
      }
    }
  },
  "vendas/agenda": {
    "titulo": "Como usar: Agenda",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Com quem falar hoje, do 1º retorno ao pós-venda.",
    "passos": [
      "Comece por \"Atrasados\" e \"Hoje\"; na ficha, use \"Usar gancho\".",
      "Decidiu entrar e não pagou? Na ficha, toque em \"Iniciar F.E.C.H.A.\" e siga o roteiro.",
      "Quem já pagou aparece em \"Pós-venda\": boas-vindas, retorno e convite para indicar."
    ],
    "exemplo": "F.E.C.H.A. = Fato, Entender, Corrigir, Hora e Acompanhar. Daniel decidiu entrar, mas não pagou: a trava era o limite do cartão. Você registrou a solução (boleto) e a data combinada, sexta. Na sexta ele pagou, você registrou em \"Venda e pagamento\" e Daniel passou para \"Pós-venda\".",
    "cuidado": "A plataforma não envia mensagens sozinha: você confere e envia. Fale só com quem autorizou o contato.",
    "acao": "novo:atendimento-novo"
  },
  "vendas/atendimentos": {
    "titulo": "Como usar: Atendimentos",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Todos os atendimentos, a etapa e as vendas pagas.",
    "passos": [
      "Toque em \"Abrir acompanhamento\" em quem não está na agenda.",
      "Toque no nome e em \"Etapa e próximo passo\": Novo, Em conversa, Proposta, Ganho ou Perdido.",
      "Pagou? Toque em \"Registrar venda e pagamento\"; o filtro \"Com pagamento\" mostra as vendas."
    ],
    "exemplo": "Bruno autorizou o contato, mas não estava na agenda. Você tocou em \"Abrir acompanhamento\" e o 1º retorno entrou para hoje. Depois mandou a proposta e marcou \"Proposta\". Quando os R$ 1.000 caíram, registrou \"Pagamento confirmado\": só então virou receita.",
    "cuidado": "Se a pessoa pedir para não ser mais procurada, marque a revogação em \"Responsável e autorização\". O atendimento é encerrado, e isso não se desfaz.",
    "acao": "novo:venda",
    "porFuncao": {
      "Comercial": {
        "paraQueServe": "Seus atendimentos, a etapa e as vendas pagas."
      }
    }
  },
  "rede/embaixadores": {
    "titulo": "Como usar: Embaixadores",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Cadastrar embaixadores e acompanhar cada um até ficar ativo.",
    "passos": [
      "Toque em \"Cadastrar embaixador\": o código do link sai sozinho.",
      "Na lista, toque em \"Acompanhar\" para mudar o nível ou a \"Situação\".",
      "Use \"Criar tarefa\" para a missão da semana; os atendimentos dele contam sozinhos."
    ],
    "exemplo": "Daniel vai indicar a {empresa}. Você o cadastrou e deu a missão de levar a aula aberta à Academia Corpo Ativo. Ele fica ativo ao concluir o treinamento e aceitar as regras no portal e indicar o 1º atendimento. Quem ele indicar só vira atendimento com autorização.",
    "cuidado": "Salve o WhatsApp só de quem autorizou o contato. As regras do programa, só o próprio embaixador aceita.",
    "acao": "novo:embaixador"
  },
  "rede/indicacoes": {
    "titulo": "Como usar: Indicações",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Ver quem indicou quem e completar as indicações que faltam.",
    "passos": [
      "Em \"Árvore por ramos\", toque em \"Explorar ramo\".",
      "No cartão com \"Sem indicador registrado\", toque em \"Quem indicou?\" e em \"Vincular indicação\".",
      "Abra \"Importar a rede por planilha (mentorados, vendas e indicações)\" para trazer uma planilha."
    ],
    "exemplo": "Bruno trabalha na Padaria Pão Dourado e estava sem indicador. Você tocou em \"Quem indicou?\" e escolheu Maria, que é cliente. Ela vira Indicador (nível na rede) e, se Bruno comprar, Multiplicador. Bruno aparece no ponto da padaria, nunca em casa, e só é atendido com autorização.",
    "cuidado": "Registre só indicação de quem autorizou o contato. Na planilha, a confirmação vale para todas as linhas.",
    "acao": "novo:atendimento-novo",
    "porFuncao": {
      "Comercial": {
        "paraQueServe": "Ver quem indicou quem entre os seus atendimentos.",
        "cuidado": "Você vê só as pessoas dos seus atendimentos. Registre só indicação de quem autorizou o contato."
      }
    }
  },
  "rede/mentorados": {
    "titulo": "Como usar: Mentorados",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Preparar o portal de cada mentorado: jornada e encontros.",
    "passos": [
      "Toque em \"Convidar para o portal\" e use a função Mentorado.",
      "Em \"Jornada\", toque em \"Começar com uma sugestão editável\" ou use \"Adicionar etapa\".",
      "Na lista, toque em \"Editar\" para contato e próximo encontro, e em \"Colocar no mapa\"."
    ],
    "exemplo": "Carla entrou no portal como mentorada. Você tocou em \"Editar\", escolheu Ana como contato da equipe e marcou o encontro de segunda. Com \"Colocar no mapa\", Carla aparece no centro da Cidade Exemplo, nunca na casa dela. Quem Carla indicar, com autorização, cai na agenda de Ana.",
    "cuidado": "O mentorado vê só o portal dele, nunca a operação da equipe.",
    "acao": "novo:convidar"
  },
  "rede/parceiros": {
    "titulo": "Como usar: Parceiros e eventos",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Locais parceiros e as ações locais.",
    "passos": [
      "Toque em \"Cadastrar parceiro\" (ou, em Locais, \"Marcar como parceiro\").",
      "Toque em \"Cadastrar evento\", escolha o \"Parceiro\" e informe data, \"Responsável\" e custo.",
      "Em \"Parceiros\", confira a próxima ação; em \"Eventos\", a data, o responsável e o custo."
    ],
    "exemplo": "A Academia Corpo Ativo topou receber uma aula aberta. Ana cadastrou a academia como parceira e o evento de sábado com custo de R$ 200, que entra sozinho nos custos. Das 30 pessoas da aula, 5 autorizaram o contato e viraram atendimento. As outras não foram registradas.",
    "cuidado": "Em \"WhatsApp do contato\", registre só o contato que o parceiro passou. Pessoas do evento só viram atendimento com autorização.",
    "acao": "novo:parceiro"
  },
  "rede/materiais": {
    "titulo": "Como usar: Materiais e ganchos",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Aprovar materiais e ganchos da equipe.",
    "passos": [
      "Toque em \"Adicionar material\", cole o link e escolha \"Para quem\".",
      "Em \"Ganchos de conversa\", cadastre ou importe e toque em \"Aprovar\".",
      "Só o aprovado aparece: materiais nos portais, ganchos em \"Usar gancho\" na ficha."
    ],
    "exemplo": "Ana gravou um vídeo curto da aula aberta da {empresa} na Academia Corpo Ativo. Colou o link, marcou para todos e \"Aprovado\": o vídeo apareceu no portal dos embaixadores e no dos mentorados. Daniel, embaixador, envia o vídeo só para contatos que autorizaram.",
    "cuidado": "Não ponha no material nome, telefone ou foto de cliente sem a autorização dele. Embaixadores só usam material aprovado.",
    "acao": "novo:material",
    "porFuncao": {
      "Líder": {
        "passos": [
          "Toque em \"Adicionar material\", cole o link e escreva as \"Instruções\".",
          "Em \"Para quem\", escolha embaixadores, mentorados ou todos.",
          "Em \"Situação\", o seu material entra \"Em revisão\": só o \"Aprovado\" aparece nos portais."
        ],
        "exemplo": "Ana, líder, adicionou o vídeo da aula aberta na Academia Corpo Ativo para todos. Ele entrou \"Em revisão\" e só aparece nos portais quando houver uma versão \"Aprovado\". Daniel, embaixador, só usa material aprovado e só com contatos que autorizaram."
      }
    }
  },
  "resultados/visao": {
    "titulo": "Como usar: Visão geral",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Ver como a expansão vai: clientes pagos, receita e custo.",
    "passos": [
      "Toque em \"Filtros\" e escolha cidade, período ou canal.",
      "Em \"Estamos crescendo com lucro?\", compare receita e custo por mês; \"Ver tabela\" dá os números.",
      "Em \"Saúde das cidades\", veja a \"Decisão\" e o motivo escrito logo abaixo dela."
    ],
    "exemplo": "Em outubro, a Cidade Exemplo teve 20 atendimentos válidos, 4 clientes pagos, R$ 8.000 de receita e R$ 2.000 de custo: CAC (custo por cliente pago) de R$ 500. A venda conta no mês em que o atendimento começou.",
    "porFuncao": {
      "Coordenação": {
        "cuidado": "Você vê só os números da sua cidade."
      },
      "Líder": {
        "cuidado": "Você vê só os números da sua cidade."
      }
    }
  },
  "resultados/calculadora": {
    "titulo": "Como usar: Calculadora",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Saber quanto falta, quando a meta chega e o que muda a data.",
    "passos": [
      "Digite a meta e a data: por exemplo, 40 vendas pagas até 28/12.",
      "Leia \"Quanto falta\", \"No ritmo atual\" e \"O que precisa acontecer\".",
      "Mexa em \"E se…?\" e toque em \"Aplicar como meta\"; depois, \"Dividir pela equipe\"."
    ],
    "exemplo": "Faltam 36 vendas em 8 semanas. No ritmo de hoje (3 por semana), a meta chega em 25/01. Com +3 mapeadores e +1 vendedor, chega em 25/12. Ao aplicar, a janela mostra o que será gravado: 40 vendas pagas até 28/12 e o plano de 150 atendimentos até 14/12.",
    "cuidado": "Simular não grava nada: só \"Aplicar como meta\" e \"Dividir pela equipe\" gravam, sem criar tarefa nem mensagem. Onde aparecer \"Sem dados suficientes\", digite sua estimativa."
  },
  "resultados/metas": {
    "titulo": "Como usar: Metas e rotina",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Ver a meta de cada pessoa e definir a rotina do dia.",
    "passos": [
      "Leia a linha \"Meta\" de cada pessoa.",
      "Toque em \"Definir rotina do dia\" e compare \"Frios / rotina\" e \"Contatos / rotina\".",
      "Leia \"Relatos diários · autodeclarados\" e mande o seu em \"Meu relatório diário\"."
    ],
    "exemplo": "O cartão de Bruno mostra \"Meta: 3 de 8 vendas · Semana: 4 de 10 atendimentos\". Para segunda, Ana deu a ele a rotina de 10 frios, 5 quentes e 20 contatos, e o cartão mostrou 20 / 20 contatos. A meta vem da Calculadora; a rotina do dia não é meta.",
    "cuidado": "O Comercial vê só os próprios números. No relato, não escreva contato de cliente.",
    "porFuncao": {
      "Comercial": {
        "paraQueServe": "Ver sua meta, sua rotina do dia e mandar seu relato.",
        "passos": [
          "Leia sua linha \"Meta\" e veja \"Contatos / rotina\" do \"Dia\".",
          "Use \"Registrar atividade\" na ficha do atendimento, na Agenda, para somar contatos.",
          "Toque em \"Meu relatório diário\" no fim do dia e conte impedimentos e o plano de amanhã."
        ],
        "exemplo": "Sua linha mostra \"Meta: 3 de 8 vendas · Semana: 4 de 10 atendimentos\". Na rotina de segunda, o cartão mostrou 20 / 20 contatos. No relato, você contou que a Padaria Pão Dourado quer conversar na quarta.",
        "cuidado": "Você vê só os seus números. No relato, não escreva contato de cliente.",
        "acao": "aba:vendas/agenda"
      }
    }
  },
  "resultados/mapeamento": {
    "titulo": "Como usar: Mapeamento",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Ver o que já está no mapa e quem cadastrou.",
    "passos": [
      "Em \"Cobertura por cidade\", veja \"Locais validados\" e \"Com local principal\".",
      "Em \"Produção por mapeador\", veja quanto cada pessoa cadastrou, no total e em \"7 dias\".",
      "Toque em \"Novo\" e em \"Mapear local e pessoas\" para subir os números."
    ],
    "exemplo": "Na Cidade Exemplo, 30 de 40 locais estão validados, com o ponto conferido. Das 100 pessoas, 60 estão ligadas a um local: Bruno aparece no ponto da Padaria Pão Dourado, que está validada. Quem não tem local fica no centro do bairro ou da cidade, nunca na casa.",
    "cuidado": "Nunca cadastre endereço de casa de ninguém.",
    "acao": "mapear"
  },
  "resultados/custos": {
    "titulo": "Como usar: Custos e canais",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder"
    ],
    "paraQueServe": "Registrar custos e ver quanto custa cada cliente pago.",
    "passos": [
      "Toque em \"Registrar custo\" e informe \"Período\", \"Categoria\" e valor.",
      "Em \"Eficiência por canal\", compare o CAC (custo por cliente pago) de cada canal.",
      "Em \"Custos registrados\", confira se cada custo entrou uma vez só e no mês certo."
    ],
    "exemplo": "Em outubro, Ana registrou R$ 1.000 de anúncios na Cidade Exemplo, com categoria e canal \"Mídia paga\". Vieram 10 atendimentos com autorização registrada e 2 clientes pagos: CAC de R$ 500. O custo de um evento já entra pelo cadastro do evento: não registre de novo.",
    "cuidado": "Na \"Observação\", não escreva nome nem contato de cliente.",
    "acao": "novo:custo"
  },
  "gestao/time": {
    "titulo": "Como usar: Time e acessos",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Cadastrar a equipe, enviar o link de acesso e ver quem entrou.",
    "passos": [
      "Toque em \"Convidar equipe\" e cole uma pessoa por linha.",
      "Confirme e envie a cada pessoa a própria mensagem por \"WhatsApp\" ou \"Copiar mensagem\".",
      "Em \"Acesso\", veja quem entrou; use \"Novo link\" para convite vencido e \"Nova senha\" se esquecer."
    ],
    "exemplo": "Ana convidou Bruno como Comercial da Cidade Exemplo. Ele não abriu o link em 72 horas e caiu em \"Convite vencido\". Ana tocou em \"Novo link\" e reenviou pelo WhatsApp. Bruno criou a senha e ficou \"Ativo\".",
    "cuidado": "A função define o que cada pessoa vê. Envie o link só para ela: vale 72 horas e uma vez só.",
    "acao": "novo:convidar"
  },
  "gestao/regras": {
    "titulo": "Como usar: Regras e cálculos",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Definir quando cada cidade avança e entender cada cálculo.",
    "passos": [
      "Em \"Critérios de decisão\", toque em \"Editar\" e defina os mínimos.",
      "Na mesma janela, preencha o \"Link-base de indicação\": dele sai o link de cada embaixador.",
      "Em \"Como os indicadores são calculados\" e \"O que cada nome quer dizer\", tire dúvidas."
    ],
    "exemplo": "Com os mínimos em 0, as cidades ficavam em \"Preparar\". Ana pôs 5 embaixadores ativos, 10 pagamentos e 2 períodos. A Cidade Exemplo tem 10 pagamentos, mas só 3 embaixadores ativos: em \"Cidades\", ela aparece como \"Ajustar\", com \"Falta atingir: embaixadores ativos\"."
  },
  "gestao/identidade": {
    "titulo": "Como usar: Identidade",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Mostrar o nome e a logo da empresa para a equipe.",
    "passos": [
      "Em \"Nome da empresa\", escreva o nome que a equipe deve ver.",
      "Toque em \"Escolher imagem\" e escolha a logo, com até 150 KB e, se der, fundo transparente.",
      "Marque a caixa de logo oficial e toque em \"Salvar identidade\"."
    ],
    "exemplo": "Maria escolheu a logo da empresa, com 100 KB e fundo transparente, marcou que é a logo oficial e tocou em \"Salvar identidade\". A logo passou a aparecer na barra lateral de toda a equipe e no mapa impresso da Cidade Exemplo.",
    "cuidado": "Use só a logo oficial da {empresa}, com autorização para usá-la."
  },
  "gestao/plano": {
    "titulo": "Como usar: Plano",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Ver o que o seu plano inclui e quanto já usou.",
    "passos": [
      "Na lista do plano, veja o que está incluído (✓) e o que ficou fora (riscado).",
      "Em \"Usuários da equipe\" e \"Cidades ativas\", veja quanto já usou de cada limite.",
      "Deixe uma cidade como \"Planejada\" em \"Cidades\" para ativar outra; para mais vagas, peça a ampliação."
    ],
    "exemplo": "O plano permite 5 usuários e 2 cidades ativas. Com a equipe completa, Ana ainda cadastrou Carla como Mentorado, porque mentorado não ocupa vaga. Para ativar a Cidade Exemplo, ela deixou outra cidade como \"Planejada\".",
    "cuidado": "Quem já está cadastrado continua com acesso: o limite só barra pessoas e cidades novas."
  },
  "gestao/historico": {
    "titulo": "Como usar: Histórico",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Ver o que mudou, quando e por quem (as 50 mais recentes).",
    "passos": [
      "Veja as alterações por dia, das mais novas às mais antigas.",
      "Em cada item, leia o que mudou, a hora e, embaixo, o e-mail de quem fez.",
      "Repare no selo \"Assessoria Elite\": ele aparece quando a mudança foi feita pela assessoria."
    ],
    "exemplo": "Ana notou que o orçamento da Cidade Exemplo mudou. No \"Histórico\", em \"Ontem\", achou \"Configuração da cidade atualizada.\", com a hora e o e-mail de Daniel. Ela conferiu com Daniel o que ele mudou e por quê."
  },
  "gestao/privacidade": {
    "titulo": "Como usar: Privacidade (LGPD)",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Atender pedidos da LGPD (lei de proteção de dados).",
    "passos": [
      "Em \"Buscar pelo nome, e-mail ou WhatsApp\", ache a pessoa.",
      "Escolha \"Cópia dos dados\", \"Corrigir dados\", \"Revogar autorização\" ou \"Excluir (anonimizar)\".",
      "Preencha \"Pedido recebido em\" e \"Por onde chegou\"; o pedido fica em \"Pedidos atendidos\"."
    ],
    "exemplo": "Carla pediu por WhatsApp para não ser mais contatada. Ana buscou Carla, tocou em \"Revogar autorização\", escolheu WhatsApp em \"Por onde chegou\" e confirmou. O atendimento saiu da agenda, o cadastro no mapa ficou e o pedido entrou em \"Pedidos atendidos\".",
    "cuidado": "Responda em até 15 dias. A exclusão não pode ser desfeita; na observação, não escreva dados da pessoa."
  },
  "gestao/avisos": {
    "titulo": "Como usar: Avisos por e-mail",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Ver se os e-mails automáticos saem e quem recebe cada um.",
    "passos": [
      "Veja se está \"Envio ligado\" e toque em \"Enviar teste para mim\".",
      "Em \"Como chega o e-mail\", troque entre \"Lembrete diário\" e \"Resumo semanal\" para ver a prévia.",
      "Em \"Quem recebe\", ligue ou desligue o \"Diário\" e o \"Semanal\" (só de administradores)."
    ],
    "exemplo": "Bruno pediu para não receber o lembrete das 7h30. Ana desligou o \"Diário\" dele em \"Quem recebe\". Bruno também poderia fazer isso sozinho, em Hoje ou pelo link no fim do e-mail. O lembrete só sai quando há retorno atrasado ou marcado para o dia."
  },
  "gestao/assessoria": {
    "titulo": "Como usar: Assessoria Elite",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Ver quem da Assessoria Elite acessa seus dados para dar suporte.",
    "passos": [
      "Veja na lista o nome e o e-mail de cada pessoa com acesso.",
      "Em \"Histórico\", procure o selo \"Assessoria Elite\": ele marca o que a assessoria mudou.",
      "Tire dúvidas sobre uma mudança com quem a fez: o e-mail aparece no item do \"Histórico\"."
    ],
    "exemplo": "Na mentoria, Bruno, da Assessoria Elite, atualizou a Cidade Exemplo. Depois, Ana abriu o \"Histórico\" e viu a mudança com o selo \"Assessoria Elite\" e o e-mail de Bruno.",
    "cuidado": "Esse acesso faz parte do serviço contratado: a Assessoria Elite vê e edita como Administrador.",
    "acao": "aba:gestao/historico"
  },
  "plataforma/assinaturas": {
    "titulo": "Como usar: Assinaturas",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Criar e cuidar das empresas assinantes.",
    "passos": [
      "Toque em \"Nova empresa assinante\", preencha dados e plano e toque em \"Criar empresa\".",
      "Na empresa nova, toque em \"Entrar\" e gere o link do responsável em \"Time e acessos\".",
      "Veja \"Pagamento vencido\"; na empresa atrasada, mude \"Pago até\" em \"Plano\" ou use \"Suspender\"."
    ],
    "exemplo": "O Escritório Contábil Modelo assinou por R$ 500 por mês. Ana criou a empresa com Daniel como responsável e gerou o link dele. Com o pagamento atrasado, o cartão mostrou \"Vencida há 10 dias\" e Ana tocou em \"Suspender\", com o motivo.",
    "cuidado": "Suspender bloqueia toda a equipe da empresa, inclusive a Assessoria Elite. Os dados ficam guardados e voltam ao reativar."
  },
  "plataforma/pedidos": {
    "titulo": "Como usar: Pedidos de assinatura",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Acompanhar quem pediu apresentação até virar assinante.",
    "passos": [
      "Fale com a pessoa e mude o \"Andamento\" para \"Em conversa\".",
      "Escreva o combinado em \"Anotação\": ela é salva quando você sai do campo.",
      "Feche o plano e toque em \"Criar empresa assinante\": o ambiente nasce com os dados do pedido."
    ],
    "exemplo": "O Escritório Contábil Modelo pediu apresentação. Ana falou com Daniel, pôs o pedido \"Em conversa\" e anotou \"apresentação na sexta\". Fechado o plano, tocou em \"Criar empresa assinante\", e o pedido passou sozinho para \"Virou assinante\".",
    "cuidado": "Use o contato só para falar da assinatura. Se o pedido não vai seguir, toque na lixeira: os dados de contato saem da plataforma."
  },
  "plataforma/assessores": {
    "titulo": "Como usar: Assessores",
    "funcoes": [
      "Administrador"
    ],
    "paraQueServe": "Escolher quem é Assessoria Elite nas empresas clientes.",
    "passos": [
      "Cadastre a pessoa antes em \"Time e acessos\", como ativa.",
      "Em \"Adicionar assessor\", digite o e-mail da pessoa e toque em \"Conceder assessoria\".",
      "Toque em \"Retirar\" ao lado do nome para tirar o acesso; \"Reativar\" devolve."
    ],
    "exemplo": "Maria entrou na equipe para dar suporte. Ana pôs o e-mail dela em \"Adicionar assessor\" e tocou em \"Conceder assessoria\". Agora Maria entra nas empresas clientes, e o Histórico de cada uma marca as mudanças dela com o selo \"Assessoria Elite\".",
    "cuidado": "O assessor vê e edita os dados de todas as empresas clientes. Quem sai da sua equipe perde a assessoria na hora."
  },
  "portal:embaixador": {
    "titulo": "Como usar: Portal do Embaixador",
    "funcoes": [
      "Embaixador"
    ],
    "paraQueServe": "Ativar o cadastro, divulgar o link e registrar contatos.",
    "passos": [
      "Em \"Seu progresso\", toque em \"Li e aceito\" e \"Concluir treinamento\".",
      "Em \"Indicação rastreada\", toque em \"Copiar link\" e envie com os \"Materiais para divulgar\".",
      "Quando alguém autorizar o contato, toque em \"Novo atendimento\" e registre a pessoa."
    ],
    "exemplo": "Daniel aceitou as regras e concluiu o treinamento. Copiou o link e enviou com um material aprovado para Ana, que pediu para conversar e autorizou o contato. Ele tocou em \"Novo atendimento\" e registrou Ana; a equipe segue a conversa.",
    "cuidado": "Use só os materiais aprovados e registre só quem autorizou o contato.",
    "acao": "portal:atendimento"
  },
  "portal:mentorado": {
    "titulo": "Como usar: Portal do Mentorado",
    "funcoes": [
      "Mentorado"
    ],
    "paraQueServe": "Acompanhar sua jornada, suas indicações e seus lugares.",
    "passos": [
      "Em \"Sua jornada\", toque no círculo de cada etapa quando concluir.",
      "Em \"Indicar alguém\", envie quem aceitou conversar e acompanhe em \"Suas indicações\".",
      "Em \"Seus lugares\", veja como abrir portas onde você já circula."
    ],
    "exemplo": "Bruno indicou a dona da academia onde treina, que aceitou conversar; ela aparece em \"Suas indicações\" como Recebida. Em \"Seus lugares\", a academia traz uma dica para propor uma conversa com o responsável.",
    "cuidado": "Só indique quem sabe da indicação e autorizou o contato. Se deixou de frequentar um lugar, toque em \"Não frequento mais\".",
    "acao": "portal:indicar"
  },
  "pessoa": {
    "titulo": "Como usar: Página da pessoa",
    "funcoes": [
      "Administrador",
      "Coordenação",
      "Líder",
      "Comercial"
    ],
    "paraQueServe": "Ver tudo de uma pessoa num lugar só e o próximo passo com ela.",
    "passos": [
      "Comece pelo \"Próximo passo\": é a ação mais importante agora.",
      "Em \"Lugares\", veja onde ela tem vínculo, a situação de cada lugar e o plano de plantio.",
      "Depois da visita, toque em \"Registrar visita\"; tudo entra no \"Histórico\"."
    ],
    "exemplo": "Maria é Cliente e sócia da Padaria Pão Dourado. Próximo passo: \"Pedir indicação\". Em Lugares: Academia Corpo Ativo · Frequenta · Avançar (1 cliente aqui). Plano: \"Pedir apresentação ao responsável\" até 05/11.",
    "cuidado": "Lugares só com a autorização da pessoa: trabalho, negócios e comunidades, nunca a casa, e sem horários."
  }
};
