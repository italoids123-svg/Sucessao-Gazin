import type { ConversaDesenvolvimento, Continuidade, HierarquiaEntry, Horizonte, Mobilidade } from "./types.ts";

export const EMPRESA = "Gazin";
export const STORAGE_KEY = "gazin-mapa-sucessorio:v1";
// Incremente sempre que a base padrão (lib/base-data.json) ou a estrutura mudar:
// descarta a base antiga salva no navegador.
export const BASE_DATA_VERSION = 7;

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
// Dois perfis, cada um somando 100. Muda só o critério de 30 pontos:
// líderes são avaliados pela favorabilidade (clima da área); não líderes, pela avaliação de pares.
// Mobilidade continua mapeada (e filtra as posições alcançáveis), mas não pontua.
export type Perfil = "lider" | "naoLider";
export const PESOS = {
  desempenho: 50,
  indicacaoLider: 5,
  interesse: 5,
  avaliacaoArea: 30, // favorabilidade (líder) ou avaliação de pares (não líder)
  prontidao: 10,
  mobilidade: 0,
};
export const CRITERIO_AREA: Record<Perfil, { titulo: string; sub: string }> = {
  lider: { titulo: "Favorabilidade", sub: "clima da área" },
  naoLider: { titulo: "Avaliação de pares", sub: "pares da área" },
};
export const PERFIL_LABEL: Record<Perfil, string> = { lider: "Líder", naoLider: "Não líder" };
export const CORTE_ADERENCIA = 60;

/** Avaliação de desempenho 2026 (0 a 100%): pontos proporcionais ao resultado. */
export function pontosDesempenho(resultado: number): number {
  return (Math.max(0, Math.min(100, resultado)) / 100) * PESOS.desempenho;
}

// Favorabilidade e avaliação de pares (0 a 100%): mesmas faixas, para que líderes e não líderes
// que disputam a mesma posição sejam medidos na mesma régua.
export const AREA_FAIXAS: { label: string; ate: number; pontos: number }[] = [
  { label: "Abaixo de 30%", ate: 29.999, pontos: 6 },
  { label: "30% a 50%", ate: 50, pontos: 13 },
  { label: "51% a 85%", ate: 85, pontos: 21 },
  { label: "Acima de 85%", ate: Infinity, pontos: 30 },
];
export function pontosArea(resultado: number): number {
  return AREA_FAIXAS.find((f) => resultado <= f.ate)!.pontos;
}

export const HORIZONTE: { code: Exclude<Horizonte, "">; label: string; pontos: number }[] = [
  { code: "imediato", label: "Imediato", pontos: 10 },
  { code: "ate3", label: "Até 3 anos", pontos: 6 },
  { code: "3a5", label: "Mais de 3 até 5 anos", pontos: 3 },
  { code: "mais5", label: "Mais de 5 anos", pontos: 1.5 },
];

export const SEDE = "Douradina/PR";

// Onde a pessoa aceita atuar. Não pontua; define em quais posições ela pode aparecer.
export const MOBILIDADE: { code: Exclude<Mobilidade, "">; label: string }[] = [
  { code: "local", label: "Local atual" },
  { code: "matriz", label: `Matriz (${SEDE})` },
  { code: "estado", label: "Dentro do Estado" },
  { code: "qualquer", label: "Total (qualquer unidade)" },
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
