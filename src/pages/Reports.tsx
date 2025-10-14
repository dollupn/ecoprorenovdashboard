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
} from "lucide-react";

const revenueTrend = [
  { month: "Jan", facture: 85000, encaisse: 78000 },
  { month: "Fév", facture: 92000, encaisse: 85000 },
  { month: "Mar", facture: 78000, encaisse: 92000 },
  { month: "Avr", facture: 106000, encaisse: 78000 },
  { month: "Mai", facture: 125000, encaisse: 106000 },
  { month: "Juin", facture: 118000, encaisse: 112000 },
  { month: "Juil", facture: 132000, encaisse: 124000 },
];

const sourceBreakdown = [
  { source: "Campagnes CEE", leads: 42, conversion: 0.38 },
  { source: "Partenaires", leads: 27, conversion: 0.41 },
  { source: "Référencement", leads: 19, conversion: 0.29 },
  { source: "Parrainage", leads: 14, conversion: 0.47 },
];

const topProjects = [
  {
    name: "Rénovation Globale - Dupont",
    revenue: 42000,
    margin: 0.32,
    status: "Livraison",
  },
  {
    name: "Isolation Thermique - Martin",
    revenue: 31500,
    margin: 0.28,
    status: "En cours",
  },
  {
    name: "Pompe à chaleur - Leroy",
    revenue: 28750,
    margin: 0.35,
    status: "Signé",
  },
];

const motivationHighlights: {
  title: string;
  value: string;
  description: string;
  emoji: string;
  progress?: number;
}[] = [
  {
    title: "Bonus équipe en vue",
    value: "72% atteint",
    description: "Plus que 48k€ de CA pour débloquer le bonus collectif Q3",
    emoji: "🚀",
    progress: 72,
  },
  {
    title: "Satisfaction client",
    value: "4.7 / 5",
    description: "12 avis 5★ reçus sur les 30 derniers jours",
    emoji: "💬",
  },
  {
    title: "Streak de signature",
    value: "7 jours",
    description: "Des contrats signés chaque jour depuis une semaine",
    emoji: "🔥",
  },
];

const alerts = [
  {
    title: "Marge en dessous de l'objectif",
    description: "Deux chantiers présentent une marge brute < 25%",
    type: "negative" as const,
  },
  {
    title: "Relances devis",
    description: "5 devis en attente depuis plus de 15 jours",
    type: "neutral" as const,
  },
  {
    title: "Délai moyen chantier",
    description: "Le délai moyen dépasse 42 jours (objectif: 35)",
    type: "warning" as const,
  },
];

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

const Reports = () => {
  const conversionMoyenne = sourceBreakdown.reduce(
    (acc, item) => acc + item.conversion,
    0,
  ) / sourceBreakdown.length;

  const totalLeads = sourceBreakdown.reduce((acc, item) => acc + item.leads, 0);

  const getProjectEmoji = (project: (typeof topProjects)[number]) => {
    if (project.revenue >= 40000 && project.margin >= 0.3) {
      return "🏆";
    }
    if (project.margin >= 0.33) {
      return "💪";
    }
    if (project.revenue >= 30000) {
      return "🚀";
    }
    return "✨";
  };

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
            <div>
              <p className="text-muted-foreground">Période analysée</p>
              <p className="font-medium">Janvier - Juillet 2024</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dernière actualisation</p>
              <p className="font-medium">Il y a 5 minutes</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {motivationHighlights.map((highlight) => (
            <Card
              key={highlight.title}
              className="shadow-card border-0 bg-card/60 backdrop-blur"
            >
              <CardContent className="space-y-3 p-5">
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
                      Vous êtes à {highlight.progress}% de votre objectif du mois
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {highlight.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Euro className="h-4 w-4 text-primary" />
                CA cumulé 2024
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold">{formatCurrency(635000)}</p>
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> +18%
                </Badge>
                vs 2023
              </div>
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
              <p className="text-3xl font-semibold">32%</p>
              <Progress value={68} className="h-2" />
              <p className="text-xs text-muted-foreground">Objectif annuel : 35%</p>
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
              <p className="text-3xl font-semibold">{formatPercent(conversionMoyenne)}</p>
              <p className="text-xs text-muted-foreground">
                Basé sur {totalLeads} leads qualifiés
              </p>
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
              <p className="text-3xl font-semibold">42 jours</p>
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                  <ArrowDownRight className="h-3.5 w-3.5 mr-1" /> -4j vs T1
                </Badge>
                Objectif : 35 jours
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolution du CA facturé vs encaissé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrend}>
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
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-3">
            <CardHeader>
              <CardTitle>Sources de leads & conversion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sourceBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="source" className="text-muted-foreground" fontSize={12} />
                    <YAxis
                      yAxisId="left"
                      className="text-muted-foreground"
                      fontSize={12}
                      tickFormatter={(value) => `${value}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      className="text-muted-foreground"
                      fontSize={12}
                      tickFormatter={(value) => formatPercent(value)}
                    />
                    <Tooltip
                      formatter={(value: number, name) =>
                        name === "Leads"
                          ? [`${value} leads`, name]
                          : [formatPercent(value), name]
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
              </div>

              <div className="rounded-lg border bg-background/80 p-4 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Conversion moyenne</span>
                  <span className="font-medium">{formatPercent(conversionMoyenne)}</span>
                </div>
                <Progress value={conversionMoyenne * 100} className="h-2" />
                <p className="text-muted-foreground">
                  Les partenariats sont la source la plus performante, mais les
                  campagnes CEE génèrent le volume le plus important.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="shadow-card border-0 bg-card/60 backdrop-blur lg:col-span-4">
            <CardHeader>
              <CardTitle>Top projets du trimestre</CardTitle>
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
                  {topProjects.map((project) => {
                    const marginValue = project.revenue * project.margin;
                    return (
                      <TableRow key={project.name} className="hover:bg-muted/40">
                        <TableCell className="font-medium">
                          <span className="mr-2 text-lg" aria-hidden>
                            {getProjectEmoji(project)}
                          </span>
                          {project.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(project.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {formatCurrency(marginValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(project.margin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {project.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                    <div
                      className={`rounded-full p-2 ${
                        alert.type === "negative"
                          ? "bg-red-500/10 text-red-600"
                          : alert.type === "warning"
                            ? "bg-orange-500/10 text-orange-600"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {alert.description}
                      </p>
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
