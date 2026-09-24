import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { initialData } from "./data.ts";
import { applyWorkbook, buildWorkbook } from "./excel.ts";

function roundTrip(edit: (wb: XLSX.WorkBook) => void) {
  const data = initialData();
  const wb = XLSX.read(XLSX.write(buildWorkbook(data), { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  edit(wb);
  return { before: data, ...applyWorkbook(wb, data) };
}

test("planilha gerada tem as abas esperadas", () => {
  assert.deepEqual(buildWorkbook(initialData()).SheetNames, ["Leia-me", "Cadeiras", "Base de dados", "Hierarquia", "Valores aceitos"]);
});

test("reimportar a planilha sem mudanças não altera cadeiras nem pessoas", () => {
  const { before, data, stats } = roundTrip(() => {});
  assert.equal(data.chairs.length, before.chairs.length);
  assert.equal(data.people.length, before.people.length);
  assert.equal(stats.pessoasCriadas + stats.cadeirasCriadas + stats.cadeirasAtualizadas, 0);
});

test("merge aditivo: atualiza questionário, cria pessoa nova e cidade da cadeira", () => {
  const { before, data, stats } = roundTrip((wb) => {
    const base = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Base de dados"]);
    const alvo = base.find((r) => r["Nome completo"] === "Cleiton Cesar Silva")!;
    alvo["Prioridade 1 (cargo de interesse)"] = "controller";
    alvo["Horizonte 1"] = "Imediato";
    alvo["Avaliação de desempenho (ciclo atual)"] = "estrela";
    alvo["Mobilidade"] = "Dentro do Estado";
    alvo["Lidera equipe"] = "Sim";
    alvo["e-NPS da área 2026"] = -12;
    alvo["Data da conversa de carreira"] = 46280; // serial do Excel
    base.push({ "Nome completo": "Pessoa Nova Teste", "Nível": "Analista / Técnico", "Horizonte 1": "xpto" });
    wb.Sheets["Base de dados"] = XLSX.utils.json_to_sheet(base);
    const cad = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Cadeiras"]);
    cad[0]["Cidade (Cidade/UF)"] = "Douradina/PR";
    wb.Sheets["Cadeiras"] = XLSX.utils.json_to_sheet(cad);
  });
  assert.equal(data.people.length, before.people.length + 1);
  assert.equal(stats.pessoasCriadas, 1);
  assert.equal(stats.cadeirasAtualizadas, 1);
  assert.equal(data.chairs[0].cidade, "Douradina/PR");
  const p = data.people.find((x) => x.nome === "Cleiton Cesar Silva")!;
  assert.deepEqual(
    { ...data.succession[p.id] },
    {
      prioridade1: "controller",
      horizonte1: "imediato",
      desempenho: "estrela",
      mobilidade: "estado",
      lideraEquipe: true,
      enps2026: -12,
      dataConversaCarreira: "15/09/2026",
    },
  );
  assert.ok(stats.avisos.some((a) => a.includes("xpto")));
});
