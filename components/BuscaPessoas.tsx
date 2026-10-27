"use client";

import { useCallback, useMemo, useState } from "react";
import { HORIZONTE, MOBILIDADE, NIVEIS, PERFIL_LABEL, labelOf } from "@/lib/config.ts";
import { cidadeDaPessoa, fmtPontos, norm, perfilDe } from "@/lib/engine.ts";
import { useStore } from "@/lib/store.tsx";
import type { Candidate, Chair, Person, SuccessionRecord } from "@/lib/types.ts";
import ChairModal from "./ChairModal";

const collator = new Intl.Collator("pt-BR");
const SEM_CIDADE = "Sem cidade informada";
const SEM_MOBILIDADE = "Não informada";

interface Interesse {
  prioridade: 1 | 2;
  cargo: string;
  horizonte: string;
  niveis: string[]; // níveis das posições com esse cargo
}

interface Aparicao {
  chair: Chair;
  cand: Candidate;
}

interface Linha {
  person: Person;
  rec: SuccessionRecord;
  interesses: Interesse[];
  cidade: string;
  mobilidade: string;
  aparicoes: Aparicao[];
  melhor?: Aparicao;
}

const GRUPO: Record<Candidate["grupo"], { cor: string; texto: string }> = {
  dentro: { cor: "verde", texto: "Dentro da aderência" },
  abaixo: { cor: "amarelo", texto: "Abaixo do corte" },
  fora: { cor: "vermelho", texto: "Fora da hierarquia" },
};

