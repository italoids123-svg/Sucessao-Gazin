"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NIVEIS } from "@/lib/config.ts";
import { resumoCobertura } from "@/lib/engine.ts";
import { useStore } from "@/lib/store.tsx";
import CoverageBar from "./CoverageBar";

const collator = new Intl.Collator("pt-BR");

function MiniBar({ verde, amarelo, vermelho, total }: { verde: number; amarelo: number; vermelho: number; total: number }) {
  return (
    <div className="mini-bar">
      {[["verde", verde], ["amarelo", amarelo], ["vermelho", vermelho]].map(([k, n]) =>
        (n as number) > 0 ? <div key={k as string} className={k as string} style={{ width: `${((n as number) / total) * 100}%` }} /> : null,
      )}
    </div>
  );
}

export default function Overview() {
  const { data, results, ctx } = useStore();
  const router = useRouter();
  const all = resumoCobertura(data.chairs.map((c) => results.get(c.id)!));
  const respondentes = data.people.filter((p) => {
    const r = data.succession[p.id];
    return r && (r.prioridade1 || r.mobilidade || r.desempenho || r.possivelSucessorTexto);
  }).length;
  const respPct = data.people.length ? Math.round((respondentes / data.people.length) * 100) : 0;

  const porNivel = NIVEIS.filter((n) => n.temPagina).map((n) => {
    const chairs = data.chairs.filter((c) => c.nivel === n.nome);
    return { n, resumo: resumoCobertura(chairs.map((c) => results.get(c.id)!)) };
  });
  const diretorias = [...new Set(data.chairs.map((c) => c.diretoria))].sort(collator.compare).map((d) => ({
    d,
    resumo: resumoCobertura(data.chairs.filter((c) => c.diretoria === d).map((c) => results.get(c.id)!)),
  }));

  // Qualidade da base: lacunas que distorcem o cálculo.
  const semCidade = data.chairs.filter((c) => !c.cidade).length;
  const vagas = data.chairs.filter((c) => c.vago || !c.nome);
  const multi = data.people.filter((p) => (p.chairIds?.length ?? 0) > 1);
  const vezesSucessor = new Map<string, number>();
  for (const r of results.values()) for (const c of r.dentro) vezesSucessor.set(c.person.id, (vezesSucessor.get(c.person.id) ?? 0) + 1);
  const compartilhados = [...vezesSucessor.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ nome: ctx.peopleById.get(id)?.nome ?? id, n }));
  const niveisSemPool = NIVEIS.filter((n) => n.temPagina)
    .map((n) => ({ n: n.nome, alimentadores: ctx.hierMap[n.nome] ?? [] }))
    .filter(({ alimentadores }) => !data.people.some((p) => alimentadores.includes(p.nivel)));

  return (
    <>
      <div className="page-head">
        <h1>Visão geral</h1>
        <p>Cobertura sucessória das posições críticas da Gazin, por nível e por diretoria.</p>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Posições críticas</div>
          <div className="kpi-value">{data.chairs.length}</div>
          <div className="kpi-sub">{data.people.length} pessoas na base</div>
        </div>
        <div className="kpi wide">
          <div className="kpi-label">Cobertura sucessória · todas as posições</div>
          <CoverageBar {...all} />
        </div>
        <div className="kpi">
          <div className="kpi-label">Questionário respondido</div>
          <div className="kpi-value">{respPct}%</div>
          <div className="kpi-sub">
            {respondentes} de {data.people.length} pessoas
          </div>
          <div className="progress">
            <div style={{ width: `${respPct}%` }} />
          </div>
        </div>
      </div>

      {respondentes === 0 && (
        <div className="callout warn">
          Nenhum questionário foi importado ainda. Sem interesse declarado não existe sucessor calculado, então todas as posições
          aparecem sem sucessor. Use <b>Baixar base para coleta</b>, preencha a aba <b>Base de dados</b> e carregue de volta.
        </div>
      )}

      <div className="doc">
        <h2>Cobertura por nível</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Nível</th>
              <th className="num">Posições</th>
              <th>Cobertura</th>
              <th className="num">2 ou mais</th>
              <th className="num">1</th>
              <th className="num">0</th>
            </tr>
          </thead>
          <tbody>
            {porNivel.map(({ n, resumo }) => (
              <tr key={n.slug} className="overview-row" onClick={() => router.push(`/nivel/${n.slug}`)}>
                <td>
                  <Link href={`/nivel/${n.slug}`}>{n.nome}</Link>
                </td>
                <td className="num">{resumo.total}</td>
                <td>
                  <MiniBar {...resumo} />
                </td>
                <td className="num">{resumo.verde}</td>
                <td className="num">{resumo.amarelo}</td>
                <td className="num">{resumo.vermelho}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Cobertura por diretoria</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Diretoria / área</th>
              <th className="num">Posições</th>
              <th>Cobertura</th>
              <th className="num">2 ou mais</th>
              <th className="num">1</th>
              <th className="num">0</th>
            </tr>
          </thead>
          <tbody>
            {diretorias.map(({ d, resumo }) => (
              <tr key={d}>
                <td>{d}</td>
                <td className="num">{resumo.total}</td>
                <td>
                  <MiniBar {...resumo} />
                </td>
                <td className="num">{resumo.verde}</td>
                <td className="num">{resumo.amarelo}</td>
                <td className="num">{resumo.vermelho}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Qualidade da base</h2>
        <ul>
          <li>
            <b>{semCidade}</b> de {data.chairs.length} posições sem cidade: nelas a mobilidade não filtra ninguém (continua pontuando pela
            amplitude declarada). Preencha na aba <b>Cadeiras</b>, no formato Cidade/Estado (por exemplo, Douradina/PR).
          </li>
          {vagas.length > 0 && (
            <li>
              <b>{vagas.length}</b> posição(ões) vaga(s): {vagas.map((c) => c.cargo).join(", ")}.
            </li>
          )}
          {multi.map((p) => (
            <li key={p.id}>
              <b>{p.nome}</b> ocupa {p.chairIds!.length} posições críticas (
              {p.chairIds!.map((id) => ctx.chairsById.get(id)?.cargo).join(" e ")}): risco concentrado em uma pessoa.
            </li>
          ))}
          {compartilhados.length > 0 && (
            <li>
              <b>{compartilhados.length}</b> pessoa(s) contam como sucessoras em mais de uma posição (
              {compartilhados
                .slice(0, 3)
                .map((c) => `${c.nome}: ${c.n}`)
                .join("; ")}
              {compartilhados.length > 3 ? "; …" : ""}). Cada uma só pode assumir uma posição: a cobertura real é menor que a exibida.
            </li>
          )}
          {niveisSemPool.map(({ n, alimentadores }) => (
            <li key={n}>
              <b>{n}</b>: nenhuma pessoa na base pertence aos níveis que a alimentam ({alimentadores.join(", ") || "nenhum"}). A
              cobertura desse nível fica zerada até essas pessoas serem incluídas pela planilha.
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
