import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";
import {
  TrendingUp,
  Euro,
  Target,
  Timer,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useRevenueData } from "@/hooks/useDashboardData";
import { useReportsData, TopProjectSummary } from "@/hooks/useReportsData";
import { format, endOfYear, startOfYear, isSameDay, isSameMonth, isSameYear, subYears } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useOrg } from "@/features/organizations/OrgContext";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);

const formatCountLabel = (count: number, singular: string, plural: string) =>
  `${new Intl.NumberFormat("fr-FR").format(count)} ${count > 1 ? plural : singular}`;

const energyFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

const formatRangeDisplay = (range?: DateRange | null) => {
  if (!range?.from || !range?.to) {
    return "Sélectionnez une période";
  }

  if (isSameDay(range.from, range.to)) {
    return format(range.from, "d MMM yyyy", { locale: fr });
  }

  if (isSameMonth(range.from, range.to) && isSameYear(range.from, range.to)) {
    return `${format(range.from, "d", { locale: fr })}–${format(range.to, "d MMM yyyy", { locale: fr })}`;
  }

  if (isSameYear(range.from, range.to)) {
    return `${format(range.from, "d MMM", { locale: fr })} – ${format(range.to, "d MMM yyyy", { locale: fr })}`;
  }

  return `${format(range.from, "d MMM yyyy", { locale: fr })} – ${format(range.to, "d MMM yyyy", { locale: fr })}`;
};

type Highlight = {
  title: string;
  value: string;
  description: string;
  emoji: string;
  progress?: number;
};

type ReportAlert = {
  title: string;
  description: string;
  type: "negative" | "warning" | "neutral";
};

const alertColorMap: Record<ReportAlert["type"], string> = {
  negative: "bg-red-500/10 text-red-600",
  warning: "bg-orange-500/10 text-orange-600",
  neutral: "bg-primary/10 text-primary",
};

const PROJECT_DURATION_TARGET_DAYS = 35;
const ANNUAL_REVENUE_TARGET = 600000;

