import { CLIMA_FONTE, HORIZONTE, PESOS, SEDE } from "@/lib/config.ts";

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
  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Metodologia</div>
        <h1>Critérios</h1>
        <p>O que define a posição de cada pessoa no programa: 100 pontos distribuídos em cinco critérios de aderência à sucessão.</p>
      </div>

      <div className="blocos">
        <Bloco
          titulo="Avaliação de desempenho (2026)"
          peso={`Peso: ${PESOS.desempenho} pontos no modelo`}
          linhas={[
            { rotulo: "Autoavaliação", sub: "resultado de 0 a 100%", pts: `até ${pts(PESOS.autoavaliacao)}` },
            { rotulo: "Avaliação do gestor", sub: "resultado de 0 a 100%", pts: `até ${pts(PESOS.avaliacaoGestor)}` },
            { rotulo: "Não avaliado", sub: "sem resultado no ciclo", pts: pts(0) },
          ]}
          nota={
            <>
              Cada parte pontua proporcional ao resultado: 80% na autoavaliação vale {fmt(0.8 * PESOS.autoavaliacao)} pontos e 90% na
              avaliação do gestor vale {fmt(0.9 * PESOS.avaliacaoGestor)} pontos. Vale para líderes e não líderes.
            </>
          }
        />

        <Bloco
          titulo="Pesquisa de clima"
          peso={`Peso: ${PESOS.clima} pontos no modelo`}
          linhas={[
            { rotulo: "Líderes que exercem gestão de pessoas", sub: CLIMA_FONTE.lider.descricao, pts: `até ${pts(PESOS.clima)}` },
            { rotulo: "Profissionais que não exercem gestão de pessoas", sub: CLIMA_FONTE.naoLider.descricao, pts: `até ${pts(PESOS.clima)}` },
            { rotulo: "Sem resultado", pts: pts(0) },
          ]}
          nota={
            <>
              Resultado de 0 a 100%, com pontos proporcionais: 75% vale {fmt(0.75 * PESOS.clima)} pontos. Quem é líder define qual das
              duas fontes vale para a pessoa.
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
            { rotulo: "Declarou a posição como Prioridade 1 ou 2", sub: "onde gostaria de atuar", pts: pts(PESOS.interesse) },
            { rotulo: "Não declarou interesse na posição", pts: pts(0) },
          ]}
          nota={<>Basta se candidatar ou ser indicado pelo líder para aparecer na posição; a pontuação soma as duas pontas.</>}
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
          peso="Define qual fonte da pesquisa de clima se aplica"
          linhas={[
            { rotulo: "Respondeu \"Sim\" em Lidera equipe", pts: "Líder" },
            { rotulo: "Respondeu \"Não\" em Lidera equipe", pts: "Não líder" },
            { rotulo: "Sem resposta e ocupa posição de Supervisão para cima", pts: "Líder" },
            { rotulo: "Sem resposta, Especialista ou sem posição crítica", pts: "Não líder" },
          ]}
          nota={<>Os demais critérios valem igual para líderes e não líderes.</>}
        />
      </div>
    </>
  );
}
