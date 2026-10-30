import {
  CLIMA_FONTE,
  CORTE_ADERENCIA,
  HORIZONTE,
  MOBILIDADE,
  PESOS,
  type Perfil,
  pontosAutoavaliacao,
  pontosAvaliacaoGestor,
  pontosClima,
} from "./config.ts";
import { avaliarMobilidade } from "./geo.ts";
import type {
  AppData,
  Candidate,
  Chair,
  ChairResult,
  CriterioScore,
  HierarquiaEntry,
  Horizonte,
  Person,
  SuccessionRecord,
} from "./types.ts";

export function norm(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Agrupa a hierarquia por nível: um nível pode ter vários níveis elegíveis. */
export function buildHierMap(h: HierarquiaEntry[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const e of h) {
    const list = (map[e.nivel] ??= []);
    if (!list.includes(e.elegivel)) list.push(e.elegivel);
  }
  return map;
}

export interface EngineCtx {
  chairs: Chair[];
  people: Person[];
  peopleById: Map<string, Person>;
  succession: AppData["succession"];
  hierMap: Record<string, string[]>;
  chairsById: Map<string, Chair>;
  /** Liderança imediata da lista oficial: nome do colaborador (normalizado) -> nome do líder. */
  lideranca: Map<string, string>;
}

/** Vínculo colaborador -> líder vindo da lista de liderança imediata. */
export interface VinculoLideranca {
  colaborador: string;
  lider: string;
}

export function buildCtx(data: AppData, lideranca: VinculoLideranca[] = []): EngineCtx {
  return {
    chairs: data.chairs,
    people: data.people,
    peopleById: new Map(data.people.map((p) => [p.id, p])),
    succession: data.succession,
    hierMap: buildHierMap(data.hierarquia),
    chairsById: new Map(data.chairs.map((c) => [c.id, c])),
    lideranca: new Map(lideranca.filter((v) => v.lider && norm(v.lider) !== norm(v.colaborador)).map((v) => [norm(v.colaborador), v.lider])),
  };
}

function chairIdsOf(p: Person): string[] {
  return p.chairIds?.length ? p.chairIds : p.chairId ? [p.chairId] : [];
}

/** Ocupante da cadeira (quem responde "possível sucessor" por ela). */
export function occupantOf(chair: Chair, ctx: EngineCtx): Person | undefined {
  return ctx.people.find((p) => chairIdsOf(p).includes(chair.id));
}

/**
 * Gestor imediato, nesta ordem: o informado na planilha de coleta, o da lista de liderança imediata
 * e, por último, o gestor da posição que a pessoa ocupa.
 */
export function gestorDe(p: Person, ctx: EngineCtx): string {
  if (p.gestor) return p.gestor;
  const daLista = ctx.lideranca.get(norm(p.nome));
  if (daLista) return daLista;
  return p.chairId ? (ctx.chairsById.get(p.chairId)?.gestor ?? "") : "";
}

/**
 * Quem responde a quem, por nome normalizado: as pessoas da base (com `gestorDe`) mais quem só está
 * na lista de liderança. Assim a equipe inclui quem não está na base, sem inventar nível ou cargo.
 */
export function mapaDeLideranca(ctx: EngineCtx): Map<string, string> {
  const mapa = new Map(ctx.lideranca);
  for (const p of ctx.people) {
    const g = gestorDe(p, ctx);
    if (g) mapa.set(norm(p.nome), g);
  }
  return mapa;
}

/**
 * Equipe de um gestor (nomes normalizados): subordinados diretos ou, com `indiretos`, toda a cadeia
 * abaixo dele. Compara nomes sem acento e sem diferença de maiúsculas.
 */
export function equipeDe(gestor: string, ctx: EngineCtx, indiretos: boolean): Set<string> {
  const porGestor = new Map<string, string[]>();
  for (const [colab, g] of mapaDeLideranca(ctx)) {
    const k = norm(g);
    if (!porGestor.has(k)) porGestor.set(k, []);
    porGestor.get(k)!.push(colab);
  }
  const equipe = new Set<string>();
  const fila = [norm(gestor)];
  while (fila.length) {
    for (const n of porGestor.get(fila.shift()!) ?? []) {
      if (equipe.has(n) || n === norm(gestor)) continue;
      equipe.add(n);
      if (indiretos) fila.push(n);
    }
  }
  return equipe;
}

export function cidadeDaPessoa(p: Person, rec: SuccessionRecord | undefined, ctx: EngineCtx): string {
  if (rec?.localidadeAtual) return rec.localidadeAtual;
  return p.chairId ? (ctx.chairsById.get(p.chairId)?.cidade ?? "") : "";
}

const STOP = new Set(["DA", "DE", "DO", "DOS", "DAS", "E"]);
const tokens = (s: string) => norm(s).split(/[^A-Z]+/).filter((t) => t && !STOP.has(t));

function trechosDoTexto(texto: string): string[][] {
  return norm(texto)
    .split(/[,;/\n]| E | OU /)
    .map(tokens)
    .filter((t) => t.length >= 2);
}

function trechoCasaNome(trecho: string[], nome: string[]): boolean {
  return trecho[0] === nome[0] && trecho.every((x) => nome.includes(x));
}

/**
 * O texto livre do líder cita o candidato? Cada trecho separado por vírgula, ";", "/", " e " ou
 * quebra de linha é comparado ao nome: mesmo primeiro nome e todos os demais termos do trecho
 * presentes no nome completo, com pelo menos dois termos (evita casar só pelo primeiro nome).
 */
export function textoIndicaPessoa(texto: string | undefined, nomeCompleto: string): boolean {
  if (!texto) return false;
  const nome = tokens(nomeCompleto);
  return nome.length > 0 && trechosDoTexto(texto).some((t) => trechoCasaNome(t, nome));
}

export interface IndicacaoResolvida {
  unicos: Set<string>; // pessoas indicadas sem ambiguidade
  ambiguos: { trecho: string; pessoas: Person[] }[]; // trecho que casa com 2+ pessoas da base
}

/** Resolve o texto do líder contra a base inteira, separando indicações únicas das ambíguas (homônimos). */
export function resolverIndicacao(texto: string | undefined, people: Person[]): IndicacaoResolvida {
  const res: IndicacaoResolvida = { unicos: new Set(), ambiguos: [] };
  if (!texto) return res;
  const nomes = people.map((p) => ({ p, t: tokens(p.nome) }));
  for (const trecho of trechosDoTexto(texto)) {
    const hits = nomes.filter(({ t }) => t.length > 0 && trechoCasaNome(trecho, t)).map(({ p }) => p);
    if (hits.length === 1) res.unicos.add(hits[0].id);
    else if (hits.length > 1) res.ambiguos.push({ trecho: trecho.join(" "), pessoas: hits });
  }
  return res;
}

export function interesseNaCadeira(
  rec: SuccessionRecord,
  chair: Chair,
): { prioridade: 1 | 2; horizonte: Horizonte } | null {
  const alvo = norm(chair.cargo);
  if (rec.prioridade1 && norm(rec.prioridade1) === alvo) return { prioridade: 1, horizonte: rec.horizonte1 ?? "" };
  if (rec.prioridade2 && norm(rec.prioridade2) === alvo) return { prioridade: 2, horizonte: rec.horizonte2 ?? "" };
  return null;
}

/**
 * Perfil de pontuação: o "Lidera equipe" do questionário; sem resposta, deduz pela posição ocupada
 * (quem ocupa posição de Supervisão para cima lidera; Especialista e quem não ocupa posição, não).
 */
export function perfilDe(p: Person, rec: SuccessionRecord | undefined): Perfil {
  if (rec?.lideraEquipe === true) return "lider";
  if (rec?.lideraEquipe === false) return "naoLider";
  return chairIdsOf(p).length && p.nivel !== "Especialista" && p.nivel !== "Analista / Técnico" ? "lider" : "naoLider";
}

const numero = (v: number | "" | undefined) => (typeof v === "number" ? v : null);

export function pontuar(
  rec: SuccessionRecord,
  interesse: { prioridade: 1 | 2; horizonte: Horizonte } | null,
  indicado: boolean,
  perfil: Perfil,
): { score: number; criterios: CriterioScore[] } {
  const criterios: CriterioScore[] = [];

  const auto = numero(rec.autoavaliacao2026);
  const gestor = numero(rec.avaliacaoGestor2026);
  const partes = [
    auto === null ? "autoavaliação não informada" : `autoavaliação ${fmtPontos(auto)}%`,
    gestor === null ? "gestor não informado" : `gestor ${fmtPontos(gestor)}%`,
  ];
  criterios.push({
    key: "desempenho",
    label: "Avaliação de desempenho",
    pontos: (auto === null ? 0 : pontosAutoavaliacao(auto)) + (gestor === null ? 0 : pontosAvaliacaoGestor(gestor)),
    max: PESOS.desempenho,
    aplicavel: true,
    detalhe: auto === null && gestor === null ? "Não avaliado em 2026" : partes.join(" · "),
  });

  criterios.push({
    key: "indicacaoLider",
    label: "Indicação do líder da posição",
    pontos: indicado ? PESOS.indicacaoLider : 0,
    max: PESOS.indicacaoLider,
    aplicavel: true,
    detalhe: indicado ? "Indicado nominalmente pelo ocupante atual" : "Não indicado pelo ocupante atual",
  });

  const clima = numero(perfil === "lider" ? rec.climaEquipe2026 : rec.climaDepartamento2026);
  const fonte = CLIMA_FONTE[perfil];
  criterios.push({
    key: "clima",
    label: fonte.titulo,
    pontos: clima === null ? 0 : pontosClima(clima),
    max: PESOS.clima,
    aplicavel: true,
    detalhe: clima === null ? `Sem resultado (${fonte.sub})` : `${fonte.sub}: ${fmtPontos(clima)}%`,
  });

  criterios.push({
    key: "interesse",
    label: "Interesse declarado",
    pontos: interesse ? PESOS.interesse : 0,
    max: PESOS.interesse,
    aplicavel: true,
    detalhe: interesse ? `Declarou interesse (Prioridade ${interesse.prioridade})` : "Não declarou interesse nesta posição",
  });

  const h = interesse ? HORIZONTE.find((x) => x.code === interesse.horizonte) : undefined;
  criterios.push({
    key: "prontidao",
    label: "Prontidão declarada",
    pontos: h?.pontos ?? 0,
    max: PESOS.prontidao,
    aplicavel: true,
    detalhe: h ? `Horizonte: ${h.label}` : interesse ? "Horizonte não informado" : "Sem prontidão declarada para esta posição",
  });

  const mob = MOBILIDADE.find((m) => m.code === rec.mobilidade);
  criterios.push({
    key: "mobilidade",
    label: "Mobilidade",
    pontos: 0,
    max: PESOS.mobilidade,
    aplicavel: true,
    detalhe: mob ? `Mapeada, sem pontuação: ${mob.label}` : "Mobilidade não informada",
  });

  const max = criterios.reduce((s, c) => s + (c.aplicavel ? c.max : 0), 0);
  const pts = criterios.reduce((s, c) => s + (c.aplicavel ? c.pontos : 0), 0);
  // Uma casa decimal: evita que 59,5 vire 60 e passe o corte por arredondamento.
  return { score: max ? Math.round((pts / max) * 1000) / 10 : 0, criterios };
}

export function successorsFor(chair: Chair, ctx: EngineCtx): ChairResult {
  const res: ChairResult = { dentro: [], abaixo: [], fora: [] };
  const elegiveis = ctx.hierMap[chair.nivel] ?? [];
  const ocupante = occupantOf(chair, ctx);
  const indicacao = resolverIndicacao(ocupante ? ctx.succession[ocupante.id]?.possivelSucessorTexto : undefined, ctx.people);

  for (const p of ctx.people) {
    if (chairIdsOf(p).includes(chair.id)) continue;
    const rec = ctx.succession[p.id] ?? {};
    const interesse = interesseNaCadeira(rec, chair);
    // Nome ambíguo (homônimos) só vale para quem também se indicou à posição.
    const indicado =
      indicacao.unicos.has(p.id) || (!!interesse && indicacao.ambiguos.some((a) => a.pessoas.some((x) => x.id === p.id)));
    // Entra quem se indicou à posição OU foi indicado pelo líder dela (o "match" soma as duas pontas).
    if (!interesse && !indicado) continue;
    // Mobilidade é só informativa: não pontua nem impede a pessoa de aparecer. Apenas sinaliza
    // quando a posição fica fora do que ela declarou aceitar.
    const foraDaMobilidade = avaliarMobilidade(cidadeDaPessoa(p, rec, ctx), chair.cidade, rec.mobilidade) === "nao_alcanca";

    const perfil = perfilDe(p, rec);
    const { score, criterios } = pontuar(rec, interesse, indicado, perfil);
    const grupo = !elegiveis.includes(p.nivel) ? "fora" : score >= CORTE_ADERENCIA ? "dentro" : "abaixo";
    res[grupo].push({
      person: p,
      record: rec,
      prioridade: interesse?.prioridade ?? null,
      horizonte: interesse?.horizonte ?? "",
      score,
      criterios,
      indicadoPeloLider: indicado,
      foraDaMobilidade,
      perfil,
      grupo,
    });
  }
  for (const g of [res.dentro, res.abaixo, res.fora]) g.sort((a, b) => b.score - a.score || a.person.nome.localeCompare(b.person.nome));
  return res;
}

export type Cobertura = "verde" | "amarelo" | "vermelho";
export const coberturaDe = (n: number): Cobertura => (n >= 2 ? "verde" : n === 1 ? "amarelo" : "vermelho");

export function resumoCobertura(results: ChairResult[]) {
  const r = { verde: 0, amarelo: 0, vermelho: 0, total: results.length };
  for (const x of results) r[coberturaDe(x.dentro.length)]++;
  return r;
}

/** % de pessoas do nível e dos níveis que o alimentam com conversa de desenvolvimento em andamento. */
export function planoDesenvolvimento(nivel: string, ctx: EngineCtx) {
  const niveis = new Set([nivel, ...(ctx.hierMap[nivel] ?? [])]);
  const pessoas = ctx.people.filter((p) => niveis.has(p.nivel));
  const ativos = pessoas.filter((p) => ctx.succession[p.id]?.conversaDesenvolvimento === "andamento").length;
  return { ativos, total: pessoas.length, pct: pessoas.length ? Math.round((ativos / pessoas.length) * 100) : 0 };
}

export function chairSubtitulo(chair: Chair): string {
  const ocup = chair.vago || !chair.nome ? "Posição vaga" : chair.nome;
  return chair.cidade ? `${ocup} · ${chair.cidade}` : ocup;
}

/** Pontos no formato brasileiro, com no máximo uma casa decimal (78,6; 82; 1,5). */
export function fmtPontos(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
