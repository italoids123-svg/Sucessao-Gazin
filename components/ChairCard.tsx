import { coberturaDe, fmtPontos } from "@/lib/engine.ts";
import type { Chair, ChairResult } from "@/lib/types.ts";

export default function ChairCard({ chair, result, onOpen }: { chair: Chair; result: ChairResult; onOpen: () => void }) {
  const cor = coberturaDe(result.dentro.length);
  const vago = chair.vago || !chair.nome;
  return (
    <button className={`chair-card ${cor}`} onClick={onOpen}>
      <div className="cargo">{chair.cargo}</div>
      <div className={`ocupante ${vago ? "vago" : ""}`}>
        {vago ? "Posição vaga" : chair.nome}
        {chair.prefixLocalidade && chair.cidade ? ` · ${chair.cidade}` : ""}
      </div>
      <div className="meta">
        {chair.diretoria}
        {!chair.prefixLocalidade && chair.cidade ? ` · ${chair.cidade}` : ""}
      </div>
      <div className="counts">
        <span className={`chip ${cor}`}>
          {result.dentro.length} sucessor{result.dentro.length === 1 ? "" : "es"}
        </span>
        {result.abaixo.length > 0 && <span className="chip amarelo">{result.abaixo.length} abaixo do corte</span>}
        {result.fora.length > 0 && <span className="chip">{result.fora.length} fora da hierarquia</span>}
      </div>
      {result.dentro.length > 0 && (
        <div className="meta">
          {result.dentro
            .slice(0, 2)
            .map((c) => `${c.indicadoPeloLider ? "★ " : ""}${c.person.nome} (${fmtPontos(c.score)})`)
            .join(" · ")}
        </div>
      )}
    </button>
  );
}
