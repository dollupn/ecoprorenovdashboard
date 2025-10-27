import { describe, expect, it } from "vitest";

import { normalizeProductCeeConfig } from "../prime-cee-config";

describe("normalizeProductCeeConfig", () => {
  it("defaults to surface_isolee for isolation products", () => {
    const result = normalizeProductCeeConfig({ category: "isolation" });

    expect(result.primeMultiplierParam).toBe("surface_isolee");
  });

  it("defaults to nombre_luminaire for lighting products", () => {
    const result = normalizeProductCeeConfig({ category: "lighting" });

    expect(result.primeMultiplierParam).toBe("nombre_luminaire");
  });
});
