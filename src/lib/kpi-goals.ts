import { z } from "zod";

export const KPI_METRIC_OPTIONS = [
  {
    value: "revenue",
    label: "Revenu signé",
    description: "Montant total signé sur la période sélectionnée.",
    defaultUnit: "€",
  },
  {
    value: "margin_rate",
    label: "Marge moyenne",
    description: "Pourcentage moyen de marge sur les projets signés.",
    defaultUnit: "%",
  },
  {
    value: "signed_projects",
    label: "Projets signés",
    description: "Nombre de projets signés sur la période.",
    defaultUnit: "projets",
  },
  {
    value: "converted_leads",
    label: "Leads convertis",
    description: "Leads transformés en opportunités gagnées.",
    defaultUnit: "leads",
  },
] as const;

export const KPI_PERIOD_OPTIONS = [
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "yearly", label: "Annuel" },
] as const;

export type KpiMetric = (typeof KPI_METRIC_OPTIONS)[number]["value"];
export type KpiPeriod = (typeof KPI_PERIOD_OPTIONS)[number]["value"];

const metricValues = KPI_METRIC_OPTIONS.map((option) => option.value) as [
  KpiMetric,
  ...KpiMetric[],
];
const periodValues = KPI_PERIOD_OPTIONS.map((option) => option.value) as [
  KpiPeriod,
  ...KpiPeriod[],
];

const toNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export const kpiGoalSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid({ message: "Organisation invalide" }).optional(),
  title: z
    .string({ required_error: "Le nom de l'objectif est requis" })
    .trim()
    .min(1, "Le nom de l'objectif est requis"),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional()
    .transform((value) => value?.trim() ?? ""),
  metric: z.enum(metricValues, {
    errorMap: () => ({ message: "Sélectionnez un indicateur" }),
  }),
  period: z.enum(periodValues, {
    errorMap: () => ({ message: "Sélectionnez une période de suivi" }),
  }),
  targetValue: z.preprocess(
    toNumber,
    z
      .number({
        required_error: "La valeur cible est requise",
        invalid_type_error: "La valeur cible doit être un nombre",
      })
      .min(0, "La valeur cible doit être positive"),
  ),
  targetUnit: z
    .string({ required_error: "L'unité est requise" })
    .trim()
    .min(1, "L'unité est requise"),
  isActive: z.boolean().default(true),
});

export type KpiGoalFormValues = z.infer<typeof kpiGoalSchema>;

export const ensureKpiMetric = (value: string | null | undefined): KpiMetric => {
  const fallback = KPI_METRIC_OPTIONS[0].value;
  if (!value) {
    return fallback;
  }
  return KPI_METRIC_OPTIONS.some((option) => option.value === value)
    ? (value as KpiMetric)
    : fallback;
};

export const ensureKpiPeriod = (value: string | null | undefined): KpiPeriod => {
  const fallback = KPI_PERIOD_OPTIONS[0].value;
  if (!value) {
    return fallback;
  }
  return KPI_PERIOD_OPTIONS.some((option) => option.value === value)
    ? (value as KpiPeriod)
    : fallback;
};

export const getKpiMetricLabel = (metric: string) =>
  KPI_METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? metric;

export const getKpiMetricDescription = (metric: string) =>
  KPI_METRIC_OPTIONS.find((option) => option.value === metric)?.description ??
  "Objectif personnalisé";

export const getKpiMetricDefaultUnit = (metric: string) =>
  KPI_METRIC_OPTIONS.find((option) => option.value === metric)?.defaultUnit ?? "";

export const getKpiPeriodLabel = (period: string) =>
  KPI_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period;
