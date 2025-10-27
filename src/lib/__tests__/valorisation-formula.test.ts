import { describe, expect, it } from "vitest";

import { normalizeValorisationFormula } from "../valorisation-formula";

describe("normalizeValorisationFormula", () => {
  it("normalizes Nombre Led synonyms to the canonical nombre_luminaire key", () => {
    const result = normalizeValorisationFormula({
      variableKey: "Nombre Led",
      variableLabel: "Nombre Led",
      variableValue: "45",
    });

    expect(result).toEqual({
      variableKey: "nombre_luminaire",
      variableLabel: "Nombre Led",
      coefficient: null,
      variableValue: 45,
    });
  });

  it("returns a zero value when no positive nombre_luminaire count is provided", () => {
    const result = normalizeValorisationFormula({
      variableKey: "nombre_led",
      variableLabel: "Nombre de LED",
      variableValue: null,
    });

    expect(result).toEqual({
      variableKey: "nombre_luminaire",
      variableLabel: "Nombre de LED",
      coefficient: null,
      variableValue: 0,
    });
  });
});
