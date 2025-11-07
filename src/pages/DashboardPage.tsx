import { Layout } from "@/components/layout/Layout";
import { KPICard } from "@/components/dashboard/KPICard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { KpiGoalsCard } from "@/app/(dashboard)/_components/KpiGoalsCard";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardMetrics, useRevenueData } from "@/hooks/useDashboardData";
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
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo } from "react";

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
  const { session, loading: authLoading } = useAuth();
  const currentOrgId = session?.user?.user_metadata?.org_id ?? session?.user?.id ?? null;
  const queriesEnabled = !authLoading && Boolean(currentOrgId);

  const metricsQuery = useDashboardMetrics(currentOrgId, { enabled: queriesEnabled });
  const revenueQuery = useRevenueData(currentOrgId, { enabled: queriesEnabled });

  const lastUpdatedIso = metricsQuery.data?.generatedAt ?? revenueQuery.data?.generatedAt;
  const lastUpdatedLabel = lastUpdatedIso
    ? format(new Date(lastUpdatedIso), "dd MMM yyyy 'à' HH:mm", { locale: fr })
    : undefined;

  const revenueWeekDelta = useMemo(() => {
    if (!revenueQuery.data || revenueQuery.data.previousWeekTotal === 0) {
      return null;
    }

    const diff = revenueQuery.data.currentWeekTotal - revenueQuery.data.previousWeekTotal;
    return Number(((diff / revenueQuery.data.previousWeekTotal) * 100).toFixed(1));
  }, [revenueQuery.data]);

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
          />

          <KPICard
            title="CA du Mois"
            value={currencyFormatter.format(metricsQuery.data?.caMois ?? 0)}
            change="Chantiers terminés ce mois"
            changeType="positive"
            icon={Euro}
            gradient="from-accent to-accent-hover"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard
            title="CA de la Semaine"
            value={currencyFormatter.format(metricsQuery.data?.caSemaine ?? 0)}
            change="Chantiers terminés cette semaine"
            changeType="positive"
            icon={BarChart3}
            gradient="from-purple-500 to-purple-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
          />

          <KPICard
            title="Chantiers Ouverts"
            value={numberFormatter.format(metricsQuery.data?.chantiersOuverts ?? 0)}
            change={`${metricsQuery.data?.chantiersFinSemaine ?? 0} se terminent cette semaine`}
            changeType="neutral"
            icon={Building2}
            gradient="from-emerald-500 to-emerald-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
          />

          <KPICard
            title="RDV Programmés"
            value={numberFormatter.format(metricsQuery.data?.rdvProgrammesSemaine ?? 0)}
            change="Cette semaine"
            changeType="neutral"
            icon={Calendar}
            gradient="from-indigo-500 to-indigo-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
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
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard
            title="Surface Isolée"
            value={`${surfaceFormatter.format(metricsQuery.data?.surfaceIsoleeMois ?? 0)} m²`}
            change="Chantiers terminés ce mois"
            changeType="neutral"
            icon={Ruler}
            gradient="from-teal-500 to-teal-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
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
          />

          <KPICard
            title="Marge Totale"
            value={currencyFormatter.format(metricsQuery.data?.margeTotaleMois ?? 0)}
            change="Chantiers terminés ce mois"
            changeType="positive"
            icon={Target}
            gradient="from-green-500 to-green-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
          />

          <KPICard
            title="LEDs Installées"
            value={numberFormatter.format(metricsQuery.data?.ledInstalleesMois ?? 0)}
            change="Chantiers terminés ce mois"
            changeType="neutral"
            icon={Zap}
            gradient="from-amber-500 to-amber-600"
            isLoading={metricsQuery.isLoading || !queriesEnabled}
            error={metricsQuery.error ? "Erreur" : undefined}
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
