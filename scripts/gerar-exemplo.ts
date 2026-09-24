/**
 * Gera uma planilha de EXEMPLO FICTÍCIO no formato de importação da ferramenta, para demonstração.
 * Os nomes e as posições são os da base real; todas as respostas (interesse, desempenho, clima,
 * mobilidade, indicações, cidades) são sorteadas. Os analistas incluídos são pessoas inventadas.
 *
 * Uso: npm run exemplo   (grava exemplos/Gazin_Mapa_Sucessorio_EXEMPLO_FICTICIO.xlsx)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { CONTINUIDADE, CONVERSA, DESEMPENHO, HORIZONTE, MOBILIDADE, SEDE } from "../lib/config.ts";
import { initialData } from "../lib/data.ts";
import { buildCtx, norm, resumoCobertura, successorsFor } from "../lib/engine.ts";
import { applyWorkbook, buildWorkbook } from "../lib/excel.ts";
import type { Chair, Person } from "../lib/types.ts";

// ---------- sorteio reprodutível ----------
let semente = Number(process.env.SEMENTE ?? 1);
function rnd() {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => rnd() < p;
const um = <T,>(l: T[]) => l[Math.floor(rnd() * l.length)];
function pesado<T>(opcoes: [T, number][]): T {
  const total = opcoes.reduce((s, [, p]) => s + p, 0);
  let r = rnd() * total;
  for (const [v, p] of opcoes) if ((r -= p) <= 0) return v;
  return opcoes[opcoes.length - 1][0];
}
const labelDe = (l: { code: string; label: string }[], code: string) => l.find((x) => x.code === code)!.label;

const data = initialData();
const ctx = buildCtx(data);
const pessoaDaCadeira = new Map<string, Person>();
for (const p of data.people) for (const id of p.chairIds ?? []) pessoaDaCadeira.set(id, p);

// ---------- cidades das posições ----------
const REGIONAIS = [
  "Umuarama/PR", "Maringá/PR", "Cascavel/PR", "Cuiabá/MT", "Rondonópolis/MT", "Porto Velho/RO",
  "Ji-Paraná/RO", "Campo Grande/MS", "Dourados/MS", "Rio Branco/AC", "Belém/PA", "Goiânia/GO",
];
const INDUSTRIAIS = [SEDE, "Ipameri/GO", "Feira de Santana/BA", "Rondonópolis/MT"];
const ESPALHADAS = /^(Gerente regional|Supervisor administrativo$|Supervisor regional|Supervisor comercial \(Gazin Bank\)|Coordenador de transporte|Gerente de transporte|Gerente de assistência|Gerente de vendas \(atacado\)|Supervisor de vendas)/;
const INDUSTRIA = /^Gerente de indústria/;

const cidadeDe = new Map<string, string>();
let iReg = 0;
let iInd = 0;
for (const c of data.chairs) {
  if (INDUSTRIA.test(c.cargo)) cidadeDe.set(c.id, INDUSTRIAIS[iInd++ % INDUSTRIAIS.length]);
  else if (ESPALHADAS.test(c.cargo) && !(c.cargo === "Gerente de assistência" && c.nivel === "Gerência Executiva"))
    cidadeDe.set(c.id, REGIONAIS[iReg++ % REGIONAIS.length]);
}
// Demais posições: cidade da posição do gestor (ex.: gerente de espumação na unidade do gerente de indústria), senão a matriz.
const cadeiraDoGestor = (c: Chair) => data.chairs.find((g) => g.nome && norm(g.nome) === norm(c.gestor));
for (const c of data.chairs) if (!cidadeDe.has(c.id)) cidadeDe.set(c.id, (cadeiraDoGestor(c) && cidadeDe.get(cadeiraDoGestor(c)!.id)) || SEDE);

// ---------- pessoas fictícias (analistas e técnicos) ----------
const NOMES = ["Amanda", "Bruna", "Caio", "Daniela", "Eduarda", "Felipe", "Gabriela", "Heitor", "Isabela", "João Pedro", "Karina", "Lucas", "Mariana", "Nathalia", "Otávio", "Paula", "Rafaela", "Samuel", "Tatiane", "Vitor", "Yasmin", "Wellington", "Letícia", "Murilo"];
const SOBRENOMES = ["Albuquerque", "Barreto", "Cardoso", "Damasceno", "Esteves", "Figueiredo", "Guimarães", "Holanda", "Jardim", "Lacerda", "Meireles", "Nogueira", "Pacheco", "Queiroz", "Rezende", "Siqueira", "Tavares", "Valadares", "Xavier", "Zanella"];
const AREAS_ANALISTA: [string, string][] = [
  ["Analista administrativo", "Diretoria comercial"], ["Analista de crédito", "Diretoria financeira"],
  ["Analista contábil", "Controller"], ["Analista de sistemas", "Diretoria de tecnologia da informação e inovação"],
  ["Analista de logística", "Diretoria de logística"], ["Analista de recursos humanos", "Gerente geral de recursos humanos"],
  ["Técnico de segurança do trabalho", "Diretoria de governança"], ["Analista de compras", "Diretoria administrativa"],
];
const existentes = new Set(data.people.map((p) => norm(p.nome)));
const ficticios: { nome: string; cargo: string; diretoria: string; cidade: string }[] = [];
while (ficticios.length < 40) {
  const nome = `${um(NOMES)} ${um(SOBRENOMES)} ${um(SOBRENOMES)}`;
  if (existentes.has(norm(nome)) || nome.split(" ").at(-1) === nome.split(" ").at(-2)) continue;
  existentes.add(norm(nome));
  const [cargo, diretoria] = um(AREAS_ANALISTA);
  ficticios.push({ nome, cargo, diretoria, cidade: chance(0.5) ? SEDE : um(REGIONAIS) });
}

// ---------- respostas sorteadas ----------
const LACUNAS = [
  "Gestão de pessoas e feedback", "Visão financeira do negócio (DRE, orçamento)", "Negociação com fornecedores",
  "Liderança de equipes maiores", "Planejamento estratégico", "Conhecimento da operação de outras unidades",
  "Gestão de indicadores e metas", "Comunicação com a diretoria", "Formação técnica específica da área",
];
const horizonte = () => pesado<string>([["imediato", 25], ["ate3", 40], ["3a5", 25], ["mais5", 10]]);
const desempenho = () =>
  pesado<string>([["estrela", 11], ["alto_desempenho", 17], ["comprometido", 13], ["alto_potencial", 12], ["solido", 21], ["bom_executor", 10], ["enigma", 5], ["eficaz", 5], ["risco", 3], ["", 3]]);
const mobilidade = () => pesado<string>([["local", 28], ["matriz", 14], ["estado", 30], ["qualquer", 28]]);
const enps = () => Math.max(-30, Math.min(98, Math.round(55 + (rnd() + rnd() + rnd() - 1.5) * 50)));
const dataConversa = () => {
  const d = new Date(Date.UTC(2026, 5, 1) + Math.floor(rnd() * 110) * 86400000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

type Linha = Record<string, string | number>;
const nivelDe = new Map<string, string>(data.people.map((p) => [norm(p.nome), p.nivel]));
for (const f of ficticios) nivelDe.set(norm(f.nome), "Analista / Técnico");
const cidadePessoa = (nome: string) => {
  const p = data.people.find((x) => norm(x.nome) === norm(nome));
  return p?.chairId ? cidadeDe.get(p.chairId)! : ficticios.find((f) => norm(f.nome) === norm(nome))!.cidade;
};
const diretoriaPessoa = (nome: string) =>
  data.people.find((x) => norm(x.nome) === norm(nome))?.diretoria ?? ficticios.find((f) => norm(f.nome) === norm(nome))!.diretoria;

/** Cadeiras que a pessoa pode pleitear; com pequena chance de mirar uma fora da hierarquia elegível. */
function alvoDeInteresse(nome: string, excluir: string[]): Chair | undefined {
  const nivel = nivelDe.get(norm(nome))!;
  const propria = data.people.find((x) => norm(x.nome) === norm(nome))?.chairIds ?? [];
  const foraDaHierarquia = chance(0.07);
  const alvos = data.chairs.filter(
    (c) =>
      !propria.includes(c.id) &&
      !excluir.includes(c.cargo) &&
      (ctx.hierMap[c.nivel] ?? []).includes(nivel) !== foraDaHierarquia &&
      (!foraDaHierarquia || c.nivel === "Gerência Executiva" || c.nivel === "Gerência"),
  );
  if (!alvos.length) return undefined;
  // Quem só pode subir para Diretoria (Gerência Executiva) declara essa ambição com menos frequência.
  if (alvos.every((c) => c.nivel === "Diretoria") && !chance(0.3)) return undefined;
  // Preferência pela mesma área e pela mesma cidade, como tende a acontecer na prática.
  // Diretoria atrai poucas candidaturas: é o nível mais difícil de cobrir.
  const peso = (c: Chair) =>
    (1 + (c.diretoria === diretoriaPessoa(nome) ? 6 : 0) + (cidadeDe.get(c.id) === cidadePessoa(nome) ? 2 : 0)) * (c.nivel === "Diretoria" ? 0.03 : 1);
  return pesado(alvos.map((c) => [c, peso(c)]));
}

