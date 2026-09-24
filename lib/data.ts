import base from "./base-data.json" with { type: "json" };
import { HIERARQUIA_PADRAO } from "./config.ts";
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
