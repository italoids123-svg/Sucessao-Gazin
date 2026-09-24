"use client";

import { useEffect, useState } from "react";

type DocComPrefixo = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type ElComPrefixo = HTMLElement & { webkitRequestFullscreen?: () => void };

export default function FullscreenButton() {
  const [suportado, setSuportado] = useState(false);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    const d = document as DocComPrefixo;
    const el = document.documentElement as ElComPrefixo;
    setSuportado(!!(el.requestFullscreen || el.webkitRequestFullscreen));
    const atualizar = () => setAtivo(!!(d.fullscreenElement || d.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", atualizar);
    document.addEventListener("webkitfullscreenchange", atualizar);
    return () => {
      document.removeEventListener("fullscreenchange", atualizar);
      document.removeEventListener("webkitfullscreenchange", atualizar);
    };
  }, []);

  if (!suportado) return null;

  const alternar = () => {
    const d = document as DocComPrefixo;
    const el = document.documentElement as ElComPrefixo;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d);
    else (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
  };

  return (
    <button className="btn" onClick={alternar} title={ativo ? "Sair da tela cheia (Esc)" : "Tela cheia"}>
      {ativo ? "⤡ Sair da tela cheia" : "⤢ Tela cheia"}
    </button>
  );
}
