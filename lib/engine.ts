import { CORTE_ADERENCIA, HORIZONTE, NINE_BOX, PESOS, PESO_CICLO_ANTERIOR, PESO_CICLO_ATUAL } from "./config.ts";
import { avaliarMobilidade, buildCoordIndex, type CoordIndex } from "./geo.ts";
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
  coords: CoordIndex;
  chairsById: Map<string, Chair>;
}

export function buildCtx(data: AppData): EngineCtx {
  return {
    chairs: data.chairs,
    people: data.people,
    peopleById: new Map(data.people.map((p) => [p.id, p])),
    succession: data.succession,
    hierMap: buildHierMap(data.hierarquia),
    coords: buildCoordIndex(data.cities),
    chairsById: new Map(data.chairs.map((c) => [c.id, c])),
  };
}

function chairIdsOf(p: Person): string[] {
  return p.chairIds?.length ? p.chairIds : p.chairId ? [p.chairId] : [];
}

/** Ocupante da cadeira (quem responde "possível sucessor" por ela). */
export function occupantOf(chair: Chair, ctx: EngineCtx): Person | undefined {
  return ctx.people.find((p) => chairIdsOf(p).includes(chair.id));
}

/** Cidade de referência da pessoa: a declarada no questionário, senão a da cadeira que ocupa. */
export function cidadeDaPessoa(p: Person, rec: SuccessionRecord | undefined, ctx: EngineCtx): string {
  if (rec?.localidadeAtual) return rec.localidadeAtual;
  return p.chairId ? (ctx.chairsById.get(p.chairId)?.cidade ?? "") : "";
}

const STOP = new Set(["DA", "DE", "DO", "DOS", "DAS", "E"]);
const tokens = (s: string) => norm(s).split(/[^A-Z]+/).filter((t) => t && !STOP.has(t));

/**
 * O texto livre do líder cita o candidato? Cada trecho separado por vírgula, ";", "/", " e " ou
 * quebra de linha é comparado ao nome: mesmo primeiro nome e todos os demais termos do trecho
 * presentes no nome completo, com pelo menos dois termos (evita casar só pelo primeiro nome).
 */
export function textoIndicaPessoa(texto: string | undefined, nomeCompleto: string): boolean {
  if (!texto) return false;
  const nome = tokens(nomeCompleto);
  if (nome.length === 0) return false;
  return norm(texto)
    .split(/[,;/\n]| E | OU /)
    .map(tokens)
    .some((t) => t.length >= 2 && t[0] === nome[0] && t.every((x) => nome.includes(x)));
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

function nineBoxFator(code: string | undefined): number | null {
  if (!code) return null;
  return NINE_BOX.find((n) => n.code === String(code))?.fator ?? null;
}

export function pontuar(
  person: Person,
  rec: SuccessionRecord,
  chair: Chair,
  horizonte: Horizonte,
  indicado: boolean,
  ctx: EngineCtx,
): { score: number; criterios: CriterioScore[] } {
  const criterios: CriterioScore[] = [];

  const f25 = nineBoxFator(rec.nineBox2025);
  const f26 = nineBoxFator(rec.nineBox2026);
  let fator = 0;
  let det = "Sem avaliação registrada";
  if (f25 !== null && f26 !== null) {
    fator = PESO_CICLO_ANTERIOR * f25 + PESO_CICLO_ATUAL * f26;
    det = `2025: quadrante ${rec.nineBox2025} · 2026: quadrante ${rec.nineBox2026}`;
  } else if (f26 !== null) {
    fator = f26;
    det = `2026: quadrante ${rec.nineBox2026}`;
  } else if (f25 !== null) {
    fator = f25;
    det = `2025: quadrante ${rec.nineBox2025}`;
  }
  criterios.push({ key: "nineBox", label: "Nine Box", pontos: fator * PESOS.nineBox, max: PESOS.nineBox, aplicavel: true, detalhe: det });

  criterios.push({
    key: "indicacao",
    label: "Indicação do líder",
    pontos: indicado ? PESOS.indicacao : 0,
    max: PESOS.indicacao,
    aplicavel: true,
    detalhe: indicado ? "Indicado nominalmente pelo ocupante atual" : "Não indicado pelo ocupante atual",
  });

  const lidera = rec.lideraEquipe === true;
  const fav = typeof rec.favorabilidade2026 === "number" ? Math.max(0, Math.min(100, rec.favorabilidade2026)) : null;
  criterios.push({
    key: "favorabilidade",
    label: "Favorabilidade do time",
    pontos: lidera && fav !== null ? (fav / 100) * PESOS.favorabilidade : 0,
    max: PESOS.favorabilidade,
    aplicavel: lidera,
    detalhe: !lidera ? "Não lidera equipe: critério não se aplica" : fav === null ? "Sem resultado de clima" : `${fav}% de favorabilidade`,
  });

  const h = HORIZONTE.find((x) => x.code === horizonte);
  criterios.push({
    key: "interesse",
    label: "Interesse declarado",
    pontos: h?.pontos ?? 0,
    max: PESOS.interesse,
    aplicavel: true,
    detalhe: h ? `Horizonte: ${h.label}` : "Horizonte não informado",
  });

  const mob = avaliarMobilidade(cidadeDaPessoa(person, rec, ctx), chair.cidade, rec.mobilidade, ctx.coords);
  criterios.push({
    key: "mobilidade",
    label: "Mobilidade geográfica",
    pontos: mob === "alcanca" ? PESOS.mobilidade : 0,
    max: PESOS.mobilidade,
    aplicavel: mob !== "indeterminado",
    detalhe:
      mob === "alcanca"
        ? "Mobilidade alcança a cidade da posição"
        : mob === "nao_alcanca"
          ? "Mobilidade não alcança a cidade da posição"
          : "Sem dado de cidade/mobilidade: critério fora da base",
  });

  const aplic = criterios.filter((c) => c.aplicavel);
  const max = aplic.reduce((s, c) => s + c.max, 0);
  const pts = aplic.reduce((s, c) => s + c.pontos, 0);
  return { score: max ? Math.round((pts / max) * 100) : 0, criterios };
}

export function successorsFor(chair: Chair, ctx: EngineCtx): ChairResult {
  const res: ChairResult = { dentro: [], abaixo: [], fora: [] };
  const elegiveis = ctx.hierMap[chair.nivel] ?? [];
  const ocupante = occupantOf(chair, ctx);
  const textoLider = ocupante ? ctx.succession[ocupante.id]?.possivelSucessorTexto : undefined;

  for (const p of ctx.people) {
    if (chairIdsOf(p).includes(chair.id)) continue;
    const rec = ctx.succession[p.id];
    if (!rec) continue;
    const interesse = interesseNaCadeira(rec, chair);
    if (!interesse) continue;
    // Mobilidade é filtro para os três grupos: quem declarou que não vai até a cidade da posição
    // não é sucessor dela. Sem dado geográfico, não bloqueia.
    if (avaliarMobilidade(cidadeDaPessoa(p, rec, ctx), chair.cidade, rec.mobilidade, ctx.coords) === "nao_alcanca") continue;

    const indicado = textoIndicaPessoa(textoLider, p.nome);
    const { score, criterios } = pontuar(p, rec, chair, interesse.horizonte, indicado, ctx);
    const grupo = !elegiveis.includes(p.nivel) ? "fora" : score >= CORTE_ADERENCIA ? "dentro" : "abaixo";
    res[grupo].push({ person: p, record: rec, ...interesse, score, criterios, indicadoPeloLider: indicado, grupo });
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
