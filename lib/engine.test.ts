import assert from "node:assert/strict";
import { test } from "node:test";
import { HIERARQUIA_PADRAO, SEDE, pontosArea, pontosDesempenho } from "./config.ts";
import { buildCtx, buildHierMap, perfilDe, planoDesenvolvimento, successorsFor, textoIndicaPessoa } from "./engine.ts";
import { avaliarMobilidade, mobilidadeAlcancaCidade, ufDe } from "./geo.ts";
import type { AppData, Chair, Person } from "./types.ts";

const chair = (id: string, cargo: string, nivel: string, cidade = ""): Chair => ({
  id, nome: "", cargo, nivel, diretoria: "X", cidade, tempoCasa: null, prefixLocalidade: false,
});
const person = (id: string, nome: string, nivel: string, chairId: string | null = null): Person => ({
  id, nome, nivel, cargo: "", diretoria: "X", chairId, chairIds: chairId ? [chairId] : [],
});

function base(): AppData {
  return {
    chairs: [
      chair("g1", "Gerente regional", "Gerência", "Maringá/PR"),
      chair("g2", "Gerente regional", "Gerência", "Cuiabá/MT"),
      chair("s1", "Supervisor administrativo", "Supervisão", "Maringá/PR"),
    ],
    people: [
      person("lider", "Ana Paula Souza", "Gerência", "g1"),
      person("sup", "Carlos Eduardo Lima", "Supervisão", "s1"),
      person("coord", "Beatriz Nunes", "Coordenação"),
      person("analista", "Diego Alves", "Analista / Técnico"),
      person("espec", "Eduardo Ramos", "Especialista"),
    ],
    succession: {
      lider: { possivelSucessorTexto: "Carlos Lima, talvez Beatriz; Eduardo Ramos" },
      sup: {
        prioridade1: "Gerente regional", horizonte1: "imediato", mobilidade: "local",
        desempenho2026: 90, lideraEquipe: true, favorabilidade2026: 90, conversaDesenvolvimento: "andamento",
      },
      coord: { prioridade1: "gerente  REGIONAL", horizonte1: "mais5", mobilidade: "qualquer", desempenho2026: 60, pares2026: 40 },
      analista: { prioridade2: "Gerente regional", horizonte2: "ate3", mobilidade: "" },
      espec: { desempenho2026: 100, pares2026: 90, mobilidade: "estado", localidadeAtual: "Londrina - PR" },
    },
    hierarquia: HIERARQUIA_PADRAO,
    updatedAt: null,
  };
}

test("hierarquia agrupa múltiplos níveis elegíveis", () => {
  assert.deepEqual(buildHierMap(HIERARQUIA_PADRAO)["Gerência"], ["Coordenação", "Supervisão", "Especialista"]);
});

test("coordenação, supervisão e especialista se alimentam entre si", () => {
  const h = buildHierMap(HIERARQUIA_PADRAO);
  for (const n of ["Coordenação", "Supervisão", "Especialista"])
    assert.deepEqual(h[n], ["Coordenação", "Supervisão", "Especialista", "Analista / Técnico"]);
  assert.deepEqual(h["Diretoria"], ["Gerência Executiva", "Gerência"]);
});

test("cadeira em Maringá: pontuação pelo modelo de critérios", () => {
  const r = successorsFor(base().chairs[0], buildCtx(base()));
  // Supervisor (líder): desempenho 90% = 45 + líder 5 + favorabilidade 90% = 30 + interesse 5 + prontidão 10 = 95
  // Especialista (não líder) só indicado pelo líder: 50 + 5 + pares 90% = 30 + 0 + 0 = 85
  assert.deepEqual(r.dentro.map((c) => [c.person.id, c.score, c.prioridade, c.perfil]), [
    ["sup", 95, 1, "lider"],
    ["espec", 85, null, "naoLider"],
  ]);
  assert.ok(r.dentro.every((c) => c.indicadoPeloLider));
  // Coordenação (não líder, sem posição): 60% = 30 + 0 + pares 40% = 13 + 5 + 1,5 = 49,5 ("Beatriz" sozinho não indica)
  assert.deepEqual(r.abaixo.map((c) => [c.person.id, c.score, c.indicadoPeloLider]), [["coord", 49.5, false]]);
  // Analista: nível não alimenta Gerência; mobilidade vazia não filtra. 5 + 6 = 11
  assert.deepEqual(r.fora.map((c) => [c.person.id, c.score]), [["analista", 11]]);
  // Mobilidade continua mapeada, mas não soma pontos
  assert.ok(r.dentro.every((c) => c.criterios.find((k) => k.key === "mobilidade")!.pontos === 0));
});

