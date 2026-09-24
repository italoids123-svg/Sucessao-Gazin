import * as XLSX from "xlsx";
import {
  CONTINUIDADE,
  CONVERSA,
  CORTE_ADERENCIA,
  DESEMPENHO,
  EMPRESA,
  HORIZONTE,
  MOBILIDADE,
  NIVEL_NOMES,
  labelOf,
} from "./config.ts";
import { norm } from "./engine.ts";
import type { AppData, Chair, Person, SuccessionRecord } from "./types.ts";

const SIM = "Sim";
const NAO = "Não";

// Colunas da aba "Base de dados", na ordem em que aparecem.
const COL = {
  nome: "Nome completo",
  nivel: "Nível",
  cargo: "Cargo atual",
  diretoria: "Diretoria",
  localidade: "Localidade atual (Cidade/Estado)",
  mobilidade: "Mobilidade",
  p1: "Prioridade 1 (cargo de interesse)",
  h1: "Horizonte 1",
  d1: "Desenvolvimento 1 (lacunas/plano)",
  p2: "Prioridade 2 (cargo de interesse)",
  h2: "Horizonte 2",
  d2: "Desenvolvimento 2 (lacunas/plano)",
  conversa: "Conversa de desenvolvimento",
  continuidade: "Continuidade da sua posição",
  sucessor: "Possível sucessor da sua posição (nome)",
  desempenho: "Avaliação de desempenho (ciclo atual)",
  lidera: "Lidera equipe",
  enps: "e-NPS da área 2026",
} as const;

const CCOL = {
  id: "ID (não alterar)",
  cargo: "Cargo",
  nivel: "Nível",
  diretoria: "Diretoria",
  cidade: "Cidade (Cidade/Estado)",
  ocupante: "Ocupante atual",
  tempo: "Tempo de casa (anos)",
  gestor: "Gestor",
  gestorCargo: "Cargo do gestor",
} as const;


const LEIA_ME = [
  [`Mapa Sucessório ${EMPRESA} — planilha de coleta`],
  [""],
  ["Como funciona"],
  ["1. Preencha as abas abaixo e carregue o arquivo no painel (botão \"Carregar base preenchida\")."],
  ["2. A importação é um MERGE ADITIVO: só atualiza quem está na planilha. Quem não está na planilha não é apagado."],
  ["3. Células vazias NÃO apagam valores já salvos; só células preenchidas sobrescrevem."],
  [""],
  ["Abas"],
  ["Base de dados: uma linha por pessoa. Casa pelo Nome completo; se o nome não existir, a pessoa é criada (informe o Nível)."],
  ["Cadeiras: posições críticas. Linha com ID atualiza a cadeira (cidade, nível, diretoria, tempo de casa). Linha sem ID cria cadeira nova, exceto se já houver cadeira com o mesmo cargo e ocupante."],
  ["Hierarquia: qual nível pode suceder qual. Linhas novas são adicionadas; nenhuma é removida."],
  ["Valores aceitos: copie daqui os valores dos campos de múltipla escolha, para evitar erro de digitação."],
  [""],
  ["Regras importantes"],
  ["Prioridade 1 e 2 devem conter o CARGO EXATO da aba Cadeiras (por exemplo, \"Gerente regional\")."],
  ["\"Possível sucessor da sua posição\" é respondido pelo ocupante da cadeira: nome e sobrenome de quem ele indica."],
  ["Cidade sempre no formato Cidade/Estado com a sigla do Estado (por exemplo, Douradina/PR): o Estado é usado na mobilidade \"Dentro do Estado\"."],
  ["e-NPS da área 2026: número de -100 a 100, só para quem lidera equipe."],
  [`Corte de aderência: ${CORTE_ADERENCIA} pontos.`],
];

