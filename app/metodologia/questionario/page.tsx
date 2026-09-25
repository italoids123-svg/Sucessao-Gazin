import { CONTINUIDADE, CONVERSA, DESEMPENHO, HORIZONTE, MOBILIDADE } from "@/lib/config.ts";

const opts = (l: { label: string }[]) => l.map((i) => i.label).join(" · ");

export default function Page() {
  const perguntas: [string, string, string][] = [
    ["Todos", "Qual posição você tem interesse em ocupar? (Prioridade 1)", "Cargo exato da lista de posições críticas"],
    ["Todos", "Em quanto tempo você se vê pronto para ela? (Horizonte 1)", opts(HORIZONTE)],
    ["Todos", "O que falta para você assumir essa posição? (Desenvolvimento 1)", "Texto livre"],
    ["Todos", "Existe uma segunda posição de interesse? (Prioridade 2, Horizonte 2, Desenvolvimento 2)", "Opcional, mesmas opções"],
    ["Todos", "Em que cidade você trabalha hoje?", "Cidade/Estado (por exemplo, Douradina/PR)"],
    ["Todos", "Para assumir uma nova posição, até onde você se mudaria?", opts(MOBILIDADE)],
    ["Todos", "Você tem conversa de desenvolvimento com seu gestor?", opts(CONVERSA)],
    ["Líderes", "Se você saísse hoje, como ficaria a continuidade da sua posição?", opts(CONTINUIDADE)],
    ["Líderes", "Quem você indica como possível sucessor da sua posição?", "Nome e sobrenome (um ou mais, separados por vírgula)"],
    ["Recursos Humanos", "Avaliação de desempenho do ciclo atual", DESEMPENHO.map((n) => n.label).join(" · ") + " · (vazio = não avaliado)"],
    ["Recursos Humanos", "Lidera equipe hoje?", "Sim · Não"],
    ["Recursos Humanos", "Resultado da pesquisa de clima 2026 da área", "Percentual de 0 a 100, só para quem lidera equipe"],
  ];
  return (
    <>
      <div className="page-head">
        <h1>Questionário</h1>
        <p>O que é coletado de cada pessoa e quem responde. A coleta usa a aba &quot;Base de dados&quot; da planilha.</p>
      </div>
      <div className="doc">
        <table className="t">
          <thead>
            <tr>
              <th>Quem responde</th>
              <th>Pergunta</th>
              <th>Respostas aceitas</th>
            </tr>
          </thead>
          <tbody>
            {perguntas.map(([q, p, r]) => (
              <tr key={p}>
                <td>{q}</td>
                <td>{p}</td>
                <td>{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
