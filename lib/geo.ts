import { SEDE } from "./config.ts";
import type { Mobilidade } from "./types.ts";

export function normCity(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*[-–,]\s*/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** UF de uma cidade no formato "Cidade/UF" (aceita "Cidade - UF"); "" quando não informada. */
export function ufDe(cidade: string | undefined): string {
  const m = normCity(cidade).match(/\/([A-Z]{2})$/);
  return m ? m[1] : "";
}

export type ResultadoMobilidade = "alcanca" | "nao_alcanca" | "indeterminado";

/**
 * Avalia se a mobilidade declarada leva a pessoa da cidade de origem à cidade da posição.
 * Cada resposta é avaliada por si: estar na cidade da posição não aprova "matriz" automaticamente.
 * "indeterminado" = falta dado (resposta, cidade ou UF).
 */
export function avaliarMobilidade(
  origem: string | undefined,
  destino: string | undefined,
  mobilidade: Mobilidade | undefined,
): ResultadoMobilidade {
  if (!mobilidade) return "indeterminado";
  if (mobilidade === "qualquer") return "alcanca";
  const d = normCity(destino);
  if (!d) return "indeterminado";
  if (mobilidade === "matriz") return d === normCity(SEDE) ? "alcanca" : "nao_alcanca";
  const o = normCity(origem);
  if (!o) return "indeterminado";
  if (mobilidade === "local") return o === d ? "alcanca" : "nao_alcanca";
  // estado
  const uo = ufDe(o);
  const ud = ufDe(d);
  if (!uo || !ud) return "indeterminado";
  return uo === ud ? "alcanca" : "nao_alcanca";
}

/** Versão booleana e permissiva: falta de dado geográfico não bloqueia. */
export function mobilidadeAlcancaCidade(
  origem: string | undefined,
  destino: string | undefined,
  mobilidade: Mobilidade | undefined,
): boolean {
  return avaliarMobilidade(origem, destino, mobilidade) !== "nao_alcanca";
}
