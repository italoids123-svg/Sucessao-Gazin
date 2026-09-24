"use client";

import Link from "next/link";
import { CORTE_ADERENCIA, NIVEIS, PESOS } from "@/lib/config.ts";
import { useStore } from "@/lib/store.tsx";

export default function Page() {
  const { ctx } = useStore();
  const linhas: [string, number, string][] = [
    ["Avaliação de desempenho (ciclo atual)", PESOS.desempenho, "Faixa de Resultado × Comportamento. Não avaliado: 0."],
    ["Indicação do líder", PESOS.indicacaoLider, "O ocupante da posição citou o candidato pelo nome e sobrenome."],
    ["Interesse autodeclarado", PESOS.interesse, "O candidato se indicou à posição como Prioridade 1 ou 2."],
    ["Pesquisa de clima 2026", PESOS.clima, "Faixa de e-NPS da área. Só para quem lidera equipe."],
    ["Prontidão declarada", PESOS.prontidao, "Horizonte declarado para assumir a posição."],
    ["Mobilidade", PESOS.mobilidade, "Amplitude geográfica aceita: local, matriz, estado ou qualquer unidade."],
  ];
  return (
    <>
      <div className="page-head">
        <h1>Elegibilidade e Aderência</h1>
        <p>Como o painel decide quem é sucessor de cada posição.</p>
      </div>
      <div className="doc">
        <h2>1. Quem aparece em uma posição</h2>
        <p>
          Aparece quem se indicou ao cargo exato da posição (Prioridade 1 ou 2) <b>ou</b> foi indicado nominalmente pelo ocupante
          atual, desde que a mobilidade declarada alcance a cidade da posição. O ocupante nunca aparece como sucessor da própria
          posição. A diretoria/área é só informação de exibição e filtro: nunca bloqueia.
        </p>

        <h2>2. Pontuação de aderência (0 a 100)</h2>
        <p>
          Calculada para cada par pessoa × posição, porque indicação e interesse dependem da posição-alvo. Escalas completas em{" "}
          <Link href="/metodologia/criterios">Critérios</Link>.
        </p>
        <table className="t">
          <thead>
            <tr>
              <th>Critério</th>
              <th className="num">Pontos</th>
              <th>Regra</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(([c, p, r]) => (
              <tr key={c}>
                <td>{c}</td>
                <td className="num">{p}</td>
                <td>{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="callout">
          Total = soma dos critérios aplicáveis ÷ soma dos pontos aplicáveis × 100, arredondado. Para quem não lidera equipe, a base é{" "}
          {100 - PESOS.clima} pontos.
        </div>

        <h2>3. Régua de corte</h2>
        <p>
          Com <b>{CORTE_ADERENCIA} pontos ou mais</b> a pessoa é sucessor mapeado. Cada posição separa os candidatos em três grupos:
        </p>
        <ul>
          <li>
            <b>Dentro da pontuação de aderência</b>: nível elegível e pontuação ≥ {CORTE_ADERENCIA}. Só este grupo conta na cobertura
            (verde = 2+, âmbar = 1, vermelho = 0).
          </li>
          <li>
            <b>Abaixo da pontuação de aderência</b>: nível elegível, pontuação &lt; {CORTE_ADERENCIA}.
          </li>
          <li>
            <b>Fora da hierarquia elegível</b>: o nível atual não alimenta o cargo.
          </li>
        </ul>
        <div className="callout warn">
          Mobilidade também é filtro nos três grupos: quem declarou que não vai até a cidade da posição não aparece nela. Isso evita
          que uma pessoa interessada em &quot;Gerente regional&quot; conte como sucessora das 15 regionais quando só aceita a própria
          cidade.
        </div>

        <h2>4. Hierarquia de elegibilidade</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Nível da posição</th>
              <th>Níveis elegíveis para sucessão</th>
            </tr>
          </thead>
          <tbody>
            {NIVEIS.filter((n) => n.temPagina).map((n) => (
              <tr key={n.slug}>
                <td>{n.nome}</td>
                <td>{(ctx.hierMap[n.nome] ?? []).join(", ") || "Nenhum nível configurado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>A hierarquia pode ser ampliada pela aba &quot;Hierarquia&quot; da planilha de coleta.</p>

        <h2>5. Como os níveis foram definidos</h2>
        <p>A planilha de posições críticas não traz nível. Ele foi derivado do cargo e da linha de reporte:</p>
        <ul>
          <li><b>Diretoria</b>: cargos &quot;Diretoria …&quot; e Controller.</li>
          <li>
            <b>Gerência Executiva</b>: gerentes que respondem à Presidência ou que têm outro gerente abaixo deles (estendido às demais
            posições do mesmo cargo).
          </li>
          <li><b>Gerência</b>, <b>Coordenação</b>, <b>Supervisão</b>: pelo título do cargo.</li>
          <li><b>Especialista</b>: posições técnicas sem liderança (administração de redes e banco de dados, dados, tech lead).</li>
        </ul>
        <p>Qualquer ajuste de nível pode ser feito pela coluna &quot;Nível&quot; da aba Cadeiras.</p>
      </div>
    </>
  );
}