test("mobilidade filtra por cidade e por UF", () => {
  const r = successorsFor(base().chairs[1], buildCtx(base()));
  const ids = [...r.dentro, ...r.abaixo, ...r.fora].map((c) => c.person.id).sort();
  assert.deepEqual(ids, ["analista", "coord"]);
});

test("ocupante nunca é sucessor da própria cadeira", () => {
  const d = base();
  d.succession.lider = { ...d.succession.lider, prioridade1: "Gerente regional", mobilidade: "qualquer" };
  const r = successorsFor(d.chairs[0], buildCtx(d));
  assert.ok(![...r.dentro, ...r.abaixo, ...r.fora].some((c) => c.person.id === "lider"));
});

test("regras de mobilidade independentes", () => {
  assert.equal(ufDe("Douradina - PR"), "PR");
  assert.equal(avaliarMobilidade(SEDE, SEDE, "matriz"), "alcanca");
  assert.equal(avaliarMobilidade("Umuarama/PR", "Umuarama/PR", "matriz"), "nao_alcanca");
  assert.equal(avaliarMobilidade("Douradina - PR", "Maringá/PR", "estado"), "alcanca");
  assert.equal(avaliarMobilidade(SEDE, "Cuiabá/MT", "estado"), "nao_alcanca");
  assert.equal(avaliarMobilidade(SEDE, "Cidade sem UF", "estado"), "indeterminado");
  assert.equal(avaliarMobilidade("Maringá/PR", "Umuarama/PR", "local"), "nao_alcanca");
  assert.equal(mobilidadeAlcancaCidade(SEDE, "", "local"), true);
});

test("faixas de favorabilidade e avaliação de pares", () => {
  assert.deepEqual([0, 29.5, 30, 50, 51, 85, 86, 100].map(pontosArea), [6, 6, 13, 13, 21, 21, 30, 30]);
});

test("desempenho pontua proporcional ao resultado", () => {
  assert.deepEqual([0, 73, 100, 120, -5].map(pontosDesempenho), [0, 36.5, 50, 50, 0]);
});

test("perfil: resposta do questionário, senão a posição ocupada", () => {
  const d = base();
  const p = (id: string) => d.people.find((x) => x.id === id)!;
  assert.equal(perfilDe(p("lider"), {}), "lider"); // ocupa posição de Gerência
  assert.equal(perfilDe(p("espec"), {}), "naoLider"); // sem posição
  assert.equal(perfilDe(p("lider"), { lideraEquipe: false }), "naoLider");
  assert.equal(perfilDe(p("analista"), { lideraEquipe: true }), "lider");
});

test("texto do líder casa nome parcial com dois termos", () => {
  assert.ok(textoIndicaPessoa("João Silva", "João Carlos da Silva"));
  assert.ok(!textoIndicaPessoa("João", "João Carlos da Silva"));
  assert.ok(!textoIndicaPessoa("Maria Silva", "João Carlos da Silva"));
});

test("nome indicado ambíguo só vale para quem se indicou à posição", () => {
  const d = base();
  d.people.push(person("homonimo", "Carlos Augusto Lima", "Supervisão"));
  d.succession.homonimo = { desempenho2026: 100 };
  const r = successorsFor(d.chairs[0], buildCtx(d));
  const todos = [...r.dentro, ...r.abaixo, ...r.fora];
  assert.ok(!todos.some((c) => c.person.id === "homonimo"));
  assert.ok(todos.find((c) => c.person.id === "sup")!.indicadoPeloLider);
});

test("plano de desenvolvimento considera nível e alimentadores", () => {
  const p = planoDesenvolvimento("Gerência", buildCtx(base()));
  assert.deepEqual(p, { ativos: 1, total: 4, pct: 25 });
});
