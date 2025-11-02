import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RentabilityResult } from "@/lib/rentability";
import { Euro, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface RentabiliteCardProps {
  result: RentabilityResult;
  className?: string;
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatPercent = (value: number) => percentFormatter.format(value);

export const RentabiliteCard = ({ result, className }: RentabiliteCardProps) => {
  const isProfitable = result.marginTotal >= 0;
  const marginColor = isProfitable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const marginBgColor = isProfitable ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950";

  const StatTile = ({
    label,
    value,
    hint,
    icon: Icon,
    colorClass,
  }: {
    label: string;
    value: string;
    hint?: string;
    icon?: React.ElementType;
    colorClass?: string;
  }) => (
    <div className={`p-4 rounded-lg border ${colorClass || "bg-card"}`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${colorClass ? marginColor : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isProfitable ? (
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          Rentabilité (Temps réel)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatTile
          label={`Base de calcul (${result.unitLabel})`}
          value={result.baseUnits.toFixed(2)}
          hint={`Mode: ${result.measurementMode === "luminaire" ? "Luminaire" : "Surface"}`}
        />

        <StatTile
          label="CA (Chiffre d'affaires)"
          value={formatCurrency(result.ca)}
          hint="Prime CEE + Travaux client"
          icon={DollarSign}
        />

        <StatTile
          label="Coûts totaux"
          value={formatCurrency(result.totalCosts)}
          hint="Main d'œuvre + Commission + Frais + S-traitant"
        />

        <StatTile
          label={`Marge (€/${result.unitLabel})`}
          value={formatCurrency(result.marginPerUnit)}
          hint={`Marge totale / ${result.baseUnits.toFixed(2)} ${result.unitLabel}`}
          colorClass={marginBgColor}
        />

        <StatTile
          label="Marge totale (€)"
          value={formatCurrency(result.marginTotal)}
          hint="CA - Coûts totaux"
          icon={Euro}
          colorClass={marginBgColor}
        />

        <StatTile
          label="Marge (%)"
          value={formatPercent(result.marginRate)}
          hint="Marge totale / CA"
          colorClass={marginBgColor}
        />
      </CardContent>
    </Card>
  );
};
