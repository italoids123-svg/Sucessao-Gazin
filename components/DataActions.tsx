"use client";

import { useRef } from "react";
import * as XLSX from "xlsx";
import { EMPRESA } from "@/lib/config.ts";
import { applyWorkbook, buildWorkbook } from "@/lib/excel.ts";
import { useStore } from "@/lib/store.tsx";

export function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "base inicial (planilha de posições críticas), sem questionário importado";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function DataActions() {
  const { data, setData, reset, showToast } = useStore();
  const input = useRef<HTMLInputElement>(null);

  const download = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(buildWorkbook(data), `${EMPRESA}_Mapa_Sucessorio_Base_${stamp}.xlsx`);
  };

  const upload = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const { data: next, stats } = applyWorkbook(wb, data);
      setData(next);
      const linhas = [
        `Base carregada: ${stats.pessoasAtualizadas} pessoa(s) atualizada(s), ${stats.pessoasCriadas} criada(s).`,
        `Cadeiras: ${stats.cadeirasAtualizadas} atualizada(s), ${stats.cadeirasCriadas} criada(s). Cidades: ${stats.cidades}.`,
      ];
      if (stats.avisos.length) {
        linhas.push(`${stats.avisos.length} aviso(s) — veja o console do navegador.`);
        console.warn("Avisos da importação:\n" + stats.avisos.join("\n"));
      }
      showToast(linhas.join("\n"));
    } catch (e) {
      showToast(`Não foi possível ler a planilha: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="updated">
        Atualização da base: <b>{formatUpdatedAt(data.updatedAt)}</b>
      </div>
      <div className="actions">
        <button className="btn" onClick={download}>
          Baixar base para coleta
        </button>
        <button className="btn primary" onClick={() => input.current?.click()}>
          Carregar base preenchida
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            if (confirm("Apagar a base salva neste navegador e voltar à base inicial?")) {
              reset();
              showToast("Base local apagada. Exibindo a base inicial.");
            }
          }}
        >
          Limpar base local
        </button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}
