import { Layout } from "@/components/layout/Layout";
import { KPICard } from "@/components/dashboard/KPICard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { KpiGoalsCard } from "@/app/(dashboard)/_components/KpiGoalsCard";
import { PeriodFilter, type PeriodType, type DateRange } from "@/components/dashboard/PeriodFilter";
import { ComparativeCharts } from "@/components/dashboard/ComparativeCharts";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardMetrics, useRevenueData, useDashboardHistory } from "@/hooks/useDashboardData";
import { useDashboardComparative } from "@/hooks/useDashboardComparative";
import { useOrg } from "@/features/organizations/OrgContext";
import {
  Users,
  FolderOpen,
  FileText,
  Euro,
  Building2,
  BarChart3,
  Calendar,
  Target,
  Ruler,
  Zap,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const surfaceFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const energyFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

const DashboardPage = () => {
  const { loading: authLoading } = useAuth();
  const { currentOrgId, isLoading: orgLoading } = useOrg();
  const queriesEnabled = !authLoading && !orgLoading && Boolean(currentOrgId);
  const navigate = useNavigate();

  // Period filter state
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfWeek(new Date(), { locale: fr }),
    to: endOfWeek(new Date(), { locale: fr }),
  });

  const metricsQuery = useDashboardMetrics(currentOrgId, dateRange, { enabled: queriesEnabled });
  const revenueData = useRevenueData(currentOrgId, {
    enabled: queriesEnabled,
    startDate: dateRange.from,
    endDate: dateRange.to,
  });
  const comparativeQuery = useDashboardComparative(currentOrgId, periodType, dateRange, { enabled: queriesEnabled });
  const historyQuery = useDashboardHistory(currentOrgId, dateRange, { enabled: queriesEnabled });

  const lastUpdatedIso = metricsQuery.data?.generatedAt ?? revenueData.data?.generatedAt;
  const lastUpdatedLabel = lastUpdatedIso
    ? format(new Date(lastUpdatedIso), "dd MMM yyyy 'à' HH:mm", { locale: fr })
    : undefined;

  const revenueWeekDelta = useMemo(() => {
    if (!revenueData.data || revenueData.data.previousWeekTotal === 0) {
      return null;
    }

    const diff = revenueData.data.currentWeekTotal - revenueData.data.previousWeekTotal;
    return Number(((diff / revenueData.data.previousWeekTotal) * 100).toFixed(1));
  }, [revenueData.data]);

  const conversionDelta = metricsQuery.data?.tauxConversion.delta ?? null;

  const energyBreakdown = metricsQuery.data?.energyByCategory ?? [];
  const energyDetails = metricsQuery.data
    ? energyBreakdown.length > 0
      ? (
          <ul className="space-y-1">
            {energyBreakdown.map((entry) => (
              <li key={entry.category} className="flex items-center justify-between gap-4">
                <span>{entry.category}</span>
                <span className="font-medium text-foreground">
                  {`${energyFormatter.format(entry.mwh)} MWh`}
                </span>
              </li>
            ))}
          </ul>
        )
      : (
          <p>Aucune donnée par catégorie</p>
        )
    : undefined;

  const handlePeriodChange = (type: PeriodType, range: DateRange) => {
    setPeriodType(type);
    setDateRange(range);
  };

  // Dynamic titles based on period type
  const getPeriodLabel = () => {
    switch (periodType) {
      case 'week':
        return 'de la Semaine';
      case 'month':
        return 'du Mois';
      case 'quarter':
        return 'du Trimestre';
      case 'custom':
        return 'de la Période';
      default:
        return 'de la Période';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Tableau de Bord
            </h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de votre activité EcoProRenov
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Dernière mise à jour</p>
            {lastUpdatedLabel ? (
              <p className="text-sm font-medium">{lastUpdatedLabel}</p>
            ) : (
              <Skeleton className="h-4 w-32 ml-auto" />
            )}
          </div>
        </div>

        {/* Period Filter */}
        <div className="bg-gradient-card rounded-lg p-4 border-0 shadow-card">
          <PeriodFilter
            periodType={periodType}
            dateRange={dateRange}
            onPeriodChange={handlePeriodChange}
          />
        </div>

        {/* Comparative Charts */}
        <ComparativeCharts
          revenueData={comparativeQuery.data?.revenueData || []}
          projectsData={comparativeQuery.data?.projectsData || []}
          leadsData={comparativeQuery.data?.leadsData || []}
          isLoading={comparativeQuery.isLoading}
          periodLabel={comparativeQuery.data?.periodLabel || ""}
        />

        {metricsQuery.error && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <AlertTitle>Erreur de chargement des indicateurs</AlertTitle>
            <AlertDescription>
              {metricsQuery.error.message}
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard
            title="Leads Actifs"
            value={numberFormatter.format(metricsQuery.data?.leadsActifs ?? 0)}
            changeType="positive"
            change={`${metricsQuery.data?.leadsActifs ?? 0} en suivi`}
            icon={Users}
            gradient="from-blue-500 to-blue-700"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            sparklineData={historyQuery.data?.leads}
            onClick={() => navigate('/leads')}
            actions={[
              {
                icon: Plus,
                label: "Nouveau Lead",
                onClick: () => navigate('/leads?action=create'),
              },
              {
                icon: ExternalLink,
                label: "Voir tous",
                onClick: () => navigate('/leads'),
              },
            ]}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title="Projets en Cours"
            value={numberFormatter.format(metricsQuery.data?.projetsEnCours ?? 0)}
            change={`${metricsQuery.data?.projetsEnCours ?? 0} dans le pipe`}
            changeType="positive"
            icon={FolderOpen}
            gradient="from-primary to-primary-glow"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            sparklineData={historyQuery.data?.projects}
            onClick={() => navigate('/projects')}
            actions={[
              {
                icon: Plus,
                label: "Nouveau Projet",
                onClick: () => navigate('/projects?action=create'),
              },
              {
                icon: ExternalLink,
                label: "Voir tous",
                onClick: () => navigate('/projects'),
              },
            ]}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title="Devis en Attente"
            value={numberFormatter.format(metricsQuery.data?.devisEnAttente ?? 0)}
            change={
              (metricsQuery.data?.devisExpirantSous7Jours ?? 0) > 0
                ? `${metricsQuery.data?.devisExpirantSous7Jours ?? 0} à relancer`
                : "Aucun devis urgent"
            }
            changeType={
              (metricsQuery.data?.devisExpirantSous7Jours ?? 0) > 0 ? "negative" : "neutral"
            }
            icon={FileText}
            gradient="from-orange-500 to-orange-600"
            badgeLabel={`${metricsQuery.data?.devisExpirantSous7Jours ?? 0} expirent <7j`}
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/quotes')}
            actions={[
              {
                icon: Plus,
                label: "Nouveau Devis",
                onClick: () => navigate('/quotes?action=create'),
              },
              {
                icon: ExternalLink,
                label: "À relancer",
                onClick: () => navigate('/quotes?filter=expiring'),
              },
            ]}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title={`CA ${getPeriodLabel()}`}
            value={currencyFormatter.format(metricsQuery.data?.caPeriode ?? 0)}
            change="Chantiers terminés"
            changeType="positive"
            icon={Euro}
            gradient="from-accent to-accent-hover"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            sparklineData={historyQuery.data?.revenue}
            onClick={() => navigate('/accounting')}
            actions={[
              {
                icon: ExternalLink,
                label: "Voir détails",
                onClick: () => navigate('/accounting'),
              },
            ]}
            onRetry={() => metricsQuery.refetch()}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard
            title="Chantiers Ouverts"
            value={numberFormatter.format(metricsQuery.data?.chantiersOuverts ?? 0)}
            change={`${metricsQuery.data?.chantiersFinSemaine ?? 0} se terminent cette semaine`}
            changeType="neutral"
            icon={Building2}
            gradient="from-emerald-500 to-emerald-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            sparklineData={historyQuery.data?.sites}
            onClick={() => navigate('/sites?status=open')}
            actions={[
              {
                icon: Plus,
                label: "Démarrer Chantier",
                onClick: () => navigate('/projects'),
              },
              {
                icon: Calendar,
                label: "Planning",
                onClick: () => navigate('/calendar'),
              },
            ]}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title="RDV Programmés"
            value={numberFormatter.format(metricsQuery.data?.rdvProgrammesSemaine ?? 0)}
            change={`Période ${getPeriodLabel().toLowerCase()}`}
            changeType="neutral"
            icon={Calendar}
            gradient="from-indigo-500 to-indigo-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/calendar')}
            actions={[
              {
                icon: Plus,
                label: "Planifier RDV",
                onClick: () => navigate('/calendar?action=create'),
              },
              {
                icon: Calendar,
                label: "Calendrier",
                onClick: () => navigate('/calendar'),
              },
            ]}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title={`Chantiers Terminés ${getPeriodLabel()}`}
            value={numberFormatter.format(metricsQuery.data?.finishedSitesPeriod ?? 0)}
            icon={Building2}
            gradient="from-purple-500 to-purple-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/sites?status=completed')}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title="Taux de Conversion"
            value={formatPercentage(metricsQuery.data?.tauxConversion.rate ?? 0)}
            change={
              conversionDelta === null
                ? "Sur les 90 derniers jours"
                : `${conversionDelta > 0 ? "+" : ""}${conversionDelta.toFixed(1)} pts vs période précédente`
            }
            changeType={
              conversionDelta === null
                ? "neutral"
                : conversionDelta >= 0
                  ? "positive"
                  : "negative"
            }
            icon={Target}
            gradient="from-cyan-500 to-cyan-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/reports')}
            onRetry={() => metricsQuery.refetch()}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard
            title={`Surface Isolée ${getPeriodLabel()}`}
            value={`${surfaceFormatter.format(metricsQuery.data?.surfaceIsoleePeriode ?? 0)} m²`}
            change={`Chantiers terminés ${getPeriodLabel().toLowerCase()}`}
            changeType="neutral"
            icon={Ruler}
            gradient="from-teal-500 to-teal-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/sites')}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title="Énergie Cumulée"
            value={`${energyFormatter.format(metricsQuery.data?.totalMwh ?? 0)} MWh`}
            change="Tous projets actifs"
            changeType="neutral"
            icon={Zap}
            gradient="from-yellow-500 to-orange-500"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            details={energyDetails}
            detailsWhileLoading={
              <div className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            }
            onClick={() => navigate('/reports')}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title={`Marge ${getPeriodLabel()}`}
            value={currencyFormatter.format(metricsQuery.data?.margeTotalePeriode ?? 0)}
            change={`Chantiers terminés ${getPeriodLabel().toLowerCase()}`}
            changeType="positive"
            icon={Target}
            gradient="from-green-500 to-green-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/accounting')}
            onRetry={() => metricsQuery.refetch()}
          />

          <KPICard
            title={`LEDs Installées ${getPeriodLabel()}`}
            value={numberFormatter.format(metricsQuery.data?.ledInstalleesPeriode ?? 0)}
            change={`Chantiers terminés ${getPeriodLabel().toLowerCase()}`}
            changeType="neutral"
            icon={Zap}
            gradient="from-amber-500 to-amber-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
            onClick={() => navigate('/sites')}
            onRetry={() => metricsQuery.refetch()}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
          <RevenueChart orgId={currentOrgId} enabled={queriesEnabled} />
          <div className="space-y-6">
            <KpiGoalsCard orgId={currentOrgId} enabled={queriesEnabled} />
            <ActivityFeed orgId={currentOrgId} enabled={queriesEnabled} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
