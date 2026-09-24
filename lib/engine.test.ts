import assert from "node:assert/strict";
import { test } from "node:test";
import { HIERARQUIA_PADRAO, SEDE } from "./config.ts";
import { buildCtx, buildHierMap, planoDesenvolvimento, successorsFor, textoIndicaPessoa } from "./engine.ts";
import { avaliarMobilidade, buildCoordIndex, mobilidadeAlcancaCidade } from "./geo.ts";
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
    ],
    succession: {
      lider: { possivelSucessorTexto: "Carlos Lima, talvez Beatriz" },
      sup: {
        prioridade1: "Gerente regional", horizonte1: "imediato", mobilidade: "local",
        nineBox2025: "9", nineBox2026: "9", lideraEquipe: true, favorabilidade2026: 80,
        conversaDesenvolvimento: "andamento",
      },
      coord: { prioridade1: "gerente  REGIONAL", horizonte1: "mais5", mobilidade: "qualquer", nineBox2026: "5" },
      analista: { prioridade2: "Gerente regional", horizonte2: "ate3", mobilidade: "" },
    },
    hierarquia: HIERARQUIA_PADRAO,
    cities: [
      { nome: "Maringá/PR", lat: -23.42, lng: -51.93 },
      { nome: "Cuiabá/MT", lat: -15.6, lng: -56.1 },
    ],
    updatedAt: null,
  };
}

test("hierarquia agrupa múltiplos níveis elegíveis", () => {
  assert.deepEqual(buildHierMap(HIERARQUIA_PADRAO)["Gerência"], ["Coordenação", "Supervisão", "Especialista"]);
});

test("cadeira em Maringá: grupos, indicação e pontuação", () => {
  const r = successorsFor(base().chairs[0], buildCtx(base()));
  // Supervisor: 9box 40 + indicação 20 + fav 8 + interesse 10 + mobilidade 20 = 98
  assert.equal(r.dentro.length, 1);
  assert.equal(r.dentro[0].person.id, "sup");
  assert.equal(r.dentro[0].score, 98);
  assert.equal(r.dentro[0].indicadoPeloLider, true);
  // Coordenação: 9box 5 => 20 + interesse 2 + mobilidade 20 = 42 de 90 (não lidera equipe) => 47
  assert.equal(r.abaixo.length, 1);
  assert.equal(r.abaixo[0].score, 47);
  // "Beatriz" sozinho não é indicação (um termo só)
  assert.equal(r.abaixo[0].indicadoPeloLider, false);
  // Analista: nível não alimenta Gerência; mobilidade vazia não bloqueia
  assert.equal(r.fora.map((c) => c.person.id).join(), "analista");
});

test("mobilidade local filtra cadeira em outra cidade", () => {
  const r = successorsFor(base().chairs[1], buildCtx(base()));
  assert.equal(r.dentro.length + r.abaixo.length + r.fora.length, 2);
  assert.ok(![...r.dentro, ...r.abaixo].some((c) => c.person.id === "sup"));
});

test("ocupante nunca é sucessor da própria cadeira", () => {
  const d = base();
  d.succession.lider = { ...d.succession.lider, prioridade1: "Gerente regional", mobilidade: "qualquer" };
  const r = successorsFor(d.chairs[0], buildCtx(d));
  assert.ok(![...r.dentro, ...r.abaixo, ...r.fora].some((c) => c.person.id === "lider"));
});

test("regras de mobilidade independentes", () => {
  const idx = buildCoordIndex([
    { nome: "Perto/PR", lat: -23.5, lng: -53.3 }, // ~13 km da sede
    { nome: "Umuarama/PR", lat: -23.766, lng: -53.325 }, // ~43 km em linha reta
    { nome: "Maringá/PR", lat: -23.42, lng: -51.93 },
  ]);
  assert.equal(avaliarMobilidade(SEDE, SEDE, "sede", idx), "alcanca");
  assert.equal(avaliarMobilidade("Umuarama/PR", "Umuarama/PR", "sede", idx), "nao_alcanca");
  assert.equal(avaliarMobilidade("Douradina - PR", "Perto/PR", "raio_regional", idx), "alcanca");
  assert.equal(avaliarMobilidade(SEDE, "Umuarama/PR", "raio_regional", idx), "nao_alcanca");
  assert.equal(avaliarMobilidade(SEDE, "Maringá/PR", "raio_regional", idx), "nao_alcanca");
  assert.equal(avaliarMobilidade(SEDE, "Cidade Nova/XX", "raio_regional", idx), "indeterminado");
  assert.equal(mobilidadeAlcancaCidade(SEDE, "", "local", idx), true);
});

test("texto do líder casa nome parcial com dois termos", () => {
  assert.ok(textoIndicaPessoa("João Silva", "João Carlos da Silva"));
  assert.ok(!textoIndicaPessoa("João", "João Carlos da Silva"));
  assert.ok(!textoIndicaPessoa("Maria Silva", "João Carlos da Silva"));
});

test("plano de desenvolvimento considera nível e alimentadores", () => {
  const p = planoDesenvolvimento("Gerência", buildCtx(base()));
  assert.deepEqual(p, { ativos: 1, total: 3, pct: 33 });
});
