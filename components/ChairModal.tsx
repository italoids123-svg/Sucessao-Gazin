"use client";

import { useEffect, useRef, useState } from "react";
import { CONTINUIDADE, CORTE_ADERENCIA, DESEMPENHO, HORIZONTE, MOBILIDADE, labelOf } from "@/lib/config.ts";
import { fmtPontos, occupantOf, resolverIndicacao } from "@/lib/engine.ts";
import { useStore } from "@/lib/store.tsx";
import type { Candidate, Chair } from "@/lib/types.ts";
import ExportMenu from "./ExportMenu";

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
  if (c.score < 80) return { cor: "amarelo", texto: "Média aderência" };
  return { cor: "verde", texto: "Alta aderência" };
}

// Textos curtos para os selos da linha e textos por extenso para o contexto detalhado.
const SELO_CONVERSA: Record<string, string> = {
  andamento: "Desenvolvimento: plano em andamento",
  sem_formalizar: "Desenvolvimento: conversado, sem plano formal",
  nao: "Desenvolvimento: sem plano",
};
const SELO_CONTINUIDADE: Record<string, string> = {
  imediata: "Com sucessor indicado e pronto",
  com_suporte: "Com sucessor indicado, com suporte",
  nao_identifico: "Sem sucessor identificado",
  sem_elementos: "Sucessão sem elementos para avaliar",
};
const PLANO_FORMAL: Record<string, string> = {
  andamento: "Sim, com ações em andamento",
  sem_formalizar: "Conversado, mas sem plano formal",
  nao: "Não",
};
const SUCESSOR_PROPRIO: Record<string, string> = {
  imediata: "Sim, imediatamente",
  com_suporte: "Sim, com suporte",
  nao_identifico: "Não identifica sucessor",
  sem_elementos: "Sem elementos para avaliar",
};

interface Cartao {
  titulo: string;
  sub: string;
  pontos: number;
  max: number;
  aplicavel: boolean;
}

/** Os cinco critérios do material, com "match de indicação" somando líder + autoindicação. */
function cartoesDe(c: Candidate): Cartao[] {
  const k = Object.fromEntries(c.criterios.map((x) => [x.key, x]));
  const desempenho = DESEMPENHO.find((d) => d.code === c.record.desempenho);
  const mob = labelOf(MOBILIDADE, c.record.mobilidade);
  return [
    {
      titulo: "Avaliação de desempenho",
      sub: desempenho ? `${desempenho.label} (ciclo atual)` : "Não avaliado no ciclo",
      pontos: k.desempenho.pontos,
      max: k.desempenho.max,
      aplicavel: true,
    },
    {
      titulo: "Match de indicação",
      sub: `Líder: ${c.indicadoPeloLider ? "indicou" : "não indicou"} · Autoindicação: ${c.prioridade ? "sim" : "não"}`,
      pontos: k.indicacaoLider.pontos + k.interesse.pontos,
      max: k.indicacaoLider.max + k.interesse.max,
      aplicavel: true,
    },
    {
      titulo: "Pesquisa de clima",
      sub: k.clima.aplicavel
        ? typeof c.record.enps2026 === "number"
          ? `e-NPS 2026: ${c.record.enps2026}`
          : "Sem resultado de clima 2026"
        : "Não lidera equipe",
      pontos: k.clima.pontos,
      max: k.clima.max,
      aplicavel: k.clima.aplicavel,
    },
    {
      titulo: "Prontidão declarada",
      sub: labelOf(HORIZONTE, c.horizonte) || (c.prioridade ? "Horizonte não informado" : "Não se candidatou"),
      pontos: k.prontidao.pontos,
      max: k.prontidao.max,
      aplicavel: true,
    },
    {
      titulo: "Mobilidade",
      sub: mob ? `Abrangência: ${mob}` : "Não informada",
      pontos: k.mobilidade.pontos,
      max: k.mobilidade.max,
      aplicavel: true,
    },
  ];
}

