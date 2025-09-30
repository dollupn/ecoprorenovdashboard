import { Layout } from "@/components/layout/Layout";
import { KPICard } from "@/components/dashboard/KPICard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  FolderOpen,
  FileText,
  Euro,
  Building2,
  TrendingUp,
  Calendar,
  Target,
  Package
} from "lucide-react";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
            <p className="text-sm font-medium">Aujourd'hui à 14:30</p>
          </div>
        </div>


        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Leads Actifs"
            value="27"
            change="+12% ce mois"
            changeType="positive"
            icon={Users}
            gradient="from-blue-500 to-blue-600"
          />
          <KPICard
            title="Projets en Cours"
            value="15"
            change="+3 cette semaine"
            changeType="positive"
            icon={FolderOpen}
            gradient="from-primary to-primary-glow"
          />
          <KPICard
            title="Devis en Attente"
            value="8"
            change="2 expirent bientôt"
            changeType="negative"
            icon={FileText}
            gradient="from-orange-500 to-orange-600"
          />
          <KPICard
            title="CA du Mois"
            value="125 k€"
            change="+18% vs mois dernier"
            changeType="positive"
            icon={Euro}
            gradient="from-accent to-accent-hover"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Chantiers Ouverts"
            value="12"
            change="3 se terminent cette semaine"
            changeType="neutral"
            icon={Building2}
            gradient="from-purple-500 to-purple-600"
          />
          <KPICard
            title="RDV Programmés"
            value="6"
            change="Cette semaine"
            changeType="neutral"
            icon={Calendar}
            gradient="from-indigo-500 to-indigo-600"
          />
          <KPICard
            title="Taux de Conversion"
            value="32%"
            change="+5% ce trimestre"
            changeType="positive"
            icon={Target}
            gradient="from-green-500 to-green-600"
          />
          <KPICard
            title="Surface Isolée"
            value="2,840 m²"
            change="Ce mois"
            changeType="neutral"
            icon={TrendingUp}
            gradient="from-teal-500 to-teal-600"
          />
        </div>

        {/* Charts and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart />
          <ActivityFeed />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
