import type { ConversaDesenvolvimento, Continuidade, HierarquiaEntry, Horizonte, Mobilidade } from "./types.ts";

export const EMPRESA = "Gazin";
export const STORAGE_KEY = "gazin-mapa-sucessorio:v1";
// Incremente sempre que a base padrão (lib/base-data.json) ou a estrutura mudar:
// descarta a base antiga salva no navegador.
export const BASE_DATA_VERSION = 4;

export interface NivelDef {
  nome: string;
  slug: string;
  descricao: string;
  temPagina: boolean; // níveis sem cadeiras críticas existem só como origem de sucessores
}

export const NIVEIS: NivelDef[] = [
  { nome: "Diretoria", slug: "diretoria", descricao: "Diretorias e Controller, reportando à Presidência.", temPagina: true },
  {
    nome: "Gerência Executiva",
    slug: "gerencia-executiva",
    descricao: "Gerentes que respondem à Presidência ou que lideram outros gerentes.",
    temPagina: true,
  },
  { nome: "Gerência", slug: "gerencia", descricao: "Gerentes de área, regionais, de unidade e de operação.", temPagina: true },
  { nome: "Coordenação", slug: "coordenacao", descricao: "Coordenadores de área e de operação.", temPagina: true },
  { nome: "Supervisão", slug: "supervisao", descricao: "Supervisores administrativos, comerciais e técnicos.", temPagina: true },
  {
    nome: "Especialista",
    slug: "especialista",
    descricao: "Posições técnicas críticas sem liderança formal (tecnologia da informação e dados).",
    temPagina: true,
  },
  {
    nome: "Analista / Técnico",
    slug: "analista",
    descricao: "Profissionais fora das posições críticas, incluídos pela planilha como potenciais sucessores.",
    temPagina: false,
  },
];

export const NIVEL_NOMES = NIVEIS.map((n) => n.nome);

// Quem pode suceder quem. Um nível pode ter mais de um nível elegível.
// Coordenação, Supervisão e Especialista formam uma mesma faixa: alimentam-se entre si e a si mesmos
// (um especialista pode suceder outro especialista, um coordenador pode ir para supervisão ou
// especialista, e assim por diante).
const FAIXA_TECNICA_E_COORDENACAO = ["Coordenação", "Supervisão", "Especialista"];
export const HIERARQUIA_PADRAO: HierarquiaEntry[] = [
  { nivel: "Diretoria", elegivel: "Gerência Executiva" },
  { nivel: "Diretoria", elegivel: "Gerência" },
  { nivel: "Gerência Executiva", elegivel: "Gerência" },
  ...FAIXA_TECNICA_E_COORDENACAO.map((elegivel) => ({ nivel: "Gerência", elegivel })),
  ...FAIXA_TECNICA_E_COORDENACAO.flatMap((nivel) => [
    ...FAIXA_TECNICA_E_COORDENACAO.map((elegivel) => ({ nivel, elegivel })),
    { nivel, elegivel: "Analista / Técnico" },
  ]),
];

// ---------- Pontuação de aderência (material "Critérios" da Gazin) ----------
// Soma 100. "Match de indicação" = indicação do líder (5) + interesse autodeclarado (5).
export const PESOS = {
  desempenho: 30,
  indicacaoLider: 5,
  interesse: 5,
  clima: 30,
  prontidao: 10,
  mobilidade: 20,
};
export const CORTE_ADERENCIA = 60;

// Avaliação de desempenho do ciclo atual: Resultado × Comportamento.
export const DESEMPENHO: { code: string; label: string; descricao: string; pontos: number }[] = [
  { code: "estrela", label: "Estrela", descricao: "Resultado alto · Comportamento alto", pontos: 30 },
  { code: "alto_desempenho", label: "Alto Desempenho", descricao: "Resultado médio · Comportamento alto", pontos: 26 },
  { code: "comprometido", label: "Empregado Comprometido", descricao: "Resultado baixo · Comportamento alto", pontos: 22 },
  { code: "alto_potencial", label: "Alto Potencial", descricao: "Resultado alto · Comportamento médio", pontos: 18 },
  { code: "solido", label: "Empregado Sólido / Responsável", descricao: "Resultado médio · Comportamento médio", pontos: 14 },
  { code: "bom_executor", label: "Bom Executor / Especialista", descricao: "Resultado baixo · Comportamento médio", pontos: 10 },
  { code: "enigma", label: "Enigma / Questionável", descricao: "Resultado alto · Comportamento baixo", pontos: 6 },
  { code: "eficaz", label: "Empregado Eficaz", descricao: "Resultado médio · Comportamento baixo", pontos: 2 },
  { code: "risco", label: "Risco / Baixo Desempenho", descricao: "Resultado baixo · Comportamento baixo", pontos: 0 },
];

// Pesquisa de clima 2026 (e-NPS da área).
export const CLIMA_FAIXAS: { label: string; ate: number; pontos: number }[] = [
  { label: "Abaixo de 30", ate: 29.999, pontos: 6 },
  { label: "30 a 50", ate: 50, pontos: 13 },
  { label: "51 a 85", ate: 85, pontos: 21 },
  { label: "Acima de 85", ate: Infinity, pontos: 30 },
];
export function pontosClima(enps: number): number {
  return CLIMA_FAIXAS.find((f) => enps <= f.ate)!.pontos;
}

export const HORIZONTE: { code: Exclude<Horizonte, "">; label: string; pontos: number }[] = [
  { code: "imediato", label: "Imediato", pontos: 10 },
  { code: "ate3", label: "Até 3 anos", pontos: 6 },
  { code: "3a5", label: "Mais de 3 até 5 anos", pontos: 3 },
  { code: "mais5", label: "Mais de 5 anos", pontos: 1.5 },
];

export const SEDE = "Douradina/PR";

// Pontos pela amplitude declarada: quem aceita mais lugares amplia as cadeiras que pode suceder.
export const MOBILIDADE: { code: Exclude<Mobilidade, "">; label: string; pontos: number }[] = [
  { code: "local", label: "Local atual", pontos: 2 },
  { code: "matriz", label: `Matriz (${SEDE})`, pontos: 7 },
  { code: "estado", label: "Dentro do Estado", pontos: 13 },
  { code: "qualquer", label: "Total (qualquer unidade)", pontos: 20 },
];

export const CONVERSA: { code: Exclude<ConversaDesenvolvimento, "">; label: string }[] = [
  { code: "andamento", label: "Sim, em andamento" },
  { code: "sem_formalizar", label: "Conversado, sem plano formal" },
  { code: "nao", label: "Não" },
];

export const CONTINUIDADE: { code: Exclude<Continuidade, "">; label: string }[] = [
  { code: "imediata", label: "Alguém assume imediatamente" },
  { code: "com_suporte", label: "Alguém assume com suporte" },
  { code: "nao_identifico", label: "Não identifico sucessor" },
  { code: "sem_elementos", label: "Sem elementos para avaliar" },
];

export function labelOf<T extends { code: string; label: string }>(list: T[], code: string | undefined): string {
  return list.find((i) => i.code === code)?.label ?? "";
}
