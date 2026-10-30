import assert from "node:assert/strict";
import { test } from "node:test";
import { HIERARQUIA_PADRAO, SEDE, pontosAutoavaliacao, pontosAvaliacaoGestor, pontosClima } from "./config.ts";
import { buildCtx, buildHierMap, equipeDe, gestorDe, perfilDe, planoDesenvolvimento, successorsFor, textoIndicaPessoa } from "./engine.ts";
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
        autoavaliacao2026: 80, avaliacaoGestor2026: 90, lideraEquipe: true, climaEquipe2026: 90, conversaDesenvolvimento: "andamento",
      },
      coord: { prioridade1: "gerente  REGIONAL", horizonte1: "mais5", mobilidade: "qualquer", autoavaliacao2026: 60, avaliacaoGestor2026: 60, climaDepartamento2026: 40 },
      analista: { prioridade2: "Gerente regional", horizonte2: "ate3", mobilidade: "" },
      espec: { autoavaliacao2026: 100, avaliacaoGestor2026: 100, climaDepartamento2026: 90, mobilidade: "estado", localidadeAtual: "Londrina - PR" },
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
  assert.deepEqual(h["Presidência"], ["Diretoria"]);
});

test("cadeira em Maringá: pontuação pelo modelo de critérios", () => {
  const r = successorsFor(base().chairs[0], buildCtx(base()));
  // Supervisor (líder): autoavaliação 80% = 8 + gestor 90% = 27 + líder 5 + clima da equipe 90% = 36 + interesse 5 + imediato 10 = 91
  // Especialista (não líder) só indicado pelo líder: 10 + 30 + 5 + clima do departamento 90% = 36 + 0 + 0 = 81
  assert.deepEqual(r.dentro.map((c) => [c.person.id, c.score, c.prioridade, c.perfil]), [
    ["sup", 91, 1, "lider"],
    ["espec", 81, null, "naoLider"],
  ]);
  assert.ok(r.dentro.every((c) => c.indicadoPeloLider));
  // Coordenação (não líder, sem posição): 6 + 18 + 0 + departamento 40% = 16 + 5 + 1,5 = 46,5 ("Beatriz" sozinho não indica)
  assert.deepEqual(r.abaixo.map((c) => [c.person.id, c.score, c.indicadoPeloLider]), [["coord", 46.5, false]]);
  // Analista: nível não alimenta Gerência; mobilidade vazia não filtra. 5 + 6 = 11
  assert.deepEqual(r.fora.map((c) => [c.person.id, c.score]), [["analista", 11]]);
  // Mobilidade continua mapeada, mas não soma pontos
  assert.ok(r.dentro.every((c) => c.criterios.find((k) => k.key === "mobilidade")!.pontos === 0));
});

test("mobilidade não impede de aparecer em outra cidade, só sinaliza", () => {
  // Posição em Cuiabá/MT: o supervisor só aceita a cidade atual (Maringá/PR) e mesmo assim aparece.
  const r = successorsFor(base().chairs[1], buildCtx(base()));
  const todos = [...r.dentro, ...r.abaixo, ...r.fora];
  assert.deepEqual(todos.map((c) => c.person.id).sort(), ["analista", "coord", "sup"]);
  const sup = todos.find((c) => c.person.id === "sup")!;
  assert.equal(sup.foraDaMobilidade, true);
  // Mesma pontuação de Maringá, sem a indicação do líder (a posição de Cuiabá não tem ocupante): 91 - 5 = 86
  assert.equal(sup.score, 86);
  assert.equal(todos.find((c) => c.person.id === "coord")!.foraDaMobilidade, false); // aceita qualquer unidade
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

test("desempenho e clima pontuam proporcional ao resultado", () => {
  assert.deepEqual([0, 80, 100, 120, -5].map(pontosAutoavaliacao), [0, 8, 10, 10, 0]);
  assert.deepEqual([0, 90, 100].map(pontosAvaliacaoGestor), [0, 27, 30]);
  assert.deepEqual([0, 40, 73, 100].map(pontosClima), [0, 16, 29.2, 40]);
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
  d.succession.homonimo = { autoavaliacao2026: 100, avaliacaoGestor2026: 100 };
  const r = successorsFor(d.chairs[0], buildCtx(d));
  const todos = [...r.dentro, ...r.abaixo, ...r.fora];
  assert.ok(!todos.some((c) => c.person.id === "homonimo"));
  assert.ok(todos.find((c) => c.person.id === "sup")!.indicadoPeloLider);
});

test("plano de desenvolvimento considera nível e alimentadores", () => {
  const p = planoDesenvolvimento("Gerência", buildCtx(base()));
  assert.deepEqual(p, { ativos: 1, total: 4, pct: 25 });
});

test("equipe do gestor: diretos ou toda a cadeia abaixo", () => {
  const d = base();
  // lider (Ana Paula) ocupa g1; sup responde a ela pela posição; coord e analista informados na planilha.
  d.chairs[2].gestor = "Ana Paula Souza";
  d.people.find((x) => x.id === "coord")!.gestor = "ana paula SOUZA";
  d.people.find((x) => x.id === "analista")!.gestor = "Carlos Eduardo Lima";
  const ctx = buildCtx(d);
  assert.deepEqual([...equipeDe("Ana Paula Souza", ctx, false)].sort(), ["BEATRIZ NUNES", "CARLOS EDUARDO LIMA"]);
  assert.deepEqual([...equipeDe("Ana Paula Souza", ctx, true)].sort(), ["BEATRIZ NUNES", "CARLOS EDUARDO LIMA", "DIEGO ALVES"]);
});

test("lista de liderança: vale depois da planilha e antes da posição, e traz quem não está na base", () => {
  const d = base();
  d.chairs[2].gestor = "Fulano da Posição";
  d.people.find((x) => x.id === "analista")!.gestor = "Ana Paula Souza"; // informado na planilha: prevalece
  const ctx = buildCtx(d, [
    { colaborador: "CARLOS EDUARDO LIMA", lider: "Ana Paula Souza" },
    { colaborador: "Diego Alves", lider: "Outro Líder" },
    { colaborador: "Joana Fora da Base", lider: "Carlos Eduardo Lima" },
    { colaborador: "Eduardo Ramos", lider: "Eduardo Ramos" }, // a própria pessoa: ignorado
  ]);
  assert.equal(gestorDe(d.people.find((x) => x.id === "sup")!, ctx), "Ana Paula Souza");
  assert.equal(gestorDe(d.people.find((x) => x.id === "analista")!, ctx), "Ana Paula Souza");
  assert.equal(gestorDe(d.people.find((x) => x.id === "espec")!, ctx), "");
  assert.deepEqual([...equipeDe("Ana Paula Souza", ctx, true)].sort(), ["CARLOS EDUARDO LIMA", "DIEGO ALVES", "JOANA FORA DA BASE"]);
});
