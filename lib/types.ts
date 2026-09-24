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
export type Mobilidade = "local" | "sede" | "raio_regional" | "qualquer" | "";
export type ConversaDesenvolvimento = "andamento" | "sem_formalizar" | "nao" | "";
export type Continuidade = "imediata" | "com_suporte" | "nao_identifico" | "sem_elementos" | "";
export type NineBoxCode = string; // "1".."9", "" quando não avaliado

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
  nineBox2025?: NineBoxCode;
  nineBox2026?: NineBoxCode;
  lideraEquipe?: boolean;
  favorabilidade2026?: number | "";
}
export type SuccessionMap = Record<string, SuccessionRecord>;

export interface City {
  nome: string; // "Cidade/UF"
  lat: number;
  lng: number;
}

export interface AppData {
  chairs: Chair[];
  people: Person[];
  succession: SuccessionMap;
  hierarquia: HierarquiaEntry[];
  cities: City[];
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
  prioridade: 1 | 2;
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