const respostas = new Map<string, Linha>();
function responder(nome: string, lidera: boolean) {
  const r: Linha = {};
  r["Localidade atual (Cidade/Estado)"] = cidadePessoa(nome);
  r["Data da conversa de carreira"] = dataConversa();
  r["Mobilidade"] = labelDe(MOBILIDADE, mobilidade());
  const d = desempenho();
  if (d) r["Avaliação de desempenho (ciclo atual)"] = labelDe(DESEMPENHO, d);
  r["Lidera equipe"] = lidera ? "Sim" : "Não";
  if (lidera) r["e-NPS da área 2026"] = enps();
  r["Conversa de desenvolvimento"] = labelDe(CONVERSA, pesado<string>([["andamento", 40], ["sem_formalizar", 35], ["nao", 25]]));
  if (chance(0.78)) {
    const a1 = alvoDeInteresse(nome, []);
    if (a1) {
      r["Prioridade 1 (cargo de interesse)"] = a1.cargo;
      r["Horizonte 1"] = labelDe(HORIZONTE, horizonte());
      r["Desenvolvimento 1 (lacunas/plano)"] = um(LACUNAS);
      const a2 = chance(0.45) ? alvoDeInteresse(nome, [a1.cargo]) : undefined;
      if (a2) {
        r["Prioridade 2 (cargo de interesse)"] = a2.cargo;
        r["Horizonte 2"] = labelDe(HORIZONTE, horizonte());
        r["Desenvolvimento 2 (lacunas/plano)"] = um(LACUNAS);
      }
    }
  }
  respostas.set(norm(nome), r);
}
for (const p of data.people) responder(p.nome, p.nivel !== "Especialista" || chance(0.2));
for (const f of ficticios) responder(f.nome, false);

