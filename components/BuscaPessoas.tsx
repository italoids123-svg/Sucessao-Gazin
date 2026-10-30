"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HORIZONTE, MOBILIDADE, NIVEIS, PERFIL_LABEL, labelOf } from "@/lib/config.ts";
import { LIDERANCA, LIDERANCA_PENDENTES } from "@/lib/data.ts";
import { cidadeDaPessoa, equipeDe, fmtPontos, mapaDeLideranca, norm, perfilDe } from "@/lib/engine.ts";
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

/**
 * Lista suspensa com múltipla escolha: o botão mostra o que está selecionado e o painel abre com caixas
 * de marcação. `extra` entra no topo do painel (ex.: escolher entre nível atual e de interesse).
 */
function Suspensa({
  titulo,
  opcoes,
  ativos,
  alternar,
  limpar,
  extra,
  buscavel,
}: {
  titulo: string;
  opcoes: string[];
  ativos: Set<string>;
  alternar: (v: string) => void;
  limpar: () => void;
  extra?: React.ReactNode;
  buscavel?: boolean; // listas longas (ex.: gestores) ganham um campo para filtrar as opções
}) {
  const [aberta, setAberta] = useState(false);
  const [filtroOpcoes, setFiltroOpcoes] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberta(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta]);
  const resumo = !ativos.size ? "Todos" : ativos.size === 1 ? [...ativos][0] : `${ativos.size} selecionados`;
  return (
    <div className="suspensa" ref={ref}>
      <span className="suspensa-rotulo">{titulo}</span>
      <button className={`suspensa-botao ${ativos.size ? "ativo" : ""}`} onClick={() => setAberta((a) => !a)} aria-expanded={aberta}>
        <span>{resumo}</span>
        <span aria-hidden>▾</span>
      </button>
      {aberta && (
        <div className="suspensa-painel" role="listbox" aria-multiselectable>
          {extra}
          {buscavel && (
            <input
              className="suspensa-busca"
              placeholder="Digite um nome"
              value={filtroOpcoes}
              onChange={(e) => setFiltroOpcoes(e.target.value)}
              autoFocus
            />
          )}
          {opcoes.filter((o) => !filtroOpcoes || norm(o).includes(norm(filtroOpcoes))).map((o) => (
            <label key={o} className="suspensa-opcao">
              <input type="checkbox" checked={ativos.has(o)} onChange={() => alternar(o)} />
              {o}
            </label>
          ))}
          {ativos.size > 0 && (
            <button className="suspensa-limpar" onClick={limpar}>
              Limpar seleção
            </button>
          )}
        </div>
      )}
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
  const gestor = useFiltro();
  const [modoEquipe, setModoEquipe] = useState<"diretos" | "toda">("diretos");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [devAbertos, setDevAbertos] = useState<Set<string>>(new Set());
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

  // Gestores: só líderes com alguém da base de posições críticas na equipe (direta ou abaixo), ou seja, com posições
  // sendo trabalhadas. Nome da base, com acento, quando houver.
  const opcoesGestor = useMemo(() => {
    const daBase = new Map(data.people.map((p) => [norm(p.nome), p.nome]));
    const porNome = new Map<string, string>();
    for (const g of mapaDeLideranca(ctx).values()) {
      const k = norm(g);
      if (porNome.has(k) || ![...equipeDe(g, ctx, true)].some((n) => daBase.has(n))) continue;
      porNome.set(k, daBase.get(k) ?? g);
    }
    return [...porNome.values()].sort(collator.compare);
  }, [data.people, ctx]);
  const membros = useMemo(() => {
    if (!gestor.ativos.size) return null;
    const ids = new Set<string>();
    for (const g of gestor.ativos) for (const id of equipeDe(g, ctx, modoEquipe === "toda")) ids.add(id);
    return ids;
  }, [gestor.ativos, ctx, modoEquipe]);

  // Um interesse conta quando passa ao mesmo tempo pelos filtros de prioridade, prontidão e (se for o modo) nível de interesse.
  const interesseValido = (i: Interesse) =>
    (!prioridade.ativos.size || prioridade.ativos.has(`Prioridade ${i.prioridade}`)) &&
    (!prontidao.ativos.size || prontidao.ativos.has(labelOf(HORIZONTE, i.horizonte))) &&
    (modoNivel !== "interesse" || !nivel.ativos.size || i.niveis.some((n) => nivel.ativos.has(n)));

  const q = norm(busca);
  const visiveis = linhas.filter(
    (l) =>
      (!q || norm(`${l.person.nome} ${l.person.cargo}`).includes(q)) &&
      (!membros || membros.has(norm(l.person.nome))) &&
      (modoNivel !== "atual" || !nivel.ativos.size || nivel.ativos.has(l.person.nivel)) &&
      (!cidade.ativos.size || cidade.ativos.has(l.cidade)) &&
      (!mobilidade.ativos.size || mobilidade.ativos.has(l.mobilidade)) &&
      l.interesses.some(interesseValido),
  );

  // Para onde a equipe do gestor quer ir: cargos de interesse mais citados (P1 e P2).
  const equipe = membros
    ? (() => {
        const interessados = linhas.filter((l) => membros.has(norm(l.person.nome)));
        const cargos = new Map<string, { n: number; imediato: number }>();
        for (const l of interessados)
          for (const i of l.interesses) {
            const c = cargos.get(i.cargo) ?? { n: 0, imediato: 0 };
            c.n++;
            if (i.horizonte === "imediato") c.imediato++;
            cargos.set(i.cargo, c);
          }
        // A lista de liderança traz pessoas que não estão na base de posições críticas: não receberam o questionário.
        const naBase = new Set(data.people.map((p) => norm(p.nome)));
        const nomeDaLista = new Map(LIDERANCA.map((v) => [norm(v.colaborador), v.colaborador]));
        const fora = [...membros].filter((n) => !naBase.has(n)).map((n) => nomeDaLista.get(n) ?? n);
        return {
          total: membros.size,
          mapeados: membros.size - fora.length,
          fora: fora.sort(collator.compare),
          interessados: interessados.length,
          cargos: [...cargos.entries()].sort((a, b) => b[1].n - a[1].n || collator.compare(a[0], b[0])),
        };
      })()
    : null;

  const algumFiltro = !!(gestor.ativos.size || q || nivel.ativos.size || prontidao.ativos.size || cidade.ativos.size || prioridade.ativos.size || mobilidade.ativos.size);
  const limparTudo = () => {
    setBusca("");
    [gestor, nivel, prontidao, cidade, prioridade, mobilidade].forEach((f) => f.limpar());
  };
  const alternar = (set: typeof setAbertos) => (id: string) =>
    set((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarAberto = alternar(setAbertos);
  const alternarDev = alternar(setDevAbertos);
  const cadeira = cadeiraAberta ? data.chairs.find((c) => c.id === cadeiraAberta) : undefined;

  return (
    <>
      <div className="page-head">
        <h1>Busca por pessoa</h1>
        <p>Todas as pessoas que declararam interesse em alguma posição, e onde cada uma aparece como candidata.</p>
      </div>

      <div className="busca-filtros">
        <input className="busca-texto" placeholder="Buscar por nome ou cargo atual" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Suspensa
          titulo={modoEquipe === "diretos" ? "Gestor · diretos" : "Gestor · equipe"}
          opcoes={opcoesGestor}
          ativos={gestor.ativos}
          alternar={gestor.alternar}
          limpar={gestor.limpar}
          buscavel
          extra={
            <div className="filtro-modo">
              <button className={modoEquipe === "diretos" ? "ativo" : ""} onClick={() => setModoEquipe("diretos")}>
                Só diretos
              </button>
              <button className={modoEquipe === "toda" ? "ativo" : ""} onClick={() => setModoEquipe("toda")}>
                Toda a equipe
              </button>
            </div>
          }
        />
        <Suspensa
          titulo={modoNivel === "atual" ? "Cargo atual" : "Cargo de interesse"}
          opcoes={opcoesNivel}
          ativos={nivel.ativos}
          alternar={nivel.alternar}
          limpar={nivel.limpar}
          extra={
            <div className="filtro-modo">
              <button className={modoNivel === "atual" ? "ativo" : ""} onClick={() => setModoNivel("atual")}>
                Nível atual
              </button>
              <button className={modoNivel === "interesse" ? "ativo" : ""} onClick={() => setModoNivel("interesse")}>
                Nível de interesse
              </button>
            </div>
          }
        />
        <Suspensa titulo="Prontidão" opcoes={opcoesProntidao} ativos={prontidao.ativos} alternar={prontidao.alternar} limpar={prontidao.limpar} />
        <Suspensa titulo="Prioridade" opcoes={["Prioridade 1", "Prioridade 2"]} ativos={prioridade.ativos} alternar={prioridade.alternar} limpar={prioridade.limpar} />
        <Suspensa titulo="Mobilidade" opcoes={opcoesMobilidade} ativos={mobilidade.ativos} alternar={mobilidade.alternar} limpar={mobilidade.limpar} />
        <Suspensa titulo="Cidade" opcoes={opcoesCidade} ativos={cidade.ativos} alternar={cidade.alternar} limpar={cidade.limpar} />
      </div>

      {equipe && (
        <div className="equipe-resumo">
          <div className="equipe-titulo">
            {[...gestor.ativos].join(", ")} · {modoEquipe === "diretos" ? "subordinados diretos" : "toda a equipe"}
          </div>
          <div className="equipe-numeros">
            <span>
              <b>{equipe.total}</b> na equipe
            </span>
            <span>
              <b>{equipe.mapeados}</b> na base de posições críticas
            </span>
            <span>
              <b>{equipe.interessados}</b> com interesse declarado
            </span>
            <span>
              <b>{equipe.mapeados - equipe.interessados}</b> na base sem interesse declarado
            </span>
            <span>
              <b>{equipe.fora.length}</b> fora da base (não responderam o questionário)
            </span>
          </div>
          {equipe.fora.length > 0 && (
            <details className="equipe-pendentes">
              <summary>Quem está na equipe pela lista de liderança, mas fora da base de posições críticas</summary>
              <p>{equipe.fora.join(" · ")}</p>
            </details>
          )}
          {equipe.cargos.length > 0 && (
            <div className="equipe-cargos">
              <span className="equipe-rotulo">Para onde a equipe quer ir:</span>
              {equipe.cargos.map(([cargo, c]) => (
                <span key={cargo} className="chip azul">
                  {cargo} · {c.n}
                  {c.imediato ? ` (${c.imediato} imediato)` : ""}
                </span>
              ))}
            </div>
          )}
          {LIDERANCA_PENDENTES.length > 0 && (
            <details className="equipe-pendentes">
              <summary>{LIDERANCA_PENDENTES.length} pessoas da lista de liderança ainda sem líder identificado (fora de qualquer equipe)</summary>
              <p>{LIDERANCA_PENDENTES.join(" · ")}</p>
            </details>
          )}
        </div>
      )}

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
        <div className="empty">
          {equipe && equipe.mapeados === 0
            ? "Ninguém desta equipe está na base de posições críticas, então ninguém dela respondeu o questionário."
            : "Nenhuma pessoa com esses filtros."}
        </div>
      ) : (
        visiveis.map((l) => {
          const aberto = abertos.has(l.person.id);
          const devAberto = devAbertos.has(l.person.id);
          const m = l.melhor;
          return (
            <div key={l.person.id} className={`cand pessoa ${aberto || devAberto ? "aberto" : ""}`}>
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
                <div className="pessoa-botoes no-export">
                  <button className="ver-detalhes" onClick={() => alternarDev(l.person.id)} aria-expanded={devAberto}>
                    {devAberto ? "Desenvolvimento −" : "Desenvolvimento +"}
                  </button>
                  <button className="ver-detalhes" onClick={() => alternarAberto(l.person.id)} aria-expanded={aberto}>
                    {aberto ? "Ocultar posições −" : `Ver posições (${l.aparicoes.length}) +`}
                  </button>
                </div>
              </div>
              {devAberto && (
                <div className="cand-detalhes">
                  <div className="det-titulo">Pontos de desenvolvimento declarados</div>
                  <div className="dev-prioridades">
                    {([1, 2] as const).map((n) => {
                      const i = l.interesses.find((x) => x.prioridade === n);
                      const texto = n === 1 ? l.rec.desenvolvimento1 : l.rec.desenvolvimento2;
                      return (
                        <div key={n} className="dev-prioridade">
                          <div className="det-rotulo">Prioridade {n}</div>
                          {i ? (
                            <>
                              <div className="dev-cargo">
                                {i.cargo}
                                <span className="horizonte"> · {labelOf(HORIZONTE, i.horizonte) || "horizonte não informado"}</span>
                              </div>
                              <div className={`dev-texto ${texto ? "" : "vazio"}`}>{texto || "Pontos de desenvolvimento não informados"}</div>
                            </>
                          ) : (
                            <div className="dev-texto vazio">Não declarou Prioridade {n}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {aberto && (
                <div className="cand-detalhes">
                  <div className="det-titulo">Posições em que aparece como candidata</div>
                  {l.aparicoes.length ? (
                    <div className="table-wrap">
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
                    </div>
                  ) : (
                    <div className="empty">
                      Não aparece em nenhuma posição: o cargo informado não existe na base ou corresponde apenas à posição que a pessoa
                      já ocupa.
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
