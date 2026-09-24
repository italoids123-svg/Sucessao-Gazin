import { CLIMA_FAIXAS, DESEMPENHO, HORIZONTE, MOBILIDADE, PESOS, SEDE } from "@/lib/config.ts";

const fmt = (n: number) => n.toLocaleString("pt-BR");

function Tabela({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <table className="t">
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={c} className={i === cols.length - 1 ? "num" : undefined}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])}>
            {r.map((v, i) => (
              <td key={i} className={i === r.length - 1 ? "num" : undefined}>
                {typeof v === "number" ? fmt(v) : v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Page() {
  return (
    <>
      <div className="page-head">
        <h1>Critérios</h1>
        <p>Os cinco critérios da pontuação de aderência e a escala de pontos de cada um (total: 100 pontos).</p>
      </div>
      <div className="doc">
        <h2>1. Avaliação de desempenho · ciclo atual ({PESOS.desempenho} pontos)</h2>
        <p>Resultado da avaliação de desempenho aplicada no período, combinando Resultado e Comportamento.</p>
        <Tabela
          cols={["Faixa de atingimento", "Resultado · Comportamento", "Pontos"]}
          rows={[...DESEMPENHO.map((d) => [d.label, d.descricao, d.pontos]), ["Não avaliado", "Sem avaliação no ciclo", 0]]}
        />
        <div className="callout">
          A régua privilegia Comportamento: qualquer faixa com Comportamento alto (22 a 30) fica acima de qualquer faixa com
          Comportamento médio (10 a 18), mesmo com Resultado alto.
        </div>

        <h2>2. Match de indicação ({PESOS.indicacaoLider + PESOS.interesse} pontos)</h2>
        <Tabela
          cols={["Ponta do match", "Pontos"]}
          rows={[
            ["Líder declara a pessoa como potencial sucessor", PESOS.indicacaoLider],
            ["Colaborador se indica à posição (Prioridade 1 ou 2)", PESOS.interesse],
          ]}
        />
        <p>
          Basta uma das pontas para a pessoa aparecer na posição. A indicação do líder vale quando um trecho do texto livre do ocupante
          tem nome e sobrenome do candidato (&quot;João Silva&quot; indica &quot;João Carlos da Silva&quot;; &quot;João&quot; sozinho
          não indica).
        </p>

        <h2>3. Pesquisa de clima 2026 ({PESOS.clima} pontos)</h2>
        <p>Mede o clima da área pelo e-NPS da pesquisa aplicada em 2026.</p>
        <Tabela cols={["Faixa de e-NPS 2026", "Pontos"]} rows={CLIMA_FAIXAS.map((f) => [f.label, f.pontos])} />
        <div className="callout warn">
          Aplicado só a quem lidera equipe hoje. Quem não lidera é avaliado sobre {100 - PESOS.clima} pontos, sem ser penalizado pela
          ausência do critério.
        </div>

        <h2>4. Prontidão declarada ({PESOS.prontidao} pontos)</h2>
        <p>
          Horizonte que a pessoa declara para assumir a posição. Mede a percepção de timing e não substitui a avaliação objetiva de
          capacidade e aderência à cadeira.
        </p>
        <Tabela cols={["Prazo declarado", "Pontos"]} rows={HORIZONTE.map((h) => [h.label, h.pontos])} />
        <p>Registre a data da conversa de carreira: o interesse muda ao longo do tempo.</p>

        <h2>5. Mobilidade ({PESOS.mobilidade} pontos)</h2>
        <p>
          Amplitude geográfica que o candidato aceita para assumir o desafio. Quem aceita mais flexibilidade amplia o leque de posições
          que pode suceder.
        </p>
        <Tabela cols={["Disponibilidade declarada", "Pontos"]} rows={MOBILIDADE.map((m) => [m.label, m.pontos])} />
        <p>Além de pontuar, a mobilidade define em quais posições a pessoa aparece:</p>
        <ul>
          <li><b>Local atual</b>: só posições na própria cidade.</li>
          <li><b>Matriz</b>: só posições em {SEDE}, mesmo que a pessoa já esteja em outra cidade que tenha a posição.</li>
          <li><b>Dentro do Estado</b>: posições na mesma UF da cidade atual.</li>
          <li><b>Total</b>: qualquer unidade.</li>
          <li>Sem cidade da posição, sem cidade da pessoa ou sem resposta: não bloqueia.</li>
        </ul>
        <p>Autodeclarada: valide na conversa de carreira e registre a data, pois pode mudar.</p>
      </div>
    </>
  );
}