// Posição vaga de Controller: dois candidatos internos claros e um terceiro ainda distante.
Object.assign(respostas.get(norm("Cleiton Cesar Silva"))!, {
  "Prioridade 1 (cargo de interesse)": "Controller", "Horizonte 1": "Imediato",
  "Avaliação de desempenho (ciclo atual)": "Estrela", "Mobilidade": labelDe(MOBILIDADE, "qualquer"), "e-NPS da área 2026": 78,
});
Object.assign(respostas.get(norm("Diego Henrique Garcia Soriani"))!, {
  "Prioridade 1 (cargo de interesse)": "Controller", "Horizonte 1": "Até 3 anos",
  "Avaliação de desempenho (ciclo atual)": "Alto Desempenho", "Mobilidade": labelDe(MOBILIDADE, "matriz"), "e-NPS da área 2026": 64,
});
Object.assign(respostas.get(norm("Celia Xavier Novo"))!, {
  "Prioridade 2 (cargo de interesse)": "Controller", "Horizonte 2": "Mais de 3 até 5 anos",
});

// ---------- indicação do líder e continuidade ----------
const interessados = (cargo: string) =>
  [...respostas.entries()]
    .filter(([, r]) => norm(String(r["Prioridade 1 (cargo de interesse)"] ?? "")) === norm(cargo) || norm(String(r["Prioridade 2 (cargo de interesse)"] ?? "")) === norm(cargo))
    .map(([n]) => n);
