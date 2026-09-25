"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { EMPRESA, NIVEIS } from "@/lib/config.ts";
import { coberturaDe } from "@/lib/engine.ts";
import { StoreProvider, useStore } from "@/lib/store.tsx";
import DataActions, { formatUpdatedAt } from "./DataActions";

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { data, results } = useStore();

  const item = (href: string, label: string, extra?: React.ReactNode) => (
    <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`} onClick={onNavigate}>
      <span>{label}</span>
      {extra}
    </Link>
  );

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">GZ</div>
        <div>
          <strong>Mapa Sucessório</strong>
          <span>{EMPRESA} · posições críticas</span>
        </div>
      </div>
      {item("/", "Visão geral")}
      <div className="nav-group">
        <h4>Mapa Sucessório</h4>
        {NIVEIS.filter((n) => n.temPagina).map((n) => {
          const chairs = data.chairs.filter((c) => c.nivel === n.nome);
          const semSucessor = chairs.filter((c) => coberturaDe(results.get(c.id)?.dentro.length ?? 0) === "vermelho").length;
          const cor = chairs.length === 0 ? "vermelho" : semSucessor === 0 ? "verde" : semSucessor < chairs.length / 2 ? "amarelo" : "vermelho";
          return item(
            `/nivel/${n.slug}`,
            n.nome,
            <span className="nav-count">
              {chairs.length}
              <i className={`dot ${cor}`} />
            </span>,
          );
        })}
      </div>
      <div className="nav-group">
        <h4>Metodologia</h4>
        {item("/metodologia/elegibilidade", "Elegibilidade e Aderência")}
        {item("/metodologia/questionario", "Questionário")}
        {item("/metodologia/criterios", "Critérios")}
      </div>
      <div className="sidebar-rodape">{formatUpdatedAt(data.updatedAt)}</div>
    </aside>
  );
}

function Toast() {
  const { toast } = useStore();
  return toast ? <div className="toast" role="status">{toast}</div> : null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <StoreProvider>
      <div className="shell">
        <Sidebar open={open} onNavigate={() => setOpen(false)} />
        <div className="main">
          <div className="topbar">
            <button className="btn ghost menu-toggle" onClick={() => setOpen((o) => !o)} aria-label="Abrir menu">
              ☰ Menu
            </button>
            <DataActions />
          </div>
          <main className="content">{children}</main>
        </div>
      </div>
      <Toast />
    </StoreProvider>
  );
}
