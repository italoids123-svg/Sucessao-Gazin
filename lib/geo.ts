import { FATOR_RODOVIARIO, RAIO_REGIONAL_KM, SEDE } from "./config.ts";
import type { City, Mobilidade } from "./types.ts";

// Coordenadas conhecidas. A planilha de posições críticas não traz cidade; as demais
// cidades entram pela aba "Cidades" da planilha de coleta.
export const CITY_COORDS_PADRAO: City[] = [{ nome: SEDE, lat: -23.3806, lng: -53.2917 }];

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

export type CoordIndex = Map<string, City>;

export function buildCoordIndex(cities: City[]): CoordIndex {
  const idx: CoordIndex = new Map();
  for (const c of [...CITY_COORDS_PADRAO, ...cities]) idx.set(normCity(c.nome), c);
  return idx;
}

export function distanciaKm(a: City, b: City): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type ResultadoMobilidade = "alcanca" | "nao_alcanca" | "indeterminado";

/**
 * Avalia se a mobilidade declarada leva a pessoa da cidade de origem à cidade da posição.
 * Cada resposta é avaliada por si: estar na cidade da posição não aprova "sede" automaticamente.
 * "indeterminado" = falta dado (resposta ou cidade desconhecida).
 */
export function avaliarMobilidade(
  origem: string | undefined,
  destino: string | undefined,
  mobilidade: Mobilidade | undefined,
  coords: CoordIndex,
): ResultadoMobilidade {
  if (!mobilidade) return "indeterminado";
  if (mobilidade === "qualquer") return "alcanca";
  const d = normCity(destino);
  if (!d) return "indeterminado";
  if (mobilidade === "sede") return d === normCity(SEDE) ? "alcanca" : "nao_alcanca";
  const o = normCity(origem);
  if (!o) return "indeterminado";
  if (mobilidade === "local") return o === d ? "alcanca" : "nao_alcanca";
  // raio_regional
  if (o === d) return "alcanca";
  const co = coords.get(o);
  const cd = coords.get(d);
  if (!co || !cd) return "indeterminado";
  return distanciaKm(co, cd) * FATOR_RODOVIARIO <= RAIO_REGIONAL_KM ? "alcanca" : "nao_alcanca";
}

/** Versão booleana e permissiva: falta de dado geográfico não bloqueia. */
export function mobilidadeAlcancaCidade(
  origem: string | undefined,
  destino: string | undefined,
  mobilidade: Mobilidade | undefined,
  coords: CoordIndex,
): boolean {
  return avaliarMobilidade(origem, destino, mobilidade, coords) !== "nao_alcanca";
}
