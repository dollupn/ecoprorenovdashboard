export const TRAVAUX_NON_SUBVENTIONNES_OPTIONS = [
  { value: "NA", label: "N/A" },
  { value: "CLIENT", label: "Client" },
  { value: "MARGE", label: "Marge" },
  { value: "MOITIE", label: "Moitié" },
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
