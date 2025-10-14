import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatNumber = (value: number, minimumFractionDigits = 0, maximumFractionDigits = 2): string =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);

export const formatDate = (value: string | Date | null | undefined, fallback = "—"): string => {
  if (!value) {
    return fallback;
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return format(date, "dd/MM/yyyy", { locale: fr });
};

export const toPercentageLabel = (value: number, fractionDigits = 1) => {
  const percentage = (value * 100).toFixed(fractionDigits).replace(".", ",");
  return `${percentage} %`;
};

export const bankRound = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
