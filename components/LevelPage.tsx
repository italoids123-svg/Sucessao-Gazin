"use client";

import { useCallback, useMemo, useState } from "react";
import { NIVEIS } from "@/lib/config.ts";
import { coberturaDe, norm, planoDesenvolvimento, resumoCobertura } from "@/lib/engine.ts";
import { useStore } from "@/lib/store.tsx";
import ChairCard from "./ChairCard";
import ChairModal from "./ChairModal";
import CoverageBar from "./CoverageBar";

const collator = new Intl.Collator("pt-BR");

export default function LevelPage({ slug }: { slug: string }) {
  const nivel = NIVEIS.find((n) => n.slug === slug)!;
  const { data, results, ctx } = useStore();
  const [busca, setBusca] = useState("");
  const [diretoria, setDiretoria] = useState("");
  const [cargo, setCargo] = useState("");
  const [cobertura, setCobertura] = useState("");
  const [cidade, setCidade] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const chairs = useMemo(
    () =>
      data.chairs
        .filter((c) => c.nivel === nivel.nome)
        .sort((a, b) => collator.compare(a.diretoria, b.diretoria) || collator.compare(a.cargo, b.cargo) || collator.compare(a.nome, b.nome)),
    [data.chairs, nivel.nome],
  );
  const opcoes = (f: (c: (typeof chairs)[number]) => string) => [...new Set(chairs.map(f).filter(Boolean))].sort(collator.compare);
  const diretorias = opcoes((c) => c.diretoria);
  const cargos = opcoes((c) => c.cargo);
  const cidades = opcoes((c) => c.cidade);

  const q = norm(busca);
  const visiveis = chairs.filter((c) => {
    const r = results.get(c.id)!;
    return (
      (!q || norm(`${c.cargo} ${c.nome} ${c.cidade}`).includes(q)) &&
      (!diretoria || c.diretoria === diretoria) &&
      (!cargo || c.cargo === cargo) &&
      (!cidade || c.cidade === cidade) &&
      (!cobertura || coberturaDe(r.dentro.length) === cobertura)
    );
  });

  // Cobertura sempre sobre todas as cadeiras do nível, independente dos filtros.
  const resumo = resumoCobertura(chairs.map((c) => results.get(c.id)!));
  const pdi = planoDesenvolvimento(nivel.nome, ctx);
  const aberta = abertaId ? data.chairs.find((c) => c.id === abertaId) : undefined;
  const fechar = useCallback(() => setAbertaId(null), []);

  return (
    <>
      <div className="page-head">
        <h1>{nivel.nome}</h1>
        <p>{nivel.descricao}</p>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Posições</div>
          <div className="kpi-value">{visiveis.length}</div>
          <div className="kpi-sub">{visiveis.length === chairs.length ? "no nível" : `de ${chairs.length} (filtros aplicados)`}</div>
        </div>
        <div className="kpi wide">
          <div className="kpi-label">Cobertura sucessória · todas as posições do nível</div>
          <CoverageBar {...resumo} />
        </div>
        <div className="kpi">
          <div className="kpi-label">Plano de desenvolvimento ativo</div>
          <div className="kpi-value">{pdi.pct}%</div>
          <div className="kpi-sub">
            {pdi.ativos} de {pdi.total} pessoas do nível e dos níveis que o alimentam
          </div>
          <div className="progress">
            <div style={{ width: `${pdi.pct}%` }} />
          </div>
        </div>
      </div>

      <div className="filters">
        <input placeholder="Buscar por cargo, nome ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {diretorias.length > 1 && (
          <select value={diretoria} onChange={(e) => setDiretoria(e.target.value)} aria-label="Diretoria">
            <option value="">Todas as diretorias</option>
            {diretorias.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        )}
        {cargos.length > 1 && (
          <select value={cargo} onChange={(e) => setCargo(e.target.value)} aria-label="Cargo">
            <option value="">Todos os cargos</option>
            {cargos.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        )}
        {cidades.length > 1 && (
          <select value={cidade} onChange={(e) => setCidade(e.target.value)} aria-label="Cidade">
            <option value="">Todas as cidades</option>
            {cidades.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        )}
        <select value={cobertura} onChange={(e) => setCobertura(e.target.value)} aria-label="Cobertura">
          <option value="">Toda cobertura</option>
          <option value="verde">2+ sucessores</option>
          <option value="amarelo">1 sucessor</option>
          <option value="vermelho">Sem sucessor</option>
        </select>
      </div>

      {visiveis.length ? (
        <div className="grid">
          {visiveis.map((c) => (
            <ChairCard key={c.id} chair={c} result={results.get(c.id)!} onOpen={() => setAbertaId(c.id)} />
          ))}
        </div>
      ) : (
        <div className="empty">Nenhuma posição encontrada com esses filtros.</div>
      )}

      {aberta && <ChairModal chair={aberta} onClose={fechar} />}
    </>
  );
}
