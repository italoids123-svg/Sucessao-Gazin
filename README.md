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
   Base de dados, Cidades, Hierarquia e Valores aceitos.
3. **Importação**: *Carregar base preenchida* faz merge aditivo (só atualiza quem está na planilha;
   célula vazia não apaga valor salvo). Avisos de valores não reconhecidos vão para o console.

## Estrutura

- `lib/config.ts` — níveis, hierarquia de elegibilidade, pesos, corte, escalas (Nine Box, horizonte,
  mobilidade) e cidade-sede. **Todos os parâmetros de negócio ficam aqui.**
- `lib/engine.ts` — elegibilidade, pontuação e os três grupos de interessados por posição.
- `lib/geo.ts` — regra de mobilidade (`mobilidadeAlcancaCidade`), pura e testável.
- `lib/excel.ts` — geração e importação da planilha.
- `lib/store.tsx` — estado global + persistência versionada no `localStorage`.
- `components/` e `app/` — Visão geral, uma página por nível, modal da posição e metodologia.
- `scripts/build-base.py` — conversão da planilha de posições críticas (inclui a regra de nível).

## Premissas a validar com a Gazin

- **Nível** não existe na planilha de origem; foi derivado do cargo e da linha de reporte
  (regra em `scripts/build-base.py` e na página *Elegibilidade e Aderência*).
- **Hierarquia de elegibilidade**, **pesos**, **corte (60)** e **régua do Nine Box** são padrão do
  modelo e precisam ser confirmados pelo RH.
- **Sede**: Douradina/PR.
- **Cidade das posições** não existe na origem: até ser preenchida (aba Cadeiras), a mobilidade não
  filtra ninguém e uma mesma pessoa pode aparecer como sucessora de várias posições do mesmo cargo.
