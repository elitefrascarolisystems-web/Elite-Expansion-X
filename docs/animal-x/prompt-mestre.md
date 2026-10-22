# Animal X — prompt-mestre

Data: 22/10/2026. Referência: descrição do Human X 360 (versão 7.24.0) e pesquisa de mercado em [`referencias-mercado-2026-10-22.md`](referencias-mercado-2026-10-22.md).

## Como usar

1. Crie um repositório próprio, `animal-x`. A descrição do Human X pede que a nova plataforma fique em pasta e repositório separados. Este arquivo só guarda o prompt.
2. Abra uma sessão nova do Claude Code nesse repositório e cole o bloco abaixo inteiro.
3. Anexe junto o PDF do Human X 360 e o arquivo de referências de mercado.
4. A primeira resposta deve ser só o plano, com o inventário de licenças e as perguntas. Aprove o plano antes de liberar o código.

---

```text
# MISSÃO

Você vai construir a Animal X: uma plataforma de anatomia veterinária 3D interativa,
multiespécie, ultrarrealista, que funciona offline. Ela é a versão animal do Human X 360
(descrição em anexo) e herda os princípios, a segurança e a arquitetura dele.

Posicionamento: atlas, ferramenta de ensino e de explicação ao tutor. NÃO é ferramenta
de diagnóstico. Público: médicos-veterinários especialistas, professores, estudantes de
Medicina Veterinária e Zootecnia, hospitais veterinários escola e universidades.

A primeira versão será apresentada a grandes líderes da Medicina Veterinária e a
universidades. Ela precisa impressionar pelo realismo e convencer pela honestidade
científica: tudo o que aparece na tela existe, funciona e mostra de onde veio.

Trabalhe como uma equipe sênior: líder de produto, anatomista veterinário revisor,
engenheiro gráfico 3D, engenheiro de backend e segurança, designer de interface.
Escreva em português do Brasil, com frases curtas e sem exagero de marketing.

# O QUE HERDAR DO HUMAN X 360

Princípios (obrigatórios):
1. Funciona sem internet. Servidor local, motor 3D, modelos, fontes e texturas vêm
   dentro do pacote.
2. Só recursos gratuitos com licença verificável. Nada comprado, nada de origem
   duvidosa. Licenças NC (não comercial) ou ND (sem derivados) estão proibidas.
3. Honestidade científica. Nenhum dado aparece como revisado ou validado sem evidência
   real. Cada dado mostra sua fonte.
4. Preservação. Toda mudança começa com uma cópia recuperável.
5. Separação de papéis. O administrador não acessa dados dos animais nem dos tutores.
6. Integridade anatômica. Cada espécie vem da sua própria fonte. Um modelo nunca é
   deformado para virar outra espécie, outro sexo ou outra raça. Cão não vira gato,
   cavalo não vira bovino, braquicefálico não é um mesocefálico esticado.

Ideias para reaproveitar: dados com fonte e selo de revisão; papéis com separação de
acesso; backup criptografado automático; três níveis de detalhe para rodar do celular
ao computador; build que gera o arquivo final; migrations versionadas.

Lições aprendidas do Human X (corrigir desde o primeiro dia):
- O assistente não cria registros a partir de palavras soltas da conversa.
- O login leva o mesmo tempo para e-mail existente e inexistente.
- O controle de limite de requisições limpa a memória antiga.
- Toda troca de senha tem limite de tentativas.
- Scripts não dependem de caminhos fixos de um sistema operacional.

# ESPÉCIES E PERFIS ANATÔMICOS

Fase 1: cão. Fase 2: gato, equino e bovino. Fase 3: suíno, ovino/caprino, aves e
exóticos/silvestres.
Para cada perfil, registre: espécie, sexo, porte ou morfotipo, fonte, licença,
número de malhas e estruturas, nível de detalhe e status de revisão.
Mostre na interface a tabela de perfis com as mesmas colunas do Human X
(Perfil, Fonte, Estruturas).

<<FONTES DE DADOS E LICENÇAS — preencher com a pesquisa>>

# ATLAS 3D

- Visualizador com rotação, zoom, seleção, camadas, transparência por grupo,
  esconder, isolar, desfazer e destaque colorido.
- Camadas por sistema: tegumentar, esquelético, articular, muscular, nervoso,
  cardiovascular, linfático, respiratório, digestório, urinário, reprodutor,
  endócrino e órgãos dos sentidos.
- Regiões próprias da veterinária: cabeça, pescoço, tórax, abdome, pelve, membro
  torácico, membro pélvico, cauda; no equino, casco e dígito; no bovino, estômago
  com rúmen, retículo, omaso e abomaso.
- Três níveis de detalhe (leve, balanceado, alto), com tamanho em MB informado.
- Tela de entrada com o animal em destaque e uma experiência imersiva.

# ANATOMIA COMPARADA (diferencial da Animal X)

Vista lado a lado da mesma estrutura em espécies diferentes, ligadas por homologia
(ex.: membro torácico do cão, do gato, do equino e do bovino; estômago simples x
estômago de ruminante). A ligação entre estruturas vem de uma ontologia com licença
verificável, nunca de suposição.

# FICHA DA ESTRUTURA

Para cada estrutura: nome em português, latim (Nomina Anatomica Veterinaria) e
inglês; espécie; sistema e região; descrição curta; relações; correlação clínica
quando houver fonte; fonte de cada dado; status de revisão (não revisado, em revisão,
revisado por <nome, data>). Guardar tudo para uso offline.

# LABORATÓRIO DO ANIMAL (equivalente ao Laboratório pessoal)

Agrupado em uma seção própria, como no Human X:
- Data Hub: registro manual de dados do animal (peso, escore de condição corporal,
  vacinas, rotina). Sem importação de dispositivos nesta fase.
- Gêmeo: representação do animal a partir dos dados registrados.
- Contexto: rotina, ambiente, alimentação.
- Conexões: ligações entre dados, sem análise automática de padrões.
- Simulação: cenários "e se…" educativos, sem conclusão clínica.
- Evidências: fluxo editorial; conteúdo científico só publica após revisão.
- X AI: assistente com regras locais, sem inteligência artificial externa nesta
  fase. Responde só com conteúdo revisado e mostra a fonte.

# MODO EXPLICAR AO TUTOR

O veterinário monta uma cena (ex.: joelho do cão com o ligamento cruzado cranial em
destaque), escolhe linguagem simples e mostra ao tutor em tela cheia. Não registra
diagnóstico, não guarda dado do tutor sem consentimento e mostra o aviso
"Material educativo. Não substitui a avaliação do médico-veterinário."

<<REFERÊNCIAS DE MERCADO — preencher com a pesquisa>>

<<REALISMO VISUAL E PIPELINE 3D — preencher com a pesquisa>>

# NAVEGAÇÃO

Barra lateral na ordem de uso de um especialista:
1. Início — continuar de onde parou, recentes e favoritos.
2. Atlas 3D — seletor de espécie, sexo, sistema e região.
3. Anatomia comparada — mesma estrutura em várias espécies.
4. Especialidades — pontos de partida prontos: Ortopedia, Neurologia, Cardiologia,
   Odontologia, Oftalmologia, Dermatologia, Reprodução e Obstetrícia, Anestesiologia
   (bloqueios locorregionais), Diagnóstico por Imagem, Grandes Animais, Equinos,
   Animais Exóticos e Silvestres.
5. Estruturas — busca e ficha com fontes, termos em português, latim e inglês, e
   status de revisão.
6. Ferramentas de estudo — cortes axial, sagital e coronal (transversal, sagital e
   dorsal na nomenclatura veterinária), medida aproximada, rótulos, caneta, anotações
   e exportação de imagem.
7. Aulas e Tours — tours cinematográficos com fatos verificados e modo apresentação.
8. Explicar ao tutor — cenas prontas em linguagem simples.
9. Avaliação — quiz por estrutura, região e espécie.
10. Minha biblioteca — cenas, anotações e coleções pessoais.
11. Evidências e referências — fontes, bibliografia e licenças com o crédito exigido.
12. Revisão profissional — só para revisores.
13. Laboratório do animal — módulos agrupados.
14. Instituição — turmas, professores e relatórios de uso (só para a universidade).
15. Configurações — tema (Claro, Escuro, Misto, Automático), densidade, idioma dos
    termos, qualidade gráfica e acessibilidade.
16. Administração — só para administradores.

# PAPÉIS

Estudante, professor, especialista, revisor científico, instituição, suporte, mentor e
administrador. O administrador não vê dados dos animais nem dos tutores. O revisor
científico é o único que muda o status de revisão. Toda ação sensível é auditada.

# SEGURANÇA E DADOS

- Senhas com scrypt. Sessão em cookie HttpOnly, Secure quando houver HTTPS,
  SameSite=Strict. Proteção CSRF.
- Limite de requisições com limpeza de memória. Login com tempo constante.
- Backup diário criptografado (AES-256-GCM) com teste de restauração.
- Migrations versionadas com trava e conferência de integridade. Modo em memória
  só para demonstração, com aviso visível.
- Verificação SHA-256 dos arquivos do pacote.

<<MARCO LEGAL E ÉTICO — preencher com a pesquisa>>

# ARQUITETURA

Mantenha a base do Human X para aproveitar o que a equipe já domina, com as melhorias
abaixo justificadas no plano:
- Frontend: Three.js (versão estável atual), JavaScript ou TypeScript, build que gera
  o arquivo final.
- Backend: Node.js 22+, servidor http nativo, sem framework.
- Banco: PostgreSQL com migrations versionadas; PostgreSQL embutido no uso local.
- Hospedagem: Docker, Compose e Caddy.
- Qualidade: testes de backend e de interface, testes visuais com navegador
  controlado, medição de quadros por segundo e de memória por nível de detalhe.

# FASES E ENTREGAS

Fase 0 — Fundação
- Repositório próprio, contas, papéis, segurança, migrations, backup.
- Pipeline de assets 3D com inventário de licenças gerado automaticamente.
- Página "Evidências e referências" com o crédito de cada fonte.

Fase 1 — Demonstração para líderes e universidades (cão)
- Atlas do cão com esqueleto, articulações, músculos e órgãos principais no nível
  de realismo mais alto que as fontes permitirem.
- Ficha da estrutura com português, latim e inglês e fonte em cada dado.
- Três tours cinematográficos: joelho do cão (ligamento cruzado cranial), coração e
  grandes vasos, e cabeça (dentes e articulação temporomandibular).
- Modo Explicar ao tutor com as mesmas três cenas.
- Modo apresentação para palco: tela cheia, roteiro, avanço por teclado ou
  passador, funciona sem internet.
- Anatomia comparada mínima, se houver fonte licenciada para uma segunda espécie.

Fase 2 — Gato, equino e bovino; cortes; quiz; biblioteca; revisão profissional;
instituição e turmas.

Fase 3 — Peças reais digitalizadas em parceria com museus de anatomia das
universidades, realidade aumentada e virtual, mais espécies.

# CRITÉRIOS DE ACEITE

- Nada na tela é simulado sem aviso. Dado sem fonte não aparece.
- Toda estrutura tem nome em latim (NAV), português, inglês, fonte e status.
- Funciona com a rede desligada, do início ao fim da demonstração.
- Nível balanceado roda fluido em notebook comum; nível leve roda em celular
  intermediário. Meça e informe os números reais.
- Licenças conferidas e creditadas; nenhum arquivo sem licença no pacote.
- Testes passando, com a contagem informada no relatório.

# COMO TRABALHAR

1. Primeiro, só o plano: arquitetura, inventário de fontes com licença e crédito,
   lista de riscos e no máximo 10 perguntas. Espere minha aprovação.
2. Depois, construa por fases, com commits pequenos e descritivos.
3. Ao fim de cada fase, entregue um relatório: o que existe e funciona, o que foi
   testado e como, o que ficou pendente e por quê. Não chame de pronto o que não
   foi verificado.

# ROTEIRO DA APRESENTAÇÃO (entregar junto com a Fase 1)

Roteiro de 7 minutos para a demonstração ao vivo:
1. Abertura com o animal em tela cheia, sem internet.
2. Atlas: camadas, isolar, cortes.
3. Ficha com fonte e status de revisão.
4. Tour do joelho e Modo Explicar ao tutor.
5. Anatomia comparada.
6. Proposta para universidades: turmas, avaliação e digitalização do acervo.
7. Encerramento com as próximas fases.
Inclua uma versão de 2 minutos e as respostas para as 10 perguntas mais prováveis
de reitores, coordenadores de curso e líderes do setor.
```
