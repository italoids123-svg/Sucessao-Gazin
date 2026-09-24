import { FATOR_RODOVIARIO, HORIZONTE, NINE_BOX, PESOS, RAIO_REGIONAL_KM, SEDE } from "@/lib/config.ts";

export default function Page() {
  return (
    <>
      <div className="page-head">
        <h1>Critérios</h1>
        <p>Escalas usadas em cada critério da pontuação de aderência.</p>
      </div>
      <div className="doc">
        <h2>Nine Box ({PESOS.nineBox} pontos)</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Quadrante</th>
              <th>Descrição</th>
              <th className="num">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {NINE_BOX.map((n) => (
              <tr key={n.code}>
                <td>{n.code}</td>
                <td>{n.label}</td>
                <td className="num">{Math.round(n.fator * PESOS.nineBox)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="callout warn">
          A numeração dos quadrantes varia entre empresas. Confirme com o RH da Gazin que a régua acima corresponde à matriz usada nos
          ciclos 2025 e 2026 antes de importar os dados.
        </div>

        <h2>Interesse declarado ({PESOS.interesse} pontos)</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Horizonte</th>
              <th className="num">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {HORIZONTE.map((h) => (
              <tr key={h.code}>
                <td>{h.label}</td>
                <td className="num">{h.pontos}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Mobilidade geográfica ({PESOS.mobilidade} pontos)</h2>
        <p>Cada resposta é avaliada por si, sem atalhos:</p>
        <ul>
          <li><b>Somente minha cidade atual</b>: alcança só a própria cidade.</li>
          <li>
            <b>Somente a sede</b>: alcança só {SEDE}. Estar em outra cidade que por acaso tem a posição não conta.
          </li>
          <li>
            <b>Raio regional</b>: distância em linha reta × {FATOR_RODOVIARIO} (aproximação rodoviária) até {RAIO_REGIONAL_KM} km.
            Exige coordenadas das duas cidades na aba Cidades.
          </li>
          <li><b>Qualquer unidade</b>: sempre alcança.</li>
          <li>Sem resposta, ou cidade não reconhecida: não bloqueia e o critério sai da base de cálculo.</li>
        </ul>

        <h2>Indicação nominal do líder ({PESOS.indicacao} pontos)</h2>
        <p>
          O texto livre do ocupante é dividido por vírgula, ponto e vírgula, barra, &quot;e&quot; ou &quot;ou&quot;. Um trecho indica o
          candidato quando tem pelo menos dois termos, começa pelo primeiro nome dele e todos os termos aparecem no nome completo
          (&quot;João Silva&quot; indica &quot;João Carlos da Silva&quot;; &quot;João&quot; sozinho não indica).
        </p>

        <h2>Favorabilidade do time ({PESOS.favorabilidade} pontos)</h2>
        <p>Percentual de favorabilidade × {PESOS.favorabilidade / 100}. Só se aplica a quem lidera equipe.</p>
      </div>
    </>
  );
}
