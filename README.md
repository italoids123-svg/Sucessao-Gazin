# Mapa Sucessório — Gazin

Painel (Next.js, 100% client-side) que calcula, para cada posição crítica da Gazin, quem são os
possíveis sucessores, com base em nível elegível, interesse declarado, pontuação de aderência e
mobilidade geográfica. Os dados vivem no navegador (`localStorage`) e entram/saem por planilha Excel.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor de cálculo e da planilha
npm run build
```

Deploy: qualquer host de Next.js (ex.: Vercel), sem variáveis de ambiente.

## Fluxo de dados

1. **Base inicial** (`lib/base-data.json`): gerada a partir de `Posicoes_Criticas.xlsx`
   (180 posições, 178 ocupantes, 1 vaga) por `npm run base -- caminho/Posicoes_Criticas.xlsx`.
   Se a planilha de origem mudar, gere de novo e incremente `BASE_DATA_VERSION` em `lib/config.ts`.
2. **Coleta**: botão *Baixar base para coleta* gera o `.xlsx` com as abas Leia-me, Cadeiras,
   Base de dados, Hierarquia e Valores aceitos.
3. **Importação**: *Carregar base preenchida* faz merge aditivo (só atualiza quem está na planilha;
   célula vazia não apaga valor salvo). Avisos de valores não reconhecidos vão para o console.

## Recursos da tela

- **Tela cheia**: botão na barra superior (sai também com Esc).
- **Imprimir / Exportar**: na barra superior (exporta a página atual) e no detalhe de cada posição
  (exporta só a posição). Escolha **PDF** (páginas A4, sem cortar cartões no meio) ou **PNG**
  (imagem única).

## Estrutura

- `lib/config.ts` — níveis, hierarquia de elegibilidade, pesos, corte, escalas (desempenho, e-NPS,
  prontidão, mobilidade) e cidade-sede. **Todos os parâmetros de negócio ficam aqui.**
- `lib/engine.ts` — elegibilidade, pontuação e os três grupos de interessados por posição.
- `lib/geo.ts` — regra de mobilidade (`mobilidadeAlcancaCidade`), pura e testável.
- `lib/excel.ts` — geração e importação da planilha.
- `lib/store.tsx` — estado global + persistência versionada no `localStorage`.
- `components/` e `app/` — Visão geral, uma página por nível, modal da posição e metodologia.
- `scripts/build-base.py` — conversão da planilha de posições críticas (inclui a regra de nível).

## Critérios de aderência (material "Critérios" da Gazin)

| Critério | Pontos |
|---|---|
| Avaliação de desempenho, ciclo atual (Resultado × Comportamento) | 30 |
| Match de indicação: líder indica (5) + colaborador se indica (5) | 10 |
| Pesquisa de clima 2026 (faixas de e-NPS) | 30 |
| Prontidão declarada (horizonte) | 10 |
| Mobilidade (local 2, matriz 7, estado 13, qualquer 20) | 20 |

Escalas completas em `lib/config.ts` e na página *Critérios* do app.

## Premissas a validar com a Gazin

- **Nível** não existe na planilha de origem; foi derivado do cargo e da linha de reporte
  (regra em `scripts/build-base.py` e na página *Elegibilidade e Aderência*).
- **Clima só para quem lidera equipe**: o material não diz; quem não lidera é avaliado sobre 70 pontos.
- **Entrada na posição**: basta uma ponta do match (se indicou OU foi indicado pelo líder).
  Nome indicado que corresponde a mais de uma pessoa só vale para quem também se indicou.
- **Mobilidade** pontua pela amplitude e também filtra: não aparece em posição fora do alcance declarado.
- **Hierarquia de elegibilidade**: Coordenação, Supervisão e Especialista se alimentam entre si e a si
  mesmos (movimento lateral dentro da faixa). Gerência, Gerência Executiva e Diretoria continuam só
  com promoção vertical.
- **Nomes de cargos e áreas** foram escritos por extenso, sem abreviações nem siglas (mapa em
  `scripts/build-base.py`, `NOME_POR_EXTENSO`).
- **Corte (60)** não consta do material: é padrão do modelo.
- **Matriz**: Douradina/PR.
- **Cidade das posições** não existe na origem: até ser preenchida (aba Cadeiras, formato Cidade/UF),
  a mobilidade não filtra ninguém e uma mesma pessoa pode aparecer como sucessora de várias posições.