const Reports = () => {
  const { loading: authLoading } = useAuth();
  const { currentOrgId, isLoading: orgLoading } = useOrg();
  const queriesEnabled = !authLoading && !orgLoading && Boolean(currentOrgId);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  }));

  const rangeFilters = useMemo<
    { startDate: Date; endDate: Date } | undefined
  >(() => {
    if (dateRange?.from && dateRange?.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    return undefined;
  }, [dateRange]);

  const revenueQuery = useRevenueData(currentOrgId, {
    enabled: queriesEnabled,
    ...(rangeFilters ?? {}),
  });
  const reportsQuery = useReportsData(currentOrgId, {
    enabled: queriesEnabled,
    ...(rangeFilters ?? {}),
  });

  const rangeLabel = useMemo(() => formatRangeDisplay(dateRange), [dateRange]);
  const hasCompleteRange = Boolean(rangeFilters);
  const periodYearLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return `${new Date().getFullYear()}`;
    }
    const startYear = dateRange.from.getFullYear();
    const endYear = dateRange.to.getFullYear();
    return startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;
  }, [dateRange]);
  const previousPeriodLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return `${new Date().getFullYear() - 1}`;
    }
    return formatRangeDisplay({
      from: subYears(dateRange.from, 1),
      to: subYears(dateRange.to, 1),
    });
  }, [dateRange]);
  const narrativePeriodLabel = hasCompleteRange ? rangeLabel : "la période courante";

  const lastUpdatedIso = reportsQuery.data?.generatedAt ?? revenueQuery.data?.generatedAt;
  const lastUpdatedLabel = lastUpdatedIso
    ? format(new Date(lastUpdatedIso), "dd MMM yyyy 'à' HH:mm", { locale: fr })
    : null;

  const revenueTrendData = useMemo(
    () =>
      revenueQuery.data
        ? revenueQuery.data.points.map((point) => ({
            month: point.month,
            facture: point.invoicedTotal,
            encaisse: point.total,
          }))
        : [],
    [revenueQuery.data],
  );

  const yearToDatePaid = revenueQuery.data?.yearToDatePaid ?? 0;
  const previousYearToDatePaid = revenueQuery.data?.previousYearToDatePaid ?? 0;

  const revenueYoYDelta = useMemo(() => {
    if (!revenueQuery.data || previousYearToDatePaid <= 0) {
      return null;
    }
    const diff = yearToDatePaid - previousYearToDatePaid;
    return (diff / previousYearToDatePaid) * 100;
  }, [revenueQuery.data, yearToDatePaid, previousYearToDatePaid]);

  const revenueProgress = ANNUAL_REVENUE_TARGET
    ? Math.round(Math.min((yearToDatePaid / ANNUAL_REVENUE_TARGET) * 100, 100))
    : 0;
  const revenueRemaining = Math.max(ANNUAL_REVENUE_TARGET - yearToDatePaid, 0);

  const marginAverage = reportsQuery.data?.margin.average ?? null;
  const marginTarget = reportsQuery.data?.margin.target ?? 0.35;
  const marginProgress =
    marginAverage !== null && marginTarget > 0
      ? Math.min((marginAverage / marginTarget) * 100, 100)
      : 0;

  const conversionMoyenne = reportsQuery.data?.conversion.averageRate ?? 0;
  const totalLeads = reportsQuery.data?.conversion.totalLeads ?? 0;
  const qualifiedLeads = reportsQuery.data?.conversion.qualifiedLeads ?? 0;
  const sources = reportsQuery.data?.conversion.sources;
  const sourceBreakdown = useMemo(() => sources ?? [], [sources]);

  const averageDuration = reportsQuery.data?.sites.averageDuration ?? null;
  const durationSampleSize = reportsQuery.data?.sites.durationSampleSize ?? 0;
  const activeSites = reportsQuery.data?.sites.activeCount ?? 0;
  const completedSites = reportsQuery.data?.sites.completedCount ?? 0;
  const totalSiteRevenue = reportsQuery.data?.sites.totalRevenue ?? 0;
  const averageRevenuePerSite = reportsQuery.data?.sites.averageRevenuePerSite ?? null;
  const revenueSampleSize = reportsQuery.data?.sites.revenueSampleSize ?? 0;
  const totalMarginAnalyzed = reportsQuery.data?.sites.totalMargin ?? 0;
  const marginSampleSize = reportsQuery.data?.margin.sampleSize ?? 0;

  const topProjects = reportsQuery.data?.sites.topProjects ?? [];
  const energyMetrics = reportsQuery.data?.energy;
  const energyBreakdown = energyMetrics?.breakdown ?? [];

  const highlightLoading = queriesEnabled && (revenueQuery.isLoading || reportsQuery.isLoading);

  const motivationHighlights = useMemo<Highlight[]>(() => {
    const leadsPeriodNarrative = hasCompleteRange
      ? `sur la période ${rangeLabel}`
      : `pendant ${narrativePeriodLabel}`;

    return [
      {
        title: `Objectif CA ${periodYearLabel}`,
        value: `${revenueProgress}% atteint`,
        description:
          ANNUAL_REVENUE_TARGET > 0
            ? "Définissez un objectif annuel pour suivre votre progression."
            : yearToDatePaid >= ANNUAL_REVENUE_TARGET
              ? `Objectif dépassé avec ${formatCurrency(yearToDatePaid)} encaissés.`
              : `Encore ${formatCurrency(revenueRemaining)} pour atteindre ${formatCurrency(
                  ANNUAL_REVENUE_TARGET,
                )}.`,
        emoji: "🚀",
        progress: revenueProgress,
      },
      {
        title: "Leads qualifiés",
        value: `${qualifiedLeads}`,
        description:
          totalLeads === 0
            ? "Aucun lead analysé pour le moment."
          : `${qualifiedLeads} sur ${totalLeads} leads reçus ${leadsPeriodNarrative}.`,
        emoji: "📈",
      },
      {
        title: "Chantiers actifs",
        value: `${activeSites}`,
        description:
          activeSites === 0
            ? "Aucun chantier en cours actuellement."
            : `${activeSites} chantier(s) suivis ${hasCompleteRange ? `sur la période ${rangeLabel}` : `pendant ${narrativePeriodLabel}`}.`,
        emoji: "🏗️",
      },
    ];
  }, [
    hasCompleteRange,
    rangeLabel,
    periodYearLabel,
    narrativePeriodLabel,
    revenueProgress,
    yearToDatePaid,
    revenueRemaining,
    qualifiedLeads,
    totalLeads,
    activeSites,
  ]);

  const bestConversionSource = useMemo(() => {
    if (sourceBreakdown.length === 0) return null;
    return [...sourceBreakdown].sort((a, b) => b.conversion - a.conversion)[0];
  }, [sourceBreakdown]);

  const highestVolumeSource = useMemo(() => {
    if (sourceBreakdown.length === 0) return null;
    return [...sourceBreakdown].sort((a, b) => b.leads - a.leads)[0];
  }, [sourceBreakdown]);

  const alerts = useMemo<ReportAlert[]>(() => {
    if (!reportsQuery.data) {
      return [];
    }

    const items: ReportAlert[] = [];

    if (marginAverage !== null && marginAverage < marginTarget * 0.9) {
      items.push({
        title: "Marge brute en recul",
        description: `Marge moyenne à ${formatPercent(marginAverage)} (objectif ${formatPercent(
          marginTarget,
        )}).`,
        type: "negative",
      });
    }

    if (conversionMoyenne < 0.25 && totalLeads > 0) {
      items.push({
        title: "Conversion des leads",
        description: `Taux actuel ${formatPercent(conversionMoyenne)} sur ${totalLeads} leads.`,
        type: "warning",
      });
    }

    if (averageDuration !== null && averageDuration > PROJECT_DURATION_TARGET_DAYS) {
      items.push({
        title: "Allongement des délais",
        description: `Durée moyenne de ${averageDuration} jours (objectif ${PROJECT_DURATION_TARGET_DAYS}).`,
        type: "warning",
      });
    }

    if (items.length === 0) {
      items.push({
        title: "Indicateurs au vert",
        description: "Aucune alerte particulière détectée cette période.",
        type: "neutral",
      });
    }

    return items;
  }, [
    reportsQuery.data,
    marginAverage,
    marginTarget,
    conversionMoyenne,
    totalLeads,
    averageDuration,
  ]);

  const trendHasData = revenueTrendData.some((point) => point.facture > 0 || point.encaisse > 0);
  const sourceHasData = sourceBreakdown.length > 0;

  const errorMessages = [revenueQuery.error?.message, reportsQuery.error?.message].filter(
    Boolean,
  ) as string[];

  const getProjectEmoji = (project: TopProjectSummary) => {
    const marginRate = project.marginRate ?? 0;
    if (project.revenue >= 40000 && marginRate >= 0.3) {
      return "🏆";
    }
    if (marginRate >= 0.33) {
      return "💪";
    }
    if (project.revenue >= 30000) {
      return "🚀";
    }
    return "✨";
  };

  const revenueBadgeClass = cn(
    "border",
    revenueYoYDelta === null
      ? "bg-muted text-muted-foreground border-border/60"
      : revenueYoYDelta >= 0
        ? "bg-green-500/10 text-green-600 border-green-500/20"
        : "bg-red-500/10 text-red-600 border-red-500/20",
  );

  const revenueBadgeText =
    revenueYoYDelta === null
      ? "Historique insuffisant"
      : `${revenueYoYDelta >= 0 ? "+" : ""}${revenueYoYDelta.toFixed(1)}% vs ${previousPeriodLabel}`;

  const durationBadgeClass = cn(
    "border",
    averageDuration === null
      ? "bg-muted text-muted-foreground border-border/60"
      : averageDuration > PROJECT_DURATION_TARGET_DAYS
        ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
        : "bg-green-500/10 text-green-600 border-green-500/20",
  );

  const durationBadgeText =
    averageDuration === null
      ? `Objectif : ${PROJECT_DURATION_TARGET_DAYS} jours`
      : `${averageDuration - PROJECT_DURATION_TARGET_DAYS >= 0 ? "+" : ""}${
          averageDuration - PROJECT_DURATION_TARGET_DAYS
        }j vs objectif`;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Reporting & Performance
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi des indicateurs clés de votre activité EcoProRenov
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground">Période analysée</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !hasCompleteRange && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    locale={fr}
                    selected={dateRange}
                    defaultMonth={dateRange?.from ?? new Date()}
                    onSelect={(range) => setDateRange(range ?? undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">{periodYearLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dernière actualisation</p>
              {lastUpdatedLabel ? (
                <p className="font-medium">{lastUpdatedLabel}</p>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
            </div>
          </div>
        </div>

        {errorMessages.length > 0 && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <AlertTitle>Erreur de chargement</AlertTitle>
            <AlertDescription>
              {errorMessages[0]}
              {errorMessages.length > 1 && <span className="block">{errorMessages[1]}</span>}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {motivationHighlights.map((highlight) => (
            <Card
              key={highlight.title}
              className="shadow-card border-0 bg-card/60 backdrop-blur"
            >
              <CardContent className="space-y-3 p-5">
                {highlightLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {highlight.title}
                        </p>
                        <p className="text-xl font-semibold">{highlight.value}</p>
                      </div>
                      <span className="text-2xl" aria-hidden>
                        {highlight.emoji}
                      </span>
                    </div>
                    {typeof highlight.progress === "number" && (
                      <div className="space-y-1">
                        <Progress value={highlight.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          Objectif atteint à {highlight.progress}%
                        </p>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {highlight.description}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Euro className="h-4 w-4 text-primary" />
                CA cumulé ({periodYearLabel})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {revenueQuery.isLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">{formatCurrency(yearToDatePaid)}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className={revenueBadgeClass}>
                      {revenueYoYDelta !== null ? (
                        revenueYoYDelta >= 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 mr-1" />
                        )
                      ) : null}
                      {revenueBadgeText}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Marge brute moyenne
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {marginAverage !== null ? formatPercent(marginAverage) : "—"}
                  </p>
                  <Progress value={marginProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Objectif annuel : {formatPercent(marginTarget)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4 text-primary" />
                Taux de conversion moyen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">{formatPercent(conversionMoyenne)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalLeads === 0
                      ? "Aucun lead analysé"
                      : `Basé sur ${totalLeads} leads`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Timer className="h-4 w-4 text-primary" />
                Délai moyen de réalisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {averageDuration !== null ? `${averageDuration} jours` : "—"}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className={durationBadgeClass}>{durationBadgeText}</Badge>
                    {durationSampleSize > 0 && (
                      <span className="text-muted-foreground">
                        {durationSampleSize} chantier(s) analysé(s)
                      </span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Chantiers livrés
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {new Intl.NumberFormat("fr-FR").format(completedSites)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {completedSites === 0
                      ? "Aucun chantier livré sur la période."
                      : `${formatCountLabel(completedSites, "chantier livré", "chantiers livrés")} sur la période.`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Euro className="h-4 w-4 text-primary" />
                CA moyen par chantier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {averageRevenuePerSite !== null ? formatCurrency(averageRevenuePerSite) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revenueSampleSize === 0
                      ? "Aucun chiffre d'affaires consolidé."
                      : `${formatCountLabel(
                          revenueSampleSize,
                          "chantier facturé",
                          "chantiers facturés",
                        )}, soit ${formatCurrency(totalSiteRevenue)} cumulés.`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Énergie cumulée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ) : reportsQuery.error ? (
                <p className="text-sm text-destructive">Erreur de chargement</p>
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {energyFormatter.format(energyMetrics?.totalMwh ?? 0)} MWh
                  </p>
                  {energyMetrics && energyBreakdown.length > 0 ? (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {energyBreakdown.map((entry) => (
                        <li
                          key={entry.category}
                          className="flex items-center justify-between gap-4"
                        >
                          <span>{entry.category}</span>
                          <span className="font-medium text-foreground">
                            {energyFormatter.format(entry.mwh)} MWh
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aucune donnée par catégorie
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Marge totale analysée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {marginSampleSize === 0 ? "—" : formatCurrency(totalMarginAnalyzed)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {marginSampleSize === 0
                      ? "Aucune marge calculée sur la période."
                      : `${formatCountLabel(
                          marginSampleSize,
                          "chantier analysé",
                          "chantiers analysés",
                        )} pour la rentabilité.`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Évolution du CA facturé vs encaissé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {revenueQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : trendHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-muted-foreground" fontSize={12} />
                      <YAxis
                        className="text-muted-foreground"
                        fontSize={12}
                        tickFormatter={(value) => `${Math.round(value / 1000)}k€`}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value.toLocaleString("fr-FR")} €`}
                        labelFormatter={(label) => `Mois : ${label}`}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="facture"
                        name="CA facturé"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="encaisse"
                        name="CA encaissé"
                        stroke="hsl(var(--accent))"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Aucune facture enregistrée pour le moment.
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-background/80 p-4 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Conversion moyenne</span>
                  <span className="font-medium">{formatPercent(conversionMoyenne)}</span>
                </div>
                <Progress value={conversionMoyenne * 100} className="h-2" />
                {sourceHasData ? (
                  <p className="text-muted-foreground">
                    {highestVolumeSource && bestConversionSource
                      ? `${highestVolumeSource.source} génère le plus de leads (${highestVolumeSource.leads}), tandis que ${bestConversionSource.source} atteint ${formatPercent(
                          bestConversionSource.conversion,
                        )} de conversion.`
                      : "Analysez vos sources pour identifier les meilleures opportunités."}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Collectez des leads pour visualiser la performance par source.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-3">
            <CardHeader>
              <CardTitle>Sources de leads & conversion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-80">
                {reportsQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : sourceHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sourceBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="source" className="text-muted-foreground" fontSize={12} />
                      <YAxis
                        yAxisId="left"
                        className="text-muted-foreground"
                        fontSize={12}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        className="text-muted-foreground"
                        fontSize={12}
                        tickFormatter={(value) => `${Math.round(value * 100)}%`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === "conversion"
                            ? [`${formatPercent(value)}`, "Conversion"]
                            : [value, "Leads"]
                        }
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="leads"
                        name="Leads"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="conversion"
                        name="Conversion"
                        stroke="hsl(var(--accent))"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Aucune donnée source disponible.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-4">
            <CardHeader>
              <CardTitle>Top projets de la période</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Marge (€)</TableHead>
                    <TableHead className="text-right">Marge (%)</TableHead>
                    <TableHead className="text-right">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsQuery.isLoading ? (
                    [...Array(3)].map((_, index) => (
                      <TableRow key={index} className="hover:bg-transparent">
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : topProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun chantier avec chiffre d'affaires enregistré pour l'instant.
                      </TableCell>
                    </TableRow>
                  ) : (
                    topProjects.map((project) => {
                      const marginRate = project.marginRate ?? 0;
                      const marginValue =
                        project.marginTotal !== null
                          ? project.marginTotal
                          : project.marginRate !== null
                            ? project.revenue * project.marginRate
                            : null;
                      const nameParts = [project.projectRef, project.clientName].filter(Boolean);
                      const displayName = nameParts.length > 0 ? nameParts.join(" • ") : "Projet";

                      return (
                        <TableRow key={project.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium">
                            <span className="mr-2 text-lg" aria-hidden>
                              {getProjectEmoji(project)}
                            </span>
                            {displayName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(project.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600">
                            {marginValue !== null ? formatCurrency(marginValue) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {project.marginRate !== null ? formatPercent(marginRate) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {project.statusLabel ?? project.status ?? "Statut inconnu"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-3">
            <CardHeader>
              <CardTitle>Alertes & recommandations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.title}
                  className="rounded-lg border bg-background/80 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-full p-2", alertColorMap[alert.type])}>
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