export function buildWorkbook(data: AppData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const chairById = new Map(data.chairs.map((c) => [c.id, c]));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(LEIA_ME), "Leia-me");

  const cadeiras = data.chairs.map((c) => ({
    [CCOL.id]: c.id,
    [CCOL.cargo]: c.cargo,
    [CCOL.nivel]: c.nivel,
    [CCOL.diretoria]: c.diretoria,
    [CCOL.cidade]: c.cidade,
    [CCOL.ocupante]: c.vago ? "" : c.nome,
    [CCOL.tempo]: c.tempoCasa ?? "",
    [CCOL.gestor]: c.gestor ?? "",
    [CCOL.gestorCargo]: c.gestorCargo ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, withWidths(XLSX.utils.json_to_sheet(cadeiras)), "Cadeiras");

  const base = data.people.map((p) => {
    const r = data.succession[p.id] ?? {};
    const cidade = r.localidadeAtual || (p.chairId ? chairById.get(p.chairId)?.cidade : "") || "";
    return {
      [COL.nome]: p.nome,
      [COL.nivel]: p.nivel,
      [COL.cargo]: p.cargo,
      [COL.diretoria]: p.diretoria,
      [COL.localidade]: cidade,
      [COL.mobilidade]: labelOf(MOBILIDADE, r.mobilidade),
      [COL.p1]: r.prioridade1 ?? "",
      [COL.h1]: labelOf(HORIZONTE, r.horizonte1),
      [COL.d1]: r.desenvolvimento1 ?? "",
      [COL.p2]: r.prioridade2 ?? "",
      [COL.h2]: labelOf(HORIZONTE, r.horizonte2),
      [COL.d2]: r.desenvolvimento2 ?? "",
      [COL.conversa]: labelOf(CONVERSA, r.conversaDesenvolvimento),
      [COL.continuidade]: labelOf(CONTINUIDADE, r.continuidade),
      [COL.sucessor]: r.possivelSucessorTexto ?? "",
      [COL.desempenho]: labelOf(DESEMPENHO, r.desempenho),
      [COL.lidera]: r.lideraEquipe === undefined ? "" : r.lideraEquipe ? SIM : NAO,
      [COL.enps]: r.enps2026 ?? "",
    };
  });
  const baseSheet = base.length ? XLSX.utils.json_to_sheet(base) : XLSX.utils.aoa_to_sheet([Object.values(COL)]);
  XLSX.utils.book_append_sheet(wb, withWidths(baseSheet), "Base de dados");

  XLSX.utils.book_append_sheet(
    wb,
    withWidths(XLSX.utils.aoa_to_sheet([["Nível da posição", "Nível elegível"], ...data.hierarquia.map((h) => [h.nivel, h.elegivel])])),
    "Hierarquia",
  );

  const cargos = [...new Set(data.chairs.map((c) => c.cargo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const cols: [string, string[]][] = [
    ["Nível", NIVEL_NOMES],
    ["Mobilidade", MOBILIDADE.map((m) => m.label)],
    ["Horizonte", HORIZONTE.map((m) => m.label)],
    ["Conversa de desenvolvimento", CONVERSA.map((m) => m.label)],
    ["Continuidade da sua posição", CONTINUIDADE.map((m) => m.label)],
    ["Avaliação de desempenho", DESEMPENHO.map((n) => n.label)],
    ["Lidera equipe", [SIM, NAO]],
    ["Cargos (Prioridade 1/2)", cargos],
  ];
  const maxLen = Math.max(...cols.map(([, v]) => v.length));
  const aoa = [cols.map(([h]) => h), ...Array.from({ length: maxLen }, (_, i) => cols.map(([, v]) => v[i] ?? ""))];
  XLSX.utils.book_append_sheet(wb, withWidths(XLSX.utils.aoa_to_sheet(aoa)), "Valores aceitos");

  return wb;
}

function withWidths(ws: XLSX.WorkSheet): XLSX.WorkSheet {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const widths: number[] = [];
  for (const r of rows) r.forEach((v, i) => (widths[i] = Math.min(60, Math.max(widths[i] ?? 8, String(v ?? "").length + 2))));
  ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

// ---------------- Importação ----------------

export interface ImportStats {
  pessoasAtualizadas: number;
  pessoasCriadas: number;
  cadeirasAtualizadas: number;
  cadeirasCriadas: number;
  hierarquiaNovas: number;
  avisos: string[];
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).replace(/\s+/g, " ").trim());

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const key = wb.SheetNames.find((n) => norm(n) === norm(name));
  return key ? XLSX.utils.sheet_to_json<Row>(wb.Sheets[key], { defval: "" }) : [];
}

function pick(row: Row, header: string): string {
  const k = Object.keys(row).find((h) => norm(h) === norm(header));
  return k ? str(row[k]) : "";
}

function parseEnum<T extends string>(list: { code: T; label: string }[], v: string, campo: string, avisos: string[], quem: string): T | undefined {
  if (!v) return undefined;
  const n = norm(v);
  const hit = list.find((i) => norm(i.code) === n || norm(i.label) === n);
  if (!hit) avisos.push(`${quem}: valor "${v}" não reconhecido em ${campo}`);
  return hit?.code;
}

function parseNivel(v: string): string | undefined {
  return NIVEL_NOMES.find((n) => norm(n) === norm(v));
}

export function applyWorkbook(wb: XLSX.WorkBook, current: AppData): { data: AppData; stats: ImportStats } {
  const stats: ImportStats = {
    pessoasAtualizadas: 0,
    pessoasCriadas: 0,
    cadeirasAtualizadas: 0,
    cadeirasCriadas: 0,
    hierarquiaNovas: 0,
    avisos: [],
  };
  const chairs: Chair[] = current.chairs.map((c) => ({ ...c }));
  const people: Person[] = current.people.map((p) => ({ ...p, chairIds: [...(p.chairIds ?? [])] }));
  const succession = { ...current.succession };
  const hierarquia = [...current.hierarquia];
  const personByName = new Map(people.map((p) => [norm(p.nome), p]));
  const nextId = (prefix: string, list: { id: string }[]) => {
    let i = list.length + 1;
    while (list.some((x) => x.id === `${prefix}${String(i).padStart(3, "0")}`)) i++;
    return `${prefix}${String(i).padStart(3, "0")}`;
  };

  // Hierarquia (aditiva)
  for (const r of sheetRows(wb, "Hierarquia")) {
    const nivel = parseNivel(pick(r, "Nível da posição"));
    const elegivel = parseNivel(pick(r, "Nível elegível"));
    if (!nivel || !elegivel) continue;
    if (!hierarquia.some((h) => h.nivel === nivel && h.elegivel === elegivel)) {
      hierarquia.push({ nivel, elegivel });
      stats.hierarquiaNovas++;
    }
  }

  // Cadeiras
  for (const r of sheetRows(wb, "Cadeiras")) {
    const id = pick(r, CCOL.id);
    const cargo = pick(r, CCOL.cargo);
    const nivel = parseNivel(pick(r, CCOL.nivel));
    const cidade = pick(r, CCOL.cidade);
    const diretoria = pick(r, CCOL.diretoria);
    const tempoTxt = pick(r, CCOL.tempo).replace(",", ".");
    const tempo = tempoTxt === "" ? undefined : Number(tempoTxt);
    const existing = id ? chairs.find((c) => c.id === id) : undefined;
    if (existing) {
      const before = JSON.stringify(existing);
      if (cidade) existing.cidade = cidade;
      if (diretoria) existing.diretoria = diretoria;
      if (nivel) existing.nivel = nivel;
      if (tempo !== undefined && Number.isFinite(tempo)) existing.tempoCasa = tempo;
      if (JSON.stringify(existing) !== before) stats.cadeirasAtualizadas++;
      continue;
    }
    if (!cargo) continue;
    const ocupante = pick(r, CCOL.ocupante);
    if (chairs.some((c) => norm(c.cargo) === norm(cargo) && norm(c.nome) === norm(ocupante))) continue;
    if (!nivel) {
      stats.avisos.push(`Cadeiras: "${cargo}" sem Nível válido; não criada`);
      continue;
    }
    const chair: Chair = {
      id: nextId("c", chairs),
      nome: ocupante,
      cargo,
      nivel,
      diretoria,
      cidade,
      tempoCasa: tempo !== undefined && Number.isFinite(tempo) ? tempo : null,
      prefixLocalidade: false,
      vago: !ocupante,
      gestor: pick(r, CCOL.gestor),
      gestorCargo: pick(r, CCOL.gestorCargo),
    };
    chairs.push(chair);
    stats.cadeirasCriadas++;
    if (ocupante) {
      let p = personByName.get(norm(ocupante));
      if (!p) {
        p = { id: nextId("p", people), nome: ocupante, nivel, cargo, diretoria, chairId: chair.id, chairIds: [] };
        people.push(p);
        personByName.set(norm(ocupante), p);
        stats.pessoasCriadas++;
      }
      p.chairIds = [...(p.chairIds ?? []), chair.id];
      p.chairId ??= chair.id;
    }
  }
  const cargoCount = new Map<string, number>();
  for (const c of chairs) cargoCount.set(norm(c.cargo), (cargoCount.get(norm(c.cargo)) ?? 0) + 1);
  for (const c of chairs) c.prefixLocalidade = (cargoCount.get(norm(c.cargo)) ?? 0) > 1;

  // Base de dados (pessoas + questionário)
  const cargosValidos = new Set(chairs.map((c) => norm(c.cargo)));
  for (const r of sheetRows(wb, "Base de dados")) {
    const nome = pick(r, COL.nome);
    if (!nome) continue;
    const av = stats.avisos;
    let p = personByName.get(norm(nome));
    const nivel = parseNivel(pick(r, COL.nivel));
    if (!p) {
      if (!nivel) {
        av.push(`Base de dados: "${nome}" não existe na base e está sem Nível válido; não criado`);
        continue;
      }
      p = { id: nextId("p", people), nome, nivel, cargo: pick(r, COL.cargo), diretoria: pick(r, COL.diretoria), chairId: null, chairIds: [] };
      people.push(p);
      personByName.set(norm(nome), p);
      stats.pessoasCriadas++;
    } else {
      stats.pessoasAtualizadas++;
      // Nível/cargo de quem ocupa cadeira vem da cadeira; só é editável para quem não ocupa.
      if (!p.chairIds?.length) {
        if (nivel) p.nivel = nivel;
        if (pick(r, COL.cargo)) p.cargo = pick(r, COL.cargo);
        if (pick(r, COL.diretoria)) p.diretoria = pick(r, COL.diretoria);
      }
    }

    const rec: SuccessionRecord = { ...(succession[p.id] ?? {}) };
    const set = <K extends keyof SuccessionRecord>(k: K, v: SuccessionRecord[K] | undefined) => {
      if (v !== undefined && v !== "") rec[k] = v;
    };
    const cargoInteresse = (col: string) => {
      const v = pick(r, col);
      if (v && !cargosValidos.has(norm(v))) av.push(`${nome}: "${v}" (${col}) não corresponde a nenhum cargo da aba Cadeiras`);
      return v;
    };
    set("localidadeAtual", pick(r, COL.localidade));
    set("mobilidade", parseEnum(MOBILIDADE, pick(r, COL.mobilidade), COL.mobilidade, av, nome));
    set("prioridade1", cargoInteresse(COL.p1));
    set("horizonte1", parseEnum(HORIZONTE, pick(r, COL.h1), COL.h1, av, nome));
    set("desenvolvimento1", pick(r, COL.d1));
    set("prioridade2", cargoInteresse(COL.p2));
    set("horizonte2", parseEnum(HORIZONTE, pick(r, COL.h2), COL.h2, av, nome));
    set("desenvolvimento2", pick(r, COL.d2));
    set("conversaDesenvolvimento", parseEnum(CONVERSA, pick(r, COL.conversa), COL.conversa, av, nome));
    set("continuidade", parseEnum(CONTINUIDADE, pick(r, COL.continuidade), COL.continuidade, av, nome));
    set("possivelSucessorTexto", pick(r, COL.sucessor));
    set("desempenho", parseEnum(DESEMPENHO, pick(r, COL.desempenho), COL.desempenho, av, nome));
    const lid = norm(pick(r, COL.lidera));
    if (lid) {
      if (lid === "SIM") rec.lideraEquipe = true;
      else if (lid === "NAO") rec.lideraEquipe = false;
      else av.push(`${nome}: valor "${pick(r, COL.lidera)}" não reconhecido em ${COL.lidera}`);
    }
    const enpsTxt = pick(r, COL.enps).replace(",", ".");
    if (enpsTxt) {
      const enps = Number(enpsTxt);
      if (Number.isFinite(enps) && enps >= -100 && enps <= 100) rec.enps2026 = enps;
      else av.push(`${nome}: e-NPS "${enpsTxt}" inválido (use um número de -100 a 100)`);
    }
    succession[p.id] = rec;
  }

  return {
    data: {
      chairs,
      people,
      succession,
      hierarquia,
      updatedAt: new Date().toISOString(),
    },
    stats,
  };
}
