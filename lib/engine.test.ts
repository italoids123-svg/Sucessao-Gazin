import assert from "node:assert/strict";
import { test } from "node:test";
import { HIERARQUIA_PADRAO, SEDE, pontosClima } from "./config.ts";
import { buildCtx, buildHierMap, planoDesenvolvimento, successorsFor, textoIndicaPessoa } from "./engine.ts";
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
        desempenho: "estrela", lideraEquipe: true, enps2026: 90, conversaDesenvolvimento: "andamento",
      },
      coord: { prioridade1: "gerente  REGIONAL", horizonte1: "mais5", mobilidade: "qualquer", desempenho: "solido" },
      analista: { prioridade2: "Gerente regional", horizonte2: "ate3", mobilidade: "" },
      espec: { desempenho: "estrela", mobilidade: "estado", localidadeAtual: "Londrina - PR" },
    },
    hierarquia: HIERARQUIA_PADRAO,
    updatedAt: null,
  };
}

test("hierarquia agrupa múltiplos níveis elegíveis", () => {
  assert.deepEqual(buildHierMap(HIERARQUIA_PADRAO)["Gerência"], ["Coordenação", "Supervisão", "Especialista"]);
});

test("cadeira em Maringá: pontuação pelo modelo de critérios", () => {
  const r = successorsFor(base().chairs[0], buildCtx(base()));
  // Supervisor: desempenho 30 + líder 5 + interesse 5 + clima 30 + prontidão 10 + mobilidade local 2 = 82
  // Especialista só indicado pelo líder: 30 + 5 + 0 + (clima n/a) + 0 + estado 13 = 48 de 70 => 69
  assert.deepEqual(r.dentro.map((c) => [c.person.id, c.score, c.prioridade]), [["sup", 82, 1], ["espec", 69, null]]);
  assert.ok(r.dentro.every((c) => c.indicadoPeloLider));
  // Coordenação: 14 + 0 + 5 + 1,5 + 20 = 40,5 de 70 => 58 ("Beatriz" sozinho não é indicação)
  assert.deepEqual(r.abaixo.map((c) => [c.person.id, c.score, c.indicadoPeloLider]), [["coord", 58, false]]);
  // Analista: nível não alimenta Gerência; mobilidade vazia não filtra. 5 + 6 = 11 de 70 => 16
  assert.deepEqual(r.fora.map((c) => [c.person.id, c.score]), [["analista", 16]]);
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

test("faixas de e-NPS", () => {
  assert.deepEqual([-10, 29.5, 30, 50, 51, 85, 86].map(pontosClima), [6, 6, 13, 13, 21, 21, 30]);
});

test("texto do líder casa nome parcial com dois termos", () => {
  assert.ok(textoIndicaPessoa("João Silva", "João Carlos da Silva"));
  assert.ok(!textoIndicaPessoa("João", "João Carlos da Silva"));
  assert.ok(!textoIndicaPessoa("Maria Silva", "João Carlos da Silva"));
});

test("nome indicado ambíguo só vale para quem se indicou à posição", () => {
  const d = base();
  d.people.push(person("homonimo", "Carlos Augusto Lima", "Supervisão"));
  d.succession.homonimo = { desempenho: "estrela" };
  const r = successorsFor(d.chairs[0], buildCtx(d));
  const todos = [...r.dentro, ...r.abaixo, ...r.fora];
  assert.ok(!todos.some((c) => c.person.id === "homonimo"));
  assert.ok(todos.find((c) => c.person.id === "sup")!.indicadoPeloLider);
});

test("plano de desenvolvimento considera nível e alimentadores", () => {
  const p = planoDesenvolvimento("Gerência", buildCtx(base()));
  assert.deepEqual(p, { ativos: 1, total: 4, pct: 25 });
});
