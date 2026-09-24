"use client";

import { useEffect, useRef, useState } from "react";
import { EMPRESA } from "@/lib/config.ts";
import { useStore } from "@/lib/store.tsx";

const FUNDO = "#f4f6f7";
const IGNORAR = "no-export"; // botões e menus que não devem sair na imagem
const ESCALA = 2;
// Blocos que não devem ser cortados ao meio por uma quebra de página do PDF.
const BLOCOS = ".page-head, .kpis, .filters, .chair-card, .cand-linha, .det-cartoes, .det-formula, .det-contexto, .group-kpis, .leader-box, .section-title, .empty, .modal-head, tr, .doc h2, .doc p, .doc li, .callout";

/** Posições (em pixels da imagem) onde a página pode quebrar sem cortar um bloco. */
function pontosDeQuebra(el: HTMLElement): number[] {
  const topo = el.getBoundingClientRect().top;
  const pontos = new Set<number>();
  el.querySelectorAll<HTMLElement>(BLOCOS).forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.height > 0) pontos.add(Math.round((r.bottom - topo + 6) * ESCALA));
  });
  return [...pontos].sort((a, b) => a - b);
}

function nomeArquivo(titulo: string, ext: string) {
  const slug = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${EMPRESA}_Mapa_Sucessorio_${slug || "Painel"}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

async function capturar(el: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(el, {
    pixelRatio: ESCALA,
    backgroundColor: FUNDO,
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains(IGNORAR)),
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = erro;
    img.src = src;
  });
}

async function gerarPdf(png: string, titulo: string, quebras: number[]) {
  const { jsPDF } = await import("jspdf");
  const img = await carregarImagem(png);
  const orientacao = img.width > img.height * 1.1 ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation: orientacao, unit: "mm", format: "a4" });
  const margem = 10;
  const cabecalho = 8;
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();
  const largura = larguraPagina - margem * 2;
  const alturaUtil = alturaPagina - margem * 2 - cabecalho;
  const pxPorMm = img.width / largura;
  const alturaMaxPx = Math.floor(alturaUtil * pxPorMm);
  // Fatias: cada página vai até o último fim de bloco que cabe nela (ou corta seco se um bloco sozinho
  // for maior que a página).
  const fatias: [number, number][] = [];
  for (let topo = 0; topo < img.height; ) {
    const limite = topo + alturaMaxPx;
    if (limite >= img.height) {
      fatias.push([topo, img.height]);
      break;
    }
    const fim = quebras.filter((q) => q > topo + alturaMaxPx * 0.4 && q <= limite).pop() ?? limite;
    fatias.push([topo, fim]);
    topo = fim;
  }
  const paginas = fatias.length;
  const data = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  for (let i = 0; i < paginas; i++) {
    const [topo, fim] = fatias[i];
    const alturaPx = fim - topo;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = alturaPx;
    const g = canvas.getContext("2d")!;
    g.fillStyle = FUNDO;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, topo, img.width, alturaPx, 0, 0, img.width, alturaPx);
    if (i > 0) pdf.addPage();
    pdf.setFontSize(9);
    pdf.setTextColor(93, 114, 128);
    pdf.text(`Mapa Sucessório ${EMPRESA} · ${titulo}`, margem, margem + 3);
    pdf.text(`Exportado em ${data} · página ${i + 1} de ${paginas}`, larguraPagina - margem, margem + 3, { align: "right" });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", margem, margem + cabecalho, largura, alturaPx / pxPorMm);
  }
  pdf.save(nomeArquivo(titulo, "pdf"));
}

/** Botão "Imprimir / Exportar" com escolha de PDF ou PNG. `alvo` devolve o elemento a capturar. */
export default function ExportMenu({ alvo, titulo }: { alvo: () => HTMLElement | null; titulo: () => string }) {
  const { showToast } = useStore();
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const exportar = async (formato: "pdf" | "png") => {
    setAberto(false);
    const el = alvo();
    if (!el) return;
    setGerando(true);
    try {
      // Um modal com rolagem própria seria capturado só na parte visível: solta a altura durante a captura.
      el.classList.add("exportando");
      let quebras: number[];
      let png: string;
      try {
        quebras = pontosDeQuebra(el);
        png = await capturar(el);
      } finally {
        el.classList.remove("exportando");
      }
      const t = titulo();
      if (formato === "png") {
        const a = document.createElement("a");
        a.href = png;
        a.download = nomeArquivo(t, "png");
        a.click();
      } else {
        await gerarPdf(png, t, quebras);
      }
    } catch (e) {
      showToast(`Não foi possível exportar: ${(e as Error).message}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className={`menu-wrap ${IGNORAR}`} ref={ref}>
      <button className="btn" onClick={() => setAberto((a) => !a)} disabled={gerando} aria-haspopup="menu" aria-expanded={aberto}>
        {gerando ? "Gerando arquivo…" : "Imprimir / Exportar ▾"}
      </button>
      {aberto && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => exportar("pdf")}>
            <b>PDF</b>
            <span>Para imprimir ou enviar, em páginas A4</span>
          </button>
          <button role="menuitem" onClick={() => exportar("png")}>
            <b>PNG</b>
            <span>Imagem única, para apresentações</span>
          </button>
        </div>
      )}
    </div>
  );
}
