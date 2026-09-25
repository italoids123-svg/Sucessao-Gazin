export type Nivel = string;

export interface Chair {
  id: string;
  nome: string; // ocupante atual, "" se vaga
  cargo: string;
  nivel: Nivel;
  diretoria: string;
  cidade: string;
  tempoCasa: number | null;
  prefixLocalidade: boolean; // cargo repetido em várias cadeiras (ex.: "Gerente regional")
  vago?: boolean;
  gestor?: string;
  gestorCargo?: string;
}

export interface Person {
  id: string;
  nome: string;
  nivel: Nivel;
  cargo: string;
  diretoria: string;
  chairId: string | null; // cadeira principal
  chairIds?: string[]; // todas as cadeiras que ocupa (ex.: Controller + Diretoria financeira)
}

export interface HierarquiaEntry {
  nivel: string; // nível da posição-alvo
  elegivel: string; // nível que pode suceder essa posição
}

export type Horizonte = "imediato" | "ate3" | "3a5" | "mais5" | "";
export type Mobilidade = "local" | "matriz" | "estado" | "qualquer" | "";
export type ConversaDesenvolvimento = "andamento" | "sem_formalizar" | "nao" | "";
export type Continuidade = "imediata" | "com_suporte" | "nao_identifico" | "sem_elementos" | "";
export type DesempenhoCode = string; // código de DESEMPENHO (config.ts), "" quando não avaliado

export interface SuccessionRecord {
  prioridade1?: string;
  horizonte1?: Horizonte;
  desenvolvimento1?: string;
  prioridade2?: string;
  horizonte2?: Horizonte;
  desenvolvimento2?: string;
  localidadeAtual?: string;
  mobilidade?: Mobilidade;
  conversaDesenvolvimento?: ConversaDesenvolvimento;
  continuidade?: Continuidade;
  possivelSucessorTexto?: string;
  desempenho?: DesempenhoCode; // avaliação de desempenho do ciclo atual
  lideraEquipe?: boolean;
  clima2026?: number | ""; // resultado da pesquisa de clima 2026 da área, em % (0 a 100)
}
export type SuccessionMap = Record<string, SuccessionRecord>;

export interface AppData {
  chairs: Chair[];
  people: Person[];
  succession: SuccessionMap;
  hierarquia: HierarquiaEntry[];
  updatedAt: string | null; // ISO da última importação
}

export type GrupoInteressado = "dentro" | "abaixo" | "fora";

export interface CriterioScore {
  key: string;
  label: string;
  pontos: number;
  max: number;
  aplicavel: boolean;
  detalhe: string;
}

export interface Candidate {
  person: Person;
  record: SuccessionRecord;
  prioridade: 1 | 2 | null; // null = sem interesse declarado, entrou só pela indicação do líder
  horizonte: Horizonte;
  score: number;
  criterios: CriterioScore[];
  indicadoPeloLider: boolean;
  grupo: GrupoInteressado;
}

export interface ChairResult {
  dentro: Candidate[];
  abaixo: Candidate[];
  fora: Candidate[];
}
