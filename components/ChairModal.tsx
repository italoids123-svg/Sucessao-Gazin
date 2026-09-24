"use client";

import { useEffect } from "react";
import { CONTINUIDADE, CONVERSA, CORTE_ADERENCIA, HORIZONTE, labelOf } from "@/lib/config.ts";
import { occupantOf } from "@/lib/engine.ts";
import { useStore } from "@/lib/store.tsx";
import type { Candidate, Chair } from "@/lib/types.ts";

const iniciais = (nome: string) =>
  nome
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function statusDe(c: Candidate): { cor: string; texto: string } {
  if (c.grupo === "fora") return { cor: "vermelho", texto: "Fora da hierarquia" };
  if (c.score < CORTE_ADERENCIA) return { cor: "vermelho", texto: "Abaixo do corte" };
  if (c.score < 80) return { cor: "amarelo", texto: "Aderência média" };
  return { cor: "verde", texto: "Alta aderência" };
}

function CandidateRow({ c }: { c: Candidate }) {
  const st = statusDe(c);
  const conversa = labelOf(CONVERSA, c.record.conversaDesenvolvimento);
  const continuidade = labelOf(CONTINUIDADE, c.record.continuidade);
  return (
    <div className="cand">
      <div className={`avatar ${c.indicadoPeloLider ? "star" : ""}`} title={c.indicadoPeloLider ? "Indicado pelo líder atual" : undefined}>
        {c.indicadoPeloLider ? "★" : iniciais(c.person.nome)}
      </div>
      <div>
        <div className="nome">
          {c.person.nome}
          {c.indicadoPeloLider && (
            <span className="star" title="Indicado nominalmente pelo ocupante atual">
              ★
            </span>
          )}
        </div>
        <div className="sub">
          {c.person.cargo || "Sem cargo informado"} · {c.person.nivel}
        </div>
      </div>
      <div className="col-prio sub">
        <b>Prioridade {c.prioridade}</b>
        <br />
        {labelOf(HORIZONTE, c.horizonte) || "Horizonte não informado"}
      </div>
      <div className="badges">
        {conversa && <span className={`chip ${c.record.conversaDesenvolvimento === "andamento" ? "azul" : ""}`}>PDI: {conversa}</span>}
        {continuidade && <span className="chip">Continuidade: {continuidade}</span>}
      </div>
      <div className="score">{c.score}</div>
      <div className={`pill ${st.cor}`}>{st.texto}</div>
      <div className="breakdown">
        {c.criterios.map((k) => (
          <span key={k.key} className={k.aplicavel ? "" : "na"} title={k.detalhe}>
            {k.label}: {k.aplicavel ? `${Math.round(k.pontos * 10) / 10}/${k.max}` : "n/a"}
          </span>
        ))}
      </div>
    </div>
  );
}

function Lista({ titulo, itens, vazio }: { titulo: string; itens: Candidate[]; vazio: string }) {
  return (
    <>
      <div className="section-title">
        {titulo} ({itens.length})
      </div>
      {itens.length ? itens.map((c) => <CandidateRow key={c.person.id} c={c} />) : <div className="empty">{vazio}</div>}
    </>
  );
}

export default function ChairModal({ chair, onClose }: { chair: Chair; onClose: () => void }) {
  const { results, ctx } = useStore();
  const r = results.get(chair.id)!;
  const ocupante = occupantOf(chair, ctx);
  const recOcupante = ocupante ? ctx.succession[ocupante.id] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const vago = chair.vago || !chair.nome;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={chair.cargo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{chair.cargo}</h2>
            <p>
              {vago ? "Posição vaga" : `Ocupante atual: ${chair.nome}`} · {chair.nivel} · {chair.diretoria}
              {chair.cidade ? ` · ${chair.cidade}` : " · cidade não informada"}
              {chair.gestor ? ` · Gestor: ${chair.gestor}${chair.gestorCargo ? ` (${chair.gestorCargo})` : ""}` : ""}
            </p>
          </div>
          <button className="close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="group-kpis">
            <div className="group-kpi verde">
              <div className="n">{r.dentro.length}</div>
              <div className="t">Interessados dentro da pontuação de aderência</div>
              <div className="s">Nível elegível, interesse declarado e pontuação ≥ {CORTE_ADERENCIA}.</div>
            </div>
            <div className="group-kpi amarelo">
              <div className="n">{r.abaixo.length}</div>
              <div className="t">Interessados abaixo da pontuação de aderência</div>
              <div className="s">Nível elegível e interesse declarado, mas pontuação &lt; {CORTE_ADERENCIA}.</div>
            </div>
            <div className="group-kpi vermelho">
              <div className="n">{r.fora.length}</div>
              <div className="t">Interessados fora da hierarquia elegível</div>
              <div className="s">Declararam interesse, mas o nível atual não alimenta este cargo.</div>
            </div>
          </div>

          <div className="leader-box">
            {vago ? (
              <>Posição vaga: sem indicação nominal de líder.</>
            ) : recOcupante?.possivelSucessorTexto || recOcupante?.continuidade ? (
              <>
                Indicação do ocupante: <b>{recOcupante.possivelSucessorTexto || "nenhuma"}</b>
                {recOcupante.continuidade ? (
                  <>
                    {" "}
                    · Continuidade da posição: <b>{labelOf(CONTINUIDADE, recOcupante.continuidade)}</b>
                  </>
                ) : null}
              </>
            ) : (
              <>O ocupante ainda não respondeu quem indica como possível sucessor.</>
            )}
          </div>

          <Lista titulo="Dentro da pontuação de aderência" itens={r.dentro} vazio="Nenhum sucessor mapeado para esta posição." />
          <Lista titulo="Abaixo da pontuação de aderência" itens={r.abaixo} vazio="Ninguém nesta faixa." />
          <Lista titulo="Fora da hierarquia elegível" itens={r.fora} vazio="Ninguém nesta faixa." />
        </div>
      </div>
    </div>
  );
}
