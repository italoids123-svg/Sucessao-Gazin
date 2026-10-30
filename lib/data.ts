import base from "./base-data.json" with { type: "json" };
import { HIERARQUIA_PADRAO } from "./config.ts";
import type { VinculoLideranca } from "./engine.ts";
import lideranca from "./lideranca.json" with { type: "json" };
import type { AppData, Chair, Person } from "./types.ts";

export function initialData(): AppData {
  return {
    chairs: base.chairs as Chair[],
    people: base.people as Person[],
    succession: {},
    hierarquia: HIERARQUIA_PADRAO,
    updatedAt: null,
  };
}

/** Lista de liderança imediata (scripts/build-lideranca.py). */
export const LIDERANCA: VinculoLideranca[] = lideranca.registros;
/** Pessoas da lista sem líder identificado em nenhuma fonte. */
export const LIDERANCA_PENDENTES: string[] = lideranca.pendentes.map((p) => p.colaborador);