function Detalhes({ c }: { c: Candidate }) {
  const aplic = c.criterios.filter((x) => x.aplicavel);
  const obtidos = aplic.reduce((s, x) => s + x.pontos, 0);
  const base = aplic.reduce((s, x) => s + x.max, 0);
  const lacunas =
    c.prioridade === 1 ? c.record.desenvolvimento1 : c.prioridade === 2 ? c.record.desenvolvimento2 : undefined;
  const sucessorProprio = SUCESSOR_PROPRIO[c.record.continuidade ?? ""];
  return (
    <div className="cand-detalhes">
      <div className="det-titulo">Composição da pontuação · base de {fmtPontos(base)} pontos aplicáveis</div>
      <div className="det-cartoes">
        {cartoesDe(c).map((k) => (
          <div key={k.titulo} className={`det-cartao ${k.aplicavel ? "" : "na"}`}>
            <div className="det-nome">{k.titulo}</div>
            <div className="det-sub">{k.sub}</div>
            <div className="det-pontos">{k.aplicavel ? `${fmtPontos(k.pontos)}/${fmtPontos(k.max)}` : "Não se aplica"}</div>
          </div>
        ))}
      </div>
      <div className="det-formula">
        {fmtPontos(obtidos)} pontos obtidos ÷ {fmtPontos(base)} aplicáveis × 100 = <b>{fmtPontos(c.score)}</b>
      </div>
      <div className="det-titulo">Contexto para a posição</div>
      <div className="det-contexto">
        <div>
          <div className="det-rotulo">Pontos de desenvolvimento para essa posição</div>
          <div>{c.prioridade ? lacunas || "Não informados" : "Não se candidatou a esta posição"}</div>
        </div>
        <div>
          <div className="det-rotulo">Plano de desenvolvimento formal</div>
          <div>{PLANO_FORMAL[c.record.conversaDesenvolvimento ?? ""] ?? "Não informado"}</div>
        </div>
        <div>
          <div className="det-rotulo">Sucessor indicado (posição atual desta pessoa)</div>
          <div>
            {sucessorProprio ?? "Não informado"}
            {c.record.possivelSucessorTexto ? ` · ${c.record.possivelSucessorTexto}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateRow({ c }: { c: Candidate }) {
  const [aberto, setAberto] = useState(false);
  const st = statusDe(c);
  const seloConversa = SELO_CONVERSA[c.record.conversaDesenvolvimento ?? ""];
  const seloContinuidade = SELO_CONTINUIDADE[c.record.continuidade ?? ""];
  return (
    <div className={`cand ${aberto ? "aberto" : ""}`}>
      <div className="cand-linha">
        <div className={`avatar ${c.indicadoPeloLider ? "star" : ""}`} title={c.indicadoPeloLider ? "Indicado pelo líder atual" : undefined}>
          {c.indicadoPeloLider ? "★" : iniciais(c.person.nome)}
        </div>
        <div>
          <div className="nome">{c.person.nome}</div>
          <div className="sub">
            {c.person.cargo || "Sem cargo informado"} · {c.person.nivel}
          </div>
        </div>
        <div className="col-prio">
          {c.prioridade ? (
            <>
              <b>Prioridade {c.prioridade}</b>
              <div className="horizonte">{labelOf(HORIZONTE, c.horizonte) || "Horizonte não informado"}</div>
            </>
          ) : (
            <>
              <b>Indicado pelo líder</b>
              <div className="horizonte">Não se candidatou</div>
            </>
          )}
        </div>
        <div className="badges">
          {seloConversa && <span className={`selo ${c.record.conversaDesenvolvimento === "andamento" ? "ok" : ""}`}>{seloConversa}</span>}
          {seloContinuidade && (
            <span className={`selo ${c.record.continuidade === "imediata" || c.record.continuidade === "com_suporte" ? "ok" : ""}`}>
              {seloContinuidade}
            </span>
          )}
        </div>
        <div className="score">
          {fmtPontos(c.score)}
          <span>pontos</span>
        </div>
        <div className={`pill ${st.cor}`}>{st.texto}</div>
        <button className="ver-detalhes no-export" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
          {aberto ? "Ocultar detalhes −" : "Ver detalhes +"}
        </button>
      </div>
      {aberto && <Detalhes c={c} />}
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
  const ambiguos = resolverIndicacao(recOcupante?.possivelSucessorTexto, ctx.people).ambiguos;

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
  const modalRef = useRef<HTMLDivElement>(null);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-label={chair.cargo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{chair.cargo}</h2>
            <p>
              {vago ? "Posição vaga" : `Ocupante atual: ${chair.nome}`} · {chair.nivel} · {chair.diretoria}
              {chair.cidade ? ` · ${chair.cidade}` : " · cidade não informada"}
              {chair.gestor ? ` · Gestor: ${chair.gestor}${chair.gestorCargo ? ` (${chair.gestorCargo})` : ""}` : ""}
            </p>
          </div>
          <div className="modal-tools no-export">
            <ExportMenu alvo={() => modalRef.current} titulo={() => `${chair.cargo} - ${vago ? "Posição vaga" : chair.nome}`} />
            <button className="close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="group-kpis">
            <div className="group-kpi verde">
              <div className="n">{r.dentro.length}</div>
              <div className="t">Interessados dentro da pontuação de aderência</div>
              <div className="s">Nível elegível, se indicou ou foi indicado pelo líder, e pontuação ≥ {CORTE_ADERENCIA}.</div>
            </div>
            <div className="group-kpi amarelo">
              <div className="n">{r.abaixo.length}</div>
              <div className="t">Interessados abaixo da pontuação de aderência</div>
              <div className="s">Nível elegível, se indicou ou foi indicado pelo líder, mas pontuação &lt; {CORTE_ADERENCIA}.</div>
            </div>
            <div className="group-kpi vermelho">
              <div className="n">{r.fora.length}</div>
              <div className="t">Interessados fora da hierarquia elegível</div>
              <div className="s">Se indicaram ou foram indicados, mas o nível atual não alimenta este cargo.</div>
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
            {ambiguos.map((a) => (
              <div key={a.trecho} style={{ marginTop: 6, color: "var(--amarelo)" }}>
                ⚠ &quot;{a.trecho.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase())}&quot; corresponde a {a.pessoas.length} pessoas ({a.pessoas.map((x) => x.nome).join(", ")}): a
                indicação só conta para quem também se indicou à posição. Peça ao líder o nome completo.
              </div>
            ))}
          </div>

          <Lista titulo="Dentro da pontuação de aderência" itens={r.dentro} vazio="Nenhum sucessor mapeado para esta posição." />
          <Lista titulo="Abaixo da pontuação de aderência" itens={r.abaixo} vazio="Ninguém nesta faixa." />
          <Lista titulo="Fora da hierarquia elegível" itens={r.fora} vazio="Ninguém nesta faixa." />
        </div>
      </div>
    </div>
  );
}
