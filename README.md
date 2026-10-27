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
   (181 posições: as 180 da planilha mais Gerente geral de recursos humanos, incluída em `POSICOES_ADICIONAIS`; 179 ocupantes, 2 vagas: Controller e Gerente adjunto de varejo) por `npm run base -- caminho/Posicoes_Criticas.xlsx`.
   Se a planilha de origem mudar, gere de novo e incremente `BASE_DATA_VERSION` em `lib/config.ts`.
2. **Coleta**: botão *Baixar base para coleta* gera o `.xlsx` com as abas Leia-me, Cadeiras,
   Base de dados, Hierarquia e Valores aceitos.
3. **Importação**: *Carregar base preenchida* faz merge aditivo (só atualiza quem está na planilha;
   célula vazia não apaga valor salvo). Avisos de valores não reconhecidos vão para o console.

## Planilha de exemplo (demonstração)

`exemplos/Gazin_Mapa_Sucessorio_EXEMPLO_FICTICIO.xlsx` já vem no formato de importação: basta clicar em
*Carregar base preenchida*. Nomes e posições são os reais; **todas as respostas são sorteadas** e os 40
analistas/técnicos são pessoas inventadas. Depois da demonstração, use *Limpar base local*.
Para gerar de novo: `npm run exemplo` (semente fixa; `SEMENTE=7 npm run exemplo` gera outro cenário).

## Recursos da tela

- **Busca por pessoa**: todos os interessados, com filtros em listas suspensas de múltipla escolha (cargos por nível atual ou de
  interesse, prontidão, prioridade, mobilidade e cidade) e as posições em que cada um aparece.

- **Tela cheia**: botão na barra superior (sai também com Esc).
- **Imprimir / Exportar**: na barra superior (exporta a página atual) e no detalhe de cada posição
  (exporta só a posição). Escolha **PDF** (páginas A4, sem cortar cartões no meio) ou **PNG**
  (imagem única).

## Estrutura

- `lib/config.ts` — níveis, hierarquia de elegibilidade, pesos, corte, escalas (desempenho, clima,
  prontidão, mobilidade) e cidade-sede. **Todos os parâmetros de negócio ficam aqui.**
- `lib/engine.ts` — elegibilidade, pontuação e os três grupos de interessados por posição.
- `lib/geo.ts` — regra de mobilidade (`mobilidadeAlcancaCidade`), pura e testável.
- `lib/excel.ts` — geração e importação da planilha.
- `lib/store.tsx` — estado global + persistência versionada no `localStorage`.
- `components/` e `app/` — Visão geral, uma página por nível, modal da posição e metodologia.
- `scripts/build-base.py` — conversão da planilha de posições críticas (inclui a regra de nível).

## Critérios de aderência (material "Critérios" da Gazin)

Dois perfis, ambos somando 100 pontos:

| Critério | Líderes | Não líderes |
|---|---|---|
| Avaliação de desempenho 2026 (proporcional ao resultado de 0 a 100%) | 50 | 50 |
| Indicação do líder da posição | 5 | 5 |
| Favorabilidade (clima da área) | 30 | – |
| Avaliação de pares | – | 30 |
| Interesse declarado | 5 | 5 |
| Prontidão declarada | 10 | 10 |
| Mobilidade (mapeada e informativa, sem pontos e sem filtrar posições) | 0 | 0 |

Perfil: coluna "Lidera equipe"; vazia, é líder quem ocupa posição de Supervisão para cima.
Escalas em `lib/config.ts` e na página *Critérios* do app.

## Premissas a validar com a Gazin

- **Nível** não existe na planilha de origem; foi derivado do cargo e da linha de reporte
  (regra em `scripts/build-base.py` e na página *Elegibilidade e Aderência*).
- **Favorabilidade e avaliação de pares** usam a mesma régua de faixas (6/13/21/30), para que líderes e
  não líderes que disputam a mesma posição sejam medidos igual.
- **Entrada na posição**: basta uma ponta do match (se indicou OU foi indicado pelo líder).
  Nome indicado que corresponde a mais de uma pessoa só vale para quem também se indicou.
- **Mobilidade** não pontua nem filtra: a pessoa aparece em qualquer cidade; o detalhe só sinaliza quando a
  posição fica fora do que ela declarou.
- **Hierarquia de elegibilidade**: Coordenação, Supervisão e Especialista se alimentam entre si e a si
  mesmos (movimento lateral dentro da faixa). Gerência, Gerência Executiva e Diretoria continuam só
  com promoção vertical.
- **Nomes de cargos e áreas** foram escritos por extenso, sem abreviações nem siglas (mapa em
  `scripts/build-base.py`, `NOME_POR_EXTENSO`).
- **Corte (60)** não consta do material: é padrão do modelo.
- **Matriz**: Douradina/PR.
- **Cidade das posições** não existe na origem: preencha na aba Cadeiras (formato Cidade/Estado) para o
  detalhe sinalizar quem está fora da mobilidade declarada. Uma mesma pessoa pode aparecer como sucessora
  de várias posições do mesmo cargo.