const nomeOriginal = new Map<string, string>([...data.people.map((p) => [norm(p.nome), p.nome] as [string, string]), ...ficticios.map((f) => [norm(f.nome), f.nome] as [string, string])]);
const nomeCurto = (n: string) => {
  const t = n.split(" ").filter((w) => w.length > 2);
  return `${t[0]} ${t[t.length - 1]}`;
};

for (const c of data.chairs) {
  const ocupante = pessoaDaCadeira.get(c.id);
  if (!ocupante) continue;
  const r = respostas.get(norm(ocupante.nome))!;
  const doNivel = [...nomeOriginal.keys()].filter(
    (n) => (ctx.hierMap[c.nivel] ?? []).includes(nivelDe.get(n)!) && diretoriaPessoa(nomeOriginal.get(n)!) === c.diretoria && n !== norm(ocupante.nome),
  );
  // O líder costuma indicar quem já manifestou interesse; só às vezes cita alguém que não se candidatou.
  const candidatos = interessados(c.cargo).filter((n) => n !== norm(ocupante.nome));
  const pool = candidatos.length && chance(0.85) ? candidatos : chance(0.3) ? doNivel : [];
  const indicados: string[] = [];
  if (pool.length && chance(0.62)) {
    for (let i = 0; i < (chance(0.35) ? 2 : 1) && pool.length; i++) {
      const n = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const nome = nomeOriginal.get(n)!;
      indicados.push(chance(0.25) ? nomeCurto(nome) : nome);
    }
  }
  if (indicados.length) r["Possível sucessor da sua posição (nome)"] = indicados.join(", ");
  r["Continuidade da sua posição"] = labelDe(
    CONTINUIDADE,
    indicados.length ? pesado<string>([["imediata", 35], ["com_suporte", 65]]) : pesado<string>([["nao_identifico", 70], ["sem_elementos", 30]]),
  );
}
// Diretoria financeira: indicação com nome ambíguo ("Cleiton Silva" = dois Cleitons na base), para mostrar o alerta.
respostas.get(norm("Fernando Sanches Graci"))!["Possível sucessor da sua posição (nome)"] = "Cleiton Silva, Maykon Fernando da Costa";

// ---------- monta a planilha ----------
const wb = buildWorkbook(data);
const leiaMe = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Leia-me"], { header: 1 });
wb.Sheets["Leia-me"] = XLSX.utils.aoa_to_sheet([
  ["EXEMPLO FICTÍCIO — NÃO SÃO DADOS REAIS"],
  ["Nomes e posições vêm da base de posições críticas; interesse, desempenho, clima, mobilidade, indicações e cidades foram sorteados."],
  ["Os 40 analistas e técnicos incluídos são pessoas inventadas. Use só para demonstrar a ferramenta; depois clique em \"Limpar base local\"."],
  [""],
  ...leiaMe,
]);

const base = XLSX.utils.sheet_to_json<Linha>(wb.Sheets["Base de dados"]);
for (const linha of base) Object.assign(linha, respostas.get(norm(String(linha["Nome completo"]))) ?? {});
for (const f of ficticios)
  base.push({ "Nome completo": f.nome, "Nível": "Analista / Técnico", "Cargo atual": f.cargo, "Diretoria": f.diretoria, ...respostas.get(norm(f.nome))! });
