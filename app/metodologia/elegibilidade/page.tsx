"use client";

import { CORTE_ADERENCIA, NIVEIS, PESOS, PESO_CICLO_ANTERIOR, PESO_CICLO_ATUAL } from "@/lib/config.ts";
import { useStore } from "@/lib/store.tsx";

export default function Page() {
  const { ctx } = useStore();
  const base = Object.values(PESOS).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="page-head">
        <h1>Elegibilidade e Aderência</h1>
        <p>Como o painel decide quem é sucessor de cada posição.</p>
      </div>
      <div className="doc">
        <h2>1. Elegibilidade por nível</h2>
        <p>
          Uma pessoa só é candidata a uma posição se o nível dela alimenta o nível da posição (tabela abaixo) e se ela declarou
          interesse no cargo exato da posição como Prioridade 1 ou 2. A diretoria/área é apenas informação de exibição e filtro:
          nunca bloqueia elegibilidade. O ocupante atual nunca aparece como sucessor da própria posição.
        </p>

        <h2>2. Pontuação de aderência (0 a 100)</h2>
        <p>Calculada para cada par pessoa × posição, porque indicação do líder e mobilidade dependem da posição-alvo.</p>
        <table className="t">
          <thead>
            <tr>
              <th>Critério</th>
              <th className="num">Peso</th>
              <th>Regra</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nine Box</td>
              <td className="num">{PESOS.nineBox}</td>
              <td>
                Com os dois ciclos: {PESO_CICLO_ANTERIOR * 100}% de 2025 + {PESO_CICLO_ATUAL * 100}% de 2026. Com um ciclo só: 100% dele.
                Sem avaliação: 0.
              </td>
            </tr>
            <tr>
              <td>Indicação nominal do líder</td>
              <td className="num">{PESOS.indicacao}</td>
              <td>O ocupante da posição-alvo citou o candidato pelo nome (nome + sobrenome) e o candidato declarou interesse nela.</td>
            </tr>
            <tr>
              <td>Favorabilidade do time</td>
              <td className="num">{PESOS.favorabilidade}</td>
              <td>
                Só para quem lidera equipe hoje: % de favorabilidade × {PESOS.favorabilidade}. Quem não lidera disputa sobre base de{" "}
                {base - PESOS.favorabilidade} pontos, sem ser penalizado.
              </td>
            </tr>
            <tr>
              <td>Interesse declarado</td>
              <td className="num">{PESOS.interesse}</td>
              <td>Pontos pelo horizonte informado para esse cargo (quanto mais imediato, mais pontos).</td>
            </tr>
            <tr>
              <td>Mobilidade geográfica</td>
              <td className="num">{PESOS.mobilidade}</td>
              <td>
                Pontua integralmente quando a mobilidade declarada alcança a cidade da posição. Sem cidade ou sem resposta, o critério
                sai da base (não pontua nem penaliza).
              </td>
            </tr>
          </tbody>
        </table>
        <div className="callout">
          Total = soma dos critérios aplicáveis ÷ soma dos pesos aplicáveis × 100, arredondado.
        </div>

        <h2>3. Régua de corte</h2>
        <p>
          Com <b>{CORTE_ADERENCIA} pontos ou mais</b> a pessoa é sucessor mapeado. Cada posição separa os interessados em três grupos:
        </p>
        <ul>
          <li>
            <b>Dentro da pontuação de aderência</b>: nível elegível + interesse + pontuação ≥ {CORTE_ADERENCIA}. Só este grupo conta na
            cobertura (verde = 2+, âmbar = 1, vermelho = 0).
          </li>
          <li>
            <b>Abaixo da pontuação de aderência</b>: nível elegível + interesse, pontuação &lt; {CORTE_ADERENCIA}.
          </li>
          <li>
            <b>Fora da hierarquia elegível</b>: declarou interesse, mas o nível atual não alimenta o cargo.
          </li>
        </ul>
        <div className="callout warn">
          Mobilidade é filtro nos três grupos: quem declarou que não vai até a cidade da posição não aparece nela. Isso evita que uma
          pessoa interessada em &quot;Gerente regional&quot; conte como sucessora das 15 regionais quando só aceita a própria cidade.
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
