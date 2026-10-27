import { AREA_FAIXAS, CRITERIO_AREA, HORIZONTE, PESOS, SEDE, type Perfil } from "@/lib/config.ts";

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

const CARTOES = (perfil: Perfil): [number, string, string, boolean][] => [
  [PESOS.desempenho, "Avaliação de desempenho", "desempenho 2026", false],
  [PESOS.indicacaoLider, "Indicação do líder da posição", "líder da posição", false],
  [PESOS.mobilidade, "Mobilidade", "onde você aceita atuar", true],
  [PESOS.avaliacaoArea, CRITERIO_AREA[perfil].titulo, CRITERIO_AREA[perfil].sub, false],
  [PESOS.interesse, "Interesse declarado", "declaração aberta de onde gostaria de atuar", true],
  [PESOS.prontidao, "Prontidão declarada", "em quanto tempo você se vê pronto", true],
];

function Painel({ perfil, titulo }: { perfil: Perfil; titulo: string }) {
  return (
    <div className="perfil-painel">
      <div className="perfil-titulo">{titulo}</div>
      <div className="perfil-cartoes">
        {CARTOES(perfil).map(([pontos, nome, sub, declarado]) => (
          <div key={nome} className={`perfil-cartao ${declarado ? "declarado" : ""}`}>
            <div className="perfil-pontos">{pontos}</div>
            <div className="perfil-nome">{nome}</div>
            <div className="perfil-sub">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <div className="page-head">
        <h1>Critérios</h1>
        <p>Os critérios e pontuações são públicos. Líderes e não líderes têm réguas diferentes; ambas somam 100 pontos.</p>
      </div>
      <div className="perfis">
        <Painel perfil="lider" titulo="Para líderes" />
        <Painel perfil="naoLider" titulo="Para não líderes" />
      </div>
      <div className="doc">
        <h2>Quem é líder</h2>
        <p>
          Vale a resposta &quot;Lidera equipe&quot; da planilha de coleta. Sem resposta, a ferramenta considera líder quem ocupa posição
          de Supervisão para cima; Especialistas e pessoas sem posição crítica são avaliados como não líderes.
        </p>

        <h2>Avaliação de desempenho ({PESOS.desempenho} pontos)</h2>
        <p>
          Resultado da avaliação de desempenho 2026, de 0 a 100%. Os pontos são proporcionais ao resultado: 80% vale{" "}
          {fmt((80 / 100) * PESOS.desempenho)} pontos, 100% vale {PESOS.desempenho}. Sem avaliação: 0.
        </p>

        <h2>Indicação do líder da posição ({PESOS.indicacaoLider} pontos)</h2>
        <p>
          O ocupante atual da posição cita o candidato pelo nome e sobrenome (&quot;João Silva&quot; indica &quot;João Carlos da
          Silva&quot;; &quot;João&quot; sozinho não indica).
        </p>

        <h2>
          {CRITERIO_AREA.lider.titulo} (líderes) e {CRITERIO_AREA.naoLider.titulo} (não líderes) ({PESOS.avaliacaoArea} pontos)
        </h2>
        <p>
          Líderes: favorabilidade do clima da área que lideram. Não líderes: avaliação feita pelos pares da área. Ambas em percentual e na
          mesma régua de faixas.
        </p>
        <Tabela cols={["Resultado 2026", "Pontos"]} rows={AREA_FAIXAS.map((f) => [f.label, f.pontos])} />

        <h2>Interesse declarado ({PESOS.interesse} pontos)</h2>
        <p>A pessoa se candidatou à posição como Prioridade 1 ou 2.</p>

        <h2>Prontidão declarada ({PESOS.prontidao} pontos)</h2>
        <p>Em quanto tempo a pessoa se vê pronta para assumir a posição.</p>
        <Tabela cols={["Prazo declarado", "Pontos"]} rows={HORIZONTE.map((h) => [h.label, h.pontos])} />

        <h2>Mobilidade (sem pontuação)</h2>
        <p>
          Onde a pessoa aceita atuar: local atual, matriz ({SEDE}), dentro do Estado ou qualquer unidade. É mapeada e aparece no detalhe
          do candidato, mas não soma pontos nem impede a pessoa de aparecer em posições de outras cidades. Quando a posição fica fora do
          que a pessoa declarou, o detalhe do candidato sinaliza.
        </p>
      </div>
    </>
  );
}
