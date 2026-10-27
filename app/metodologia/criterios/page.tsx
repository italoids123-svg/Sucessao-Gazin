import { AREA_FAIXAS, HORIZONTE, PESOS, SEDE } from "@/lib/config.ts";

const fmt = (n: number) => n.toLocaleString("pt-BR");

interface Linha {
  rotulo: string;
  sub?: string;
  pts: string;
}

/** Um bloco por critério: título, peso no modelo, faixas com a pontuação à direita e nota de rodapé. */
function Bloco({ titulo, peso, linhas, nota }: { titulo: string; peso: string; linhas: Linha[]; nota?: React.ReactNode }) {
  return (
    <section className="bloco">
      <h2>{titulo}</h2>
      <div className="bloco-peso">{peso}</div>
      <div className="bloco-linhas">
        {linhas.map((l) => (
          <div key={l.rotulo} className="bloco-linha">
            <div>
              <div>{l.rotulo}</div>
              {l.sub && <div className="bloco-sub">{l.sub}</div>}
            </div>
            <div className="bloco-pts">{l.pts}</div>
          </div>
        ))}
      </div>
      {nota && <div className="bloco-nota">{nota}</div>}
    </section>
  );
}

const pts = (n: number) => `${fmt(n)} ${n === 1 ? "pt" : "pts"}`;

export default function Page() {
  const faixasArea = [...AREA_FAIXAS].reverse().map((f) => ({ rotulo: f.label, pts: pts(f.pontos) }));
  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Metodologia</div>
        <h1>Critérios</h1>
        <p>100 pontos distribuídos em critérios de aderência à sucessão, com réguas diferentes para líderes e não líderes.</p>
      </div>

      <div className="blocos">
        <Bloco
          titulo="Avaliação de desempenho (2026)"
          peso={`Peso: ${PESOS.desempenho} pontos no modelo`}
          linhas={[
            ...[100, 90, 80, 70, 60, 50].map((r) => ({
              rotulo: `Resultado ${r}%`,
              sub: r === 100 ? "pontuação máxima" : undefined,
              pts: pts((r / 100) * PESOS.desempenho),
            })),
            { rotulo: "Não avaliado", sub: "Sem avaliação no ciclo", pts: pts(0) },
          ]}
          nota={
            <>
              Pontos proporcionais ao resultado: resultado ÷ 100 × {PESOS.desempenho}. Exemplo: 73% vale{" "}
              {fmt((73 / 100) * PESOS.desempenho)} pontos. Vale para líderes e não líderes.
            </>
          }
        />

        <Bloco
          titulo="Indicação do líder da posição"
          peso={`Peso: ${PESOS.indicacaoLider} pontos no modelo`}
          linhas={[
            { rotulo: "O ocupante da posição indica a pessoa nominalmente como possível sucessora", pts: pts(PESOS.indicacaoLider) },
            { rotulo: "Sem indicação nominal do ocupante", pts: pts(0) },
          ]}
          nota={
            <>
              A indicação vale quando cita nome e sobrenome (&quot;João Silva&quot; indica &quot;João Carlos da Silva&quot;;
              &quot;João&quot; sozinho não indica). Nome que corresponde a mais de uma pessoa só vale para quem também se candidatou
              à posição.
            </>
          }
        />

        <Bloco
          titulo="Interesse declarado"
          peso={`Peso: ${PESOS.interesse} pontos no modelo`}
          linhas={[
            { rotulo: "Declarou a posição como Prioridade 1 ou 2", pts: pts(PESOS.interesse) },
            { rotulo: "Não declarou interesse na posição", pts: pts(0) },
          ]}
          nota={<>Basta se candidatar ou ser indicado pelo líder para aparecer na posição; a pontuação soma as duas pontas.</>}
        />

        <Bloco
          titulo="Favorabilidade (líderes)"
          peso={`Peso: ${PESOS.avaliacaoArea} pontos no modelo`}
          linhas={faixasArea}
          nota={<>Fonte: favorabilidade do clima da área que a pessoa lidera, pesquisa 2026. Aplicado só a líderes.</>}
        />

        <Bloco
          titulo="Avaliação de pares (não líderes)"
          peso={`Peso: ${PESOS.avaliacaoArea} pontos no modelo`}
          linhas={faixasArea}
          nota={<>Fonte: avaliação feita pelos pares da área, 2026. Aplicado só a não líderes, na mesma régua da favorabilidade.</>}
        />

        <Bloco
          titulo="Prontidão declarada"
          peso={`Peso: ${PESOS.prontidao} pontos no modelo`}
          linhas={HORIZONTE.map((h) => ({ rotulo: h.label, pts: pts(h.pontos) }))}
          nota={<>Em quanto tempo a pessoa se vê pronta para assumir a posição de interesse.</>}
        />

        <Bloco
          titulo="Mobilidade"
          peso="Sem pontuação: mapeada e informativa"
          linhas={[
            { rotulo: "Local atual", sub: "só a cidade onde trabalha hoje", pts: "mapeado" },
            { rotulo: "Matriz", sub: SEDE, pts: "mapeado" },
            { rotulo: "Dentro do Estado", sub: "mesmo Estado da cidade atual", pts: "mapeado" },
            { rotulo: "Total", sub: "qualquer unidade", pts: "mapeado" },
          ]}
          nota={
            <>
              Não soma pontos nem impede a pessoa de aparecer em posições de outras cidades. O detalhe do candidato sinaliza quando a
              posição fica fora do que a pessoa declarou.
            </>
          }
        />

        <Bloco
          titulo="Quem é líder"
          peso="Define qual régua de 30 pontos se aplica"
          linhas={[
            { rotulo: "Respondeu \"Sim\" em Lidera equipe", pts: "Líder" },
            { rotulo: "Respondeu \"Não\" em Lidera equipe", pts: "Não líder" },
            { rotulo: "Sem resposta e ocupa posição de Supervisão para cima", pts: "Líder" },
            { rotulo: "Sem resposta, Especialista ou sem posição crítica", pts: "Não líder" },
          ]}
          nota={<>As duas réguas somam 100 pontos; muda só o critério de 30 pontos.</>}
        />
      </div>
    </>
  );
}
