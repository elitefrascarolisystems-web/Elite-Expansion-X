# Referências de cães — como montar a pasta

Data: 22/10/2026. Para o espécime do cão da [Animal X](../../animal-x/README.md).

## Para que servem

Os vídeos baixados da internet servem **só de referência visual** para a equipe modelar: proporções, postura, silhueta, cabeça por tipo de crânio e marcha. Eles não entram no app nem no repositório. O que entra são as medidas e as anotações feitas pela equipe, com o link de origem registrado.

Vídeos de cães vivos mostram o lado de fora. Ossos e órgãos continuam dependendo de TC, dissecação ou atlas com licença, ou seja, do kit licenciado e do Projeto Acervo Aberto. Vídeos de dissecação da internet ajudam a olhar a forma, mas não viram dado com fonte.

## Pasta no Google Drive

Crie uma pasta chamada **Animal X — Referências — Cães**, com estas subpastas. Mantenha **até 50 arquivos por subpasta**, porque esse é o limite de listagem do Drive no download.

| Subpasta | O que colocar |
|---|---|
| `01-perfil-parado` | Cão parado em estação, de lado, corpo inteiro no quadro, câmera na altura do ombro e perpendicular ao animal. **É a mais importante.** |
| `02-frente-e-tras` | De frente e de trás, parado. |
| `03-de-cima` | Vista dorsal, se houver. |
| `04-andando` | Passo e trote vistos de lado. |
| `05-cabeca` | Cabeça de perfil e de frente. Inclua braquicefálicos (Pug, Buldogue) e dolicocefálicos (Galgo, Collie), além dos médios. |
| `06-anatomia-interna` | Dissecação didática, radiografia ou TC, se houver. Ficam só como referência. |

- **Nome do arquivo:** `raca_porte_vista_numero.mp4`. Exemplos: `labrador_grande_perfil_01.mp4`, `pug_pequeno_cabeca_02.mp4`.
- **Duração e qualidade:** trechos de 10 a 60 segundos, em 720p ou mais, sem filtros nem câmera lenta. De preferência, um cão por vídeo.
- **Variedade:** pelo menos 3 cães de porte médio em perfil parado. Depois, pequenos, grandes e os dois extremos de crânio.

## Ficha de cada vídeo

Preencha a planilha [`fichas-referencias-caes.csv`](fichas-referencias-caes.csv), que pode ser aberta no Google Planilhas. Salve-a na raiz da pasta como **CSV**, em "Arquivo → Fazer download → CSV".

O **link de origem** é obrigatório: é a procedência da referência. Peso e altura de cernelha só entram quando o vídeo informar. Não estime esses valores.

## Compartilhar com a sessão

1. No Drive, compartilhe a pasta como **Qualquer pessoa com o link → Leitor**.
2. Nas configurações do ambiente desta sessão, em **Network access → Allowed domains**, libere `drive.google.com`, `drive.usercontent.google.com` e `docs.google.com`. Deixe marcada a opção de gerenciadores de pacotes.
3. Envie o link da pasta.

## O que a equipe faz com os vídeos

```bash
cd animal-x
npm run ref:baixar -- "<link da pasta>"   # baixa para data/referencias/caes (fora do Git)
npm run ref:quadros                       # 24 quadros por vídeo, folha de contato e inventário com SHA-256
```

Com os quadros em mãos, o fluxo é:
1. Escolher os quadros em perfil verdadeiro.
2. Medir proporções em relação à altura de cernelha: comprimento do corpo, profundidade do tórax, segmentos dos membros, comprimento e altura da cabeça e ângulos articulares em estação.
3. Comparar os cães de cada porte e tipo de crânio.
4. Ajustar o espécime. Cada morfotipo (médio, braquicefálico, dolicocefálico…) ganha as suas próprias medidas; um não é deformado para virar o outro.

As medidas entram no registro de fontes como **"referência visual de vídeo"**, com os links, nunca como medição direta de espécime.
