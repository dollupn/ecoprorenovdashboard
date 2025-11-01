export const TRAVAUX_NON_SUBVENTIONNES_OPTIONS = [
  { value: "NA", label: "N/A" },
  { value: "CLIENT", label: "Client" },
  { value: "MARGE", label: "Marge" },
  { value: "PARTAGE", label: "Partagé" },
] as const;

export type TravauxNonSubventionnesValue =
  (typeof TRAVAUX_NON_SUBVENTIONNES_OPTIONS)[number]["value"];

export const TRAVAUX_NON_SUBVENTIONNES_LABELS: Record<
  TravauxNonSubventionnesValue,
  string
> = TRAVAUX_NON_SUBVENTIONNES_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<TravauxNonSubventionnesValue, string>,
);

export const normalizeTravauxNonSubventionnesValue = (
  rawValue: unknown,
  fallback: TravauxNonSubventionnesValue = "NA",
): TravauxNonSubventionnesValue => {
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toUpperCase();
    switch (normalized) {
      case "CLIENT":
      case "MARGE":
      case "PARTAGE":
        return normalized as TravauxNonSubventionnesValue;
      case "MOITIE":
        return "PARTAGE";
      case "NA":
        return "NA";
      default:
        return fallback;
    }
  }

  return fallback;
};
