import type { ConversaDesenvolvimento, Continuidade, HierarquiaEntry, Horizonte, Mobilidade } from "./types.ts";

export const EMPRESA = "Gazin";
export const STORAGE_KEY = "gazin-mapa-sucessorio:v1";
// Incremente sempre que a base padrão (lib/base-data.json) ou a estrutura mudar:
// descarta a base antiga salva no navegador.
export const BASE_DATA_VERSION = 9;

export interface NivelDef {
  nome: string;
  slug: string;
  descricao: string;
  temPagina: boolean; // níveis sem cadeiras críticas existem só como origem de sucessores
}

export const NIVEIS: NivelDef[] = [
  { nome: "Presidência", slug: "presidencia", descricao: "Presidência da empresa.", temPagina: true },
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
  { nivel: "Presidência", elegivel: "Diretoria" },
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
// 100 pontos: desempenho 40 (autoavaliação 10 + avaliação do gestor 30), pesquisa de clima 40,
// indicação do líder 5, interesse declarado 5 e prontidão declarada 10.
// A pesquisa de clima muda de fonte conforme o perfil: líderes são avaliados pela equipe que lideram;
// não líderes, pelo departamento em que atuam (potencial para futuras posições de liderança).
// Mobilidade continua mapeada, sem pontos.
export type Perfil = "lider" | "naoLider";
export const PESOS = {
  autoavaliacao: 10,
  avaliacaoGestor: 30,
  desempenho: 40, // autoavaliação + avaliação do gestor
  clima: 40,
  indicacaoLider: 5,
  interesse: 5,
  prontidao: 10,
  mobilidade: 0,
};
export const CLIMA_FONTE: Record<Perfil, { titulo: string; sub: string; descricao: string }> = {
  lider: {
    titulo: "Pesquisa de clima",
    sub: "respondida pela equipe",
    descricao: "pesquisa respondida pelos colaboradores que compõem a equipe",
  },
  naoLider: {
    titulo: "Pesquisa de clima",
    sub: "avaliação do departamento",
    descricao: "avaliação do departamento em que atua, considerando o potencial para futuras posições de liderança",
  },
};
export const PERFIL_LABEL: Record<Perfil, string> = { lider: "Líder", naoLider: "Não líder" };
export const CORTE_ADERENCIA = 60;

const proporcional = (resultado: number, peso: number) => (Math.max(0, Math.min(100, resultado)) / 100) * peso;
/** Autoavaliação (0 a 100%): até 10 pontos, proporcional ao resultado. */
export const pontosAutoavaliacao = (r: number) => proporcional(r, PESOS.autoavaliacao);
/** Avaliação do gestor (0 a 100%): até 30 pontos, proporcional ao resultado. */
export const pontosAvaliacaoGestor = (r: number) => proporcional(r, PESOS.avaliacaoGestor);
/** Pesquisa de clima (0 a 100%): até 40 pontos, proporcional ao resultado. */
export const pontosClima = (r: number) => proporcional(r, PESOS.clima);

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