const colunas = Object.keys(XLSX.utils.sheet_to_json<Linha>(wb.Sheets["Base de dados"], { header: 1 })[0] as unknown as object).length
  ? (XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Base de dados"], { header: 1 })[0] as string[])
  : [];
wb.Sheets["Base de dados"] = XLSX.utils.json_to_sheet(base, { header: colunas });

const cadeiras = XLSX.utils.sheet_to_json<Linha>(wb.Sheets["Cadeiras"]);
for (const linha of cadeiras) {
  linha["Cidade (Cidade/Estado)"] = cidadeDe.get(String(linha["ID (não alterar)"]))!;
  linha["Tempo de casa (anos)"] = Math.round((1 + rnd() * 24) * 10) / 10;
}
wb.Sheets["Cadeiras"] = XLSX.utils.json_to_sheet(cadeiras);
for (const aba of ["Base de dados", "Cadeiras"]) {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1 });
  const larguras: number[] = [];
  for (const r of linhas) r.forEach((v, i) => (larguras[i] = Math.min(50, Math.max(larguras[i] ?? 8, String(v ?? "").length + 2))));
  wb.Sheets[aba]["!cols"] = larguras.map((wch) => ({ wch }));
}
wb.Sheets["Leia-me"]["!cols"] = [{ wch: 120 }];

mkdirSync("exemplos", { recursive: true });
const arquivo = "exemplos/Gazin_Mapa_Sucessorio_EXEMPLO_FICTICIO.xlsx";
const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync(arquivo, buffer);

// ---------- confere o resultado com o próprio motor da ferramenta ----------
const { data: importado, stats } = applyWorkbook(XLSX.read(buffer, { type: "buffer" }), data);
const ctx2 = buildCtx(importado);
const res = importado.chairs.map((c) => ({ c, r: successorsFor(c, ctx2) }));
console.log(`Gravado ${arquivo}`);
console.log(`Importação: ${stats.pessoasAtualizadas} atualizadas, ${stats.pessoasCriadas} criadas, ${stats.cadeirasAtualizadas} cadeiras atualizadas, ${stats.avisos.length} avisos`);
if (stats.avisos.length) console.log(stats.avisos.slice(0, 5).join("\n"));
const geral = resumoCobertura(res.map((x) => x.r));
console.log("Cobertura geral:", geral);
for (const n of ["Diretoria", "Gerência Executiva", "Gerência", "Coordenação", "Supervisão", "Especialista"])
  console.log(n.padEnd(20), resumoCobertura(res.filter((x) => x.c.nivel === n).map((x) => x.r)));
const fora = res.reduce((s, x) => s + x.r.fora.length, 0);
const soLider = res.reduce((s, x) => s + x.r.dentro.concat(x.r.abaixo).filter((k) => k.prioridade === null).length, 0);
const estrelas = res.reduce((s, x) => s + [...x.r.dentro, ...x.r.abaixo, ...x.r.fora].filter((k) => k.indicadoPeloLider).length, 0);
console.log({ foraDaHierarquia: fora, soIndicacaoDoLider: soLider, indicadosPeloLider: estrelas });
for (const x of res.filter((x) => x.c.nivel === "Diretoria"))
  console.log(" ", x.c.cargo.padEnd(50), "dentro", x.r.dentro.map((k) => `${k.person.nome} ${k.score}`).join("; ") || "-", "| abaixo", x.r.abaixo.length);
const regionais = res.filter((x) => x.c.cargo === "Gerente regional");
console.log("Gerente regional:", regionais.map((x) => `${x.c.cidade}:${x.r.dentro.length}`).join(" "));
const compartilhados = new Map<string, number>();
for (const x of res) for (const k of x.r.dentro) compartilhados.set(k.person.nome, (compartilhados.get(k.person.nome) ?? 0) + 1);
console.log("sucessores em 3+ posições:", [...compartilhados].filter(([, n]) => n >= 3).length, "| pessoas distintas como sucessoras:", compartilhados.size);
