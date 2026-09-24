import type { ConversaDesenvolvimento, Continuidade, HierarquiaEntry, Horizonte, Mobilidade } from "./types.ts";

export const EMPRESA = "Gazin";
export const STORAGE_KEY = "gazin-mapa-sucessorio:v1";
// Incremente sempre que a base padrão (lib/base-data.json) ou a estrutura mudar:
// descarta a base antiga salva no navegador.
export const BASE_DATA_VERSION = 1;

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
    descricao: "Posições técnicas críticas sem liderança formal (TI e dados).",
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
export const HIERARQUIA_PADRAO: HierarquiaEntry[] = [
  { nivel: "Diretoria", elegivel: "Gerência Executiva" },
  { nivel: "Diretoria", elegivel: "Gerência" },
  { nivel: "Gerência Executiva", elegivel: "Gerência" },
  { nivel: "Gerência", elegivel: "Coordenação" },
  { nivel: "Gerência", elegivel: "Supervisão" },
  { nivel: "Gerência", elegivel: "Especialista" },
  { nivel: "Coordenação", elegivel: "Supervisão" },
  { nivel: "Coordenação", elegivel: "Especialista" },
  { nivel: "Coordenação", elegivel: "Analista / Técnico" },
  { nivel: "Supervisão", elegivel: "Analista / Técnico" },
  { nivel: "Especialista", elegivel: "Analista / Técnico" },
];

// ---------- Pontuação de aderência ----------
export const PESOS = {
  nineBox: 40,
  indicacao: 20,
  favorabilidade: 10,
  interesse: 10,
  mobilidade: 20,
};
export const CORTE_ADERENCIA = 60;
// Peso de cada ciclo quando os dois têm avaliação.
export const PESO_CICLO_ANTERIOR = 0.375;
export const PESO_CICLO_ATUAL = 0.625;

export const NINE_BOX: { code: string; label: string; fator: number }[] = [
  { code: "9", label: "Alto desempenho · Alto potencial", fator: 1 },
  { code: "8", label: "Médio desempenho · Alto potencial", fator: 0.8 },
  { code: "7", label: "Alto desempenho · Médio potencial", fator: 0.8 },
  { code: "6", label: "Médio desempenho · Médio potencial", fator: 0.6 },
  { code: "5", label: "Baixo desempenho · Alto potencial", fator: 0.5 },
  { code: "4", label: "Alto desempenho · Baixo potencial", fator: 0.5 },
  { code: "3", label: "Baixo desempenho · Médio potencial", fator: 0.25 },
  { code: "2", label: "Médio desempenho · Baixo potencial", fator: 0.25 },
  { code: "1", label: "Baixo desempenho · Baixo potencial", fator: 0 },
];

export const HORIZONTE: { code: Exclude<Horizonte, "">; label: string; pontos: number }[] = [
  { code: "imediato", label: "Imediato (até 1 ano)", pontos: 10 },
  { code: "ate3", label: "Até 3 anos", pontos: 7 },
  { code: "3a5", label: "De 3 a 5 anos", pontos: 4 },
  { code: "mais5", label: "Mais de 5 anos", pontos: 2 },
];

export const SEDE = "Douradina/PR";
export const RAIO_REGIONAL_KM = 40;
export const FATOR_RODOVIARIO = 1.2;

export const MOBILIDADE: { code: Exclude<Mobilidade, "">; label: string }[] = [
  { code: "local", label: "Somente na minha cidade atual" },
  { code: "sede", label: `Somente na sede (${SEDE})` },
  { code: "raio_regional", label: `Até ${RAIO_REGIONAL_KM} km da minha cidade atual` },
  { code: "qualquer", label: "Qualquer unidade" },
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
