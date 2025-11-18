import { Layout } from "@/components/layout/Layout";
import { CompactKPICard } from "@/components/dashboard/CompactKPICard";
import { InsightBanner } from "@/components/dashboard/InsightBanner";
import { MetricBreakdownCard } from "@/components/dashboard/MetricBreakdownCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { KpiGoalsCard } from "@/app/(dashboard)/_components/KpiGoalsCard";
import { PeriodFilter, type PeriodType, type DateRange } from "@/components/dashboard/PeriodFilter";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardMetrics } from "@/hooks/useDashboardData";
import { useSparklineData } from "@/hooks/useSparklineData";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useOrg } from "@/features/organizations/OrgContext";
import { Users, FolderOpen, FileText, Building2, Target, TrendingUp, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const DashboardPage = () => {
  const { loading: authLoading } = useAuth();
  const { currentOrgId, isLoading: orgLoading } = useOrg();
  const queriesEnabled = !authLoading && !orgLoading && Boolean(currentOrgId);
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfWeek(new Date(), { locale: fr }), to: endOfWeek(new Date(), { locale: fr }) });

  const metricsQuery = useDashboardMetrics(currentOrgId, dateRange, { enabled: queriesEnabled });
  const performanceQuery = usePerformanceMetrics(currentOrgId);
  const revenueSparkline = useSparklineData(currentOrgId, "revenue", 30);
  const sitesSparkline = useSparklineData(currentOrgId, "sites", 30);
  const leadsSparkline = useSparklineData(currentOrgId, "leads", 30);
  const projectsSparkline = useSparklineData(currentOrgId, "projects", 30);

  const lastUpdatedLabel = metricsQuery.data?.generatedAt ? format(new Date(metricsQuery.data.generatedAt), "dd MMM yyyy 'à' HH:mm", { locale: fr }) : undefined;
  const insight = useMemo(() => {
    if (!metricsQuery.data) return null;
    const { finishedSitesPeriod, caPeriode } = metricsQuery.data;
    return finishedSitesPeriod > 0 && caPeriode > 0 ? `Cette ${periodType === "week" ? "semaine" : "période"}, vous avez clôturé ${finishedSitesPeriod} site${finishedSitesPeriod > 1 ? "s" : ""} avec un CA de ${currencyFormatter.format(caPeriode)}` : null;
  }, [metricsQuery.data, periodType]);

  if (authLoading || orgLoading) return <Layout><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div></Layout>;
  if (!currentOrgId) return <Layout><Alert><AlertTitle>Aucune organisation sélectionnée</AlertTitle><AlertDescription>Sélectionnez une organisation.</AlertDescription></Alert></Layout>;

  const metrics = metricsQuery.data;
  const performance = performanceQuery.data;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center"><h1 className="text-3xl font-bold">Tableau de Bord</h1>{lastUpdatedLabel && <p className="text-sm text-muted-foreground">Mis à jour le {lastUpdatedLabel}</p>}</div>
        {insight && <InsightBanner insight={insight} />}
        <PeriodFilter periodType={periodType} dateRange={dateRange} onPeriodChange={(type, range) => { setPeriodType(type); setDateRange(range); }} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <CompactKPICard title="Leads Actifs" icon={Users} mainValue={numberFormatter.format(metrics?.leadsActifs ?? 0)} subMetrics={[{ label: "Actifs", value: numberFormatter.format(metrics?.leadsActifs ?? 0) }]} sparklineData={leadsSparkline.data || []} trend="up" />
          <CompactKPICard title="Projets en Cours" icon={FolderOpen} mainValue={numberFormatter.format(metrics?.projetsEnCours ?? 0)} sparklineData={projectsSparkline.data || []} />
          <CompactKPICard title="Devis en Attente" icon={FileText} mainValue={numberFormatter.format(metrics?.devisEnAttente ?? 0)} />
          <CompactKPICard title="Sites Actifs" icon={Building2} mainValue={numberFormatter.format(metrics?.chantiersOuverts ?? 0)} sparklineData={sitesSparkline.data || []} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <CompactKPICard title="Taux de Conversion" icon={Target} mainValue={performance?.conversionRate?.toFixed(1) ?? "0"} mainUnit="%" variant="gauge" gaugePercentage={performance?.conversionRate ?? 0} />
          <CompactKPICard title="Taux de Clôture" icon={CheckCircle} mainValue={performance?.closureRate?.toFixed(1) ?? "0"} mainUnit="%" variant="gauge" gaugePercentage={performance?.closureRate ?? 0} />
          <CompactKPICard title="Ponctualité" icon={AlertTriangle} mainValue={performance?.onTimeCompletion?.toFixed(1) ?? "0"} mainUnit="%" variant="gauge" gaugePercentage={performance?.onTimeCompletion ?? 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricBreakdownCard title="Chiffre d'Affaires" icon={TrendingUp} metrics={[{ label: "Période actuelle", value: Math.round(metrics?.caPeriode ?? 0) }]} aggregateValue={Math.round((metrics?.caPeriode ?? 0) / 1000)} aggregateUnit="k€" aggregateLabel="Total de la période" chartData={revenueSparkline.data || []} />
          <MetricBreakdownCard title="Utilisation" icon={Activity} metrics={[{ label: "Taux global", value: Number(performance?.utilizationRate?.toFixed(0) ?? 0) }]} aggregateValue={Number(performance?.utilizationRate?.toFixed(1) ?? 0)} aggregateUnit="%" aggregateLabel="Taux d'utilisation global" chartData={sitesSparkline.data || []} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><RevenueChart orgId={currentOrgId} enabled={queriesEnabled} compact /></div>
          <ActivityFeed orgId={currentOrgId} enabled={queriesEnabled} compact />
        </div>

        <KpiGoalsCard orgId={currentOrgId} />
      </div>
    </Layout>
  );
};

export default DashboardPage;