/** Grupo de botões que ligam/desligam valores (vários podem ficar ativos ao mesmo tempo). */
function Filtro({ titulo, opcoes, ativos, alternar }: { titulo: string; opcoes: string[]; ativos: Set<string>; alternar: (v: string) => void }) {
  if (!opcoes.length) return null;
  return (
    <div className="filtro-grupo">
      <div className="filtro-titulo">{titulo}</div>
      <div className="filtro-botoes">
        {opcoes.map((o) => (
          <button key={o} className={`filtro-btn ${ativos.has(o) ? "ativo" : ""}`} aria-pressed={ativos.has(o)} onClick={() => alternar(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function useFiltro() {
  const [ativos, setAtivos] = useState<Set<string>>(new Set());
  const alternar = useCallback(
    (v: string) =>
      setAtivos((s) => {
        const n = new Set(s);
        if (n.has(v)) n.delete(v);
        else n.add(v);
        return n;
      }),
    [],
  );
  return { ativos, alternar, limpar: () => setAtivos(new Set()) };
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function BuscaPessoas() {
  const { data, ctx, results } = useStore();
  const [busca, setBusca] = useState("");
  const [modoNivel, setModoNivel] = useState<"atual" | "interesse">("atual");
  const nivel = useFiltro();
  const prontidao = useFiltro();
  const cidade = useFiltro();
  const prioridade = useFiltro();
  const mobilidade = useFiltro();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [cadeiraAberta, setCadeiraAberta] = useState<string | null>(null);
  const fecharModal = useCallback(() => setCadeiraAberta(null), []);

  // Pessoas interessadas (Prioridade 1 ou 2 preenchida), com as posições em que aparecem.
  const linhas = useMemo<Linha[]>(() => {
    const niveisDoCargo = new Map<string, Set<string>>();
    for (const c of data.chairs) {
      const k = norm(c.cargo);
      if (!niveisDoCargo.has(k)) niveisDoCargo.set(k, new Set());
      niveisDoCargo.get(k)!.add(c.nivel);
    }
    const aparicoes = new Map<string, Aparicao[]>();
    for (const c of data.chairs) {
      const r = results.get(c.id);
      if (!r) continue;
      for (const cand of [...r.dentro, ...r.abaixo, ...r.fora]) {
        if (!aparicoes.has(cand.person.id)) aparicoes.set(cand.person.id, []);
        aparicoes.get(cand.person.id)!.push({ chair: c, cand });
      }
    }
    const out: Linha[] = [];
    for (const p of data.people) {
      const rec = data.succession[p.id] ?? {};
      const interesses: Interesse[] = [];
      if (rec.prioridade1)
        interesses.push({ prioridade: 1, cargo: rec.prioridade1, horizonte: rec.horizonte1 ?? "", niveis: [...(niveisDoCargo.get(norm(rec.prioridade1)) ?? [])] });
      if (rec.prioridade2)
        interesses.push({ prioridade: 2, cargo: rec.prioridade2, horizonte: rec.horizonte2 ?? "", niveis: [...(niveisDoCargo.get(norm(rec.prioridade2)) ?? [])] });
      if (!interesses.length) continue;
      const ap = (aparicoes.get(p.id) ?? []).sort((a, b) => b.cand.score - a.cand.score);
      out.push({
        person: p,
        rec,
        interesses,
        cidade: cidadeDaPessoa(p, rec, ctx) || SEM_CIDADE,
        mobilidade: labelOf(MOBILIDADE, rec.mobilidade) || SEM_MOBILIDADE,
        aparicoes: ap,
        melhor: ap.find((a) => a.cand.grupo !== "fora") ?? ap[0],
      });
    }
    // Primeiro quem tem posição elegível (por pontuação), depois quem só aparece fora da hierarquia, por fim quem não aparece.
    const chave = (l: Linha) => (l.melhor ? (l.melhor.cand.grupo !== "fora" ? 1000 : 0) + l.melhor.cand.score : -1);
    return out.sort((a, b) => chave(b) - chave(a) || collator.compare(a.person.nome, b.person.nome));
  }, [data, ctx, results]);

  const opcoesNivel = NIVEIS.map((n) => n.nome);
  const opcoesProntidao = HORIZONTE.map((h) => h.label);
  const opcoesCidade = [...new Set(linhas.map((l) => l.cidade))].sort((a, b) => (a === SEM_CIDADE ? 1 : b === SEM_CIDADE ? -1 : collator.compare(a, b)));
  const opcoesMobilidade = [...MOBILIDADE.map((m) => m.label), ...(linhas.some((l) => l.mobilidade === SEM_MOBILIDADE) ? [SEM_MOBILIDADE] : [])];

  // Um interesse conta quando passa ao mesmo tempo pelos filtros de prioridade, prontidão e (se for o modo) nível de interesse.
  const interesseValido = (i: Interesse) =>
    (!prioridade.ativos.size || prioridade.ativos.has(`Prioridade ${i.prioridade}`)) &&
    (!prontidao.ativos.size || prontidao.ativos.has(labelOf(HORIZONTE, i.horizonte))) &&
    (modoNivel !== "interesse" || !nivel.ativos.size || i.niveis.some((n) => nivel.ativos.has(n)));

  const q = norm(busca);
  const visiveis = linhas.filter(
    (l) =>
      (!q || norm(`${l.person.nome} ${l.person.cargo}`).includes(q)) &&
      (modoNivel !== "atual" || !nivel.ativos.size || nivel.ativos.has(l.person.nivel)) &&
      (!cidade.ativos.size || cidade.ativos.has(l.cidade)) &&
      (!mobilidade.ativos.size || mobilidade.ativos.has(l.mobilidade)) &&
      l.interesses.some(interesseValido),
  );

  const algumFiltro = !!(q || nivel.ativos.size || prontidao.ativos.size || cidade.ativos.size || prioridade.ativos.size || mobilidade.ativos.size);
  const limparTudo = () => {
    setBusca("");
    [nivel, prontidao, cidade, prioridade, mobilidade].forEach((f) => f.limpar());
  };
  const alternarAberto = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const cadeira = cadeiraAberta ? data.chairs.find((c) => c.id === cadeiraAberta) : undefined;

  return (
    <>
      <div className="page-head">
        <h1>Busca por pessoa</h1>
        <p>Todas as pessoas que declararam interesse em alguma posição, e onde cada uma aparece como candidata.</p>
      </div>

      <div className="busca-filtros">
        <div className="filters">
          <input placeholder="Buscar por nome ou cargo atual" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="filtro-grupo">
          <div className="filtro-titulo">
            Cargos
            <span className="filtro-modo">
              <button className={modoNivel === "atual" ? "ativo" : ""} onClick={() => setModoNivel("atual")}>
                nível atual
              </button>
              <button className={modoNivel === "interesse" ? "ativo" : ""} onClick={() => setModoNivel("interesse")}>
                nível de interesse
              </button>
            </span>
          </div>
          <div className="filtro-botoes">
            {opcoesNivel.map((o) => (
              <button key={o} className={`filtro-btn ${nivel.ativos.has(o) ? "ativo" : ""}`} aria-pressed={nivel.ativos.has(o)} onClick={() => nivel.alternar(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <Filtro titulo="Prontidão declarada" opcoes={opcoesProntidao} ativos={prontidao.ativos} alternar={prontidao.alternar} />
        <Filtro titulo="Prioridade" opcoes={["Prioridade 1", "Prioridade 2"]} ativos={prioridade.ativos} alternar={prioridade.alternar} />
        <Filtro titulo="Mobilidade" opcoes={opcoesMobilidade} ativos={mobilidade.ativos} alternar={mobilidade.alternar} />
        <Filtro titulo="Cidade" opcoes={opcoesCidade} ativos={cidade.ativos} alternar={cidade.alternar} />
      </div>

      <div className="busca-resumo">
        <span>
          <b>{visiveis.length}</b> de {linhas.length} pessoas interessadas
        </span>
        {algumFiltro && (
          <button className="btn ghost no-export" onClick={limparTudo}>
            Limpar filtros
          </button>
        )}
      </div>

      {!linhas.length ? (
        <div className="empty">Nenhuma pessoa declarou interesse ainda. Carregue a planilha de coleta preenchida.</div>
      ) : !visiveis.length ? (
        <div className="empty">Nenhuma pessoa com esses filtros.</div>
      ) : (
        visiveis.map((l) => {
          const aberto = abertos.has(l.person.id);
          const m = l.melhor;
          return (
            <div key={l.person.id} className={`cand pessoa ${aberto ? "aberto" : ""}`}>
              <div className="pessoa-linha">
                <div className="avatar">{iniciais(l.person.nome)}</div>
                <div>
                  <div className="nome">{l.person.nome}</div>
                  <div className="sub">
                    {l.person.cargo || "Sem cargo informado"} · {l.person.nivel} · {PERFIL_LABEL[perfilDe(l.person, l.rec)]}
                  </div>
                  <div className="sub">
                    {l.cidade} · Mobilidade: {l.mobilidade}
                  </div>
                </div>
                <div className="pessoa-interesses">
                  {l.interesses.map((i) => (
                    <div key={i.prioridade} className={`pessoa-interesse ${interesseValido(i) ? "" : "apagado"}`}>
                      <b>P{i.prioridade}</b> {i.cargo}
                      <span className="horizonte"> · {labelOf(HORIZONTE, i.horizonte) || "horizonte não informado"}</span>
                    </div>
                  ))}
                </div>
                <div className="score">
                  {m ? fmtPontos(m.cand.score) : "–"}
                  <span>melhor pontuação</span>
                </div>
                <div>{m ? <div className={`pill ${GRUPO[m.cand.grupo].cor}`}>{GRUPO[m.cand.grupo].texto}</div> : <div className="pill">Sem posição alcançável</div>}</div>
                <button className="ver-detalhes no-export" onClick={() => alternarAberto(l.person.id)} aria-expanded={aberto}>
                  {aberto ? "Ocultar posições −" : `Ver posições (${l.aparicoes.length}) +`}
                </button>
              </div>
              {aberto && (
                <div className="cand-detalhes">
                  <div className="det-titulo">Posições em que aparece como candidata</div>
                  {l.aparicoes.length ? (
                    <table className="t">
                      <thead>
                        <tr>
                          <th>Posição</th>
                          <th>Ocupante atual</th>
                          <th>Cidade</th>
                          <th>Situação</th>
                          <th className="num">Pontos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {l.aparicoes.map((a) => (
                          <tr key={a.chair.id} className="overview-row" onClick={() => setCadeiraAberta(a.chair.id)}>
                            <td>
                              <u>{a.chair.cargo}</u>
                            </td>
                            <td>{a.chair.vago || !a.chair.nome ? "Posição vaga" : a.chair.nome}</td>
                            <td>{a.chair.cidade || "–"}</td>
                            <td>
                              <span className={`pill ${GRUPO[a.cand.grupo].cor}`}>{GRUPO[a.cand.grupo].texto}</span>
                            </td>
                            <td className="num">{fmtPontos(a.cand.score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty">
                      Não aparece em nenhuma posição: a mobilidade declarada não alcança as posições de interesse, ou o cargo informado não
                      existe na base.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {cadeira && <ChairModal chair={cadeira} onClose={fecharModal} />}
    </>
  );
}
