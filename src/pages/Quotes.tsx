import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuotePreview } from "@/components/quotes/QuotePreview";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import {
  Search,
  Filter,
  PlusCircle,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  Timer,
  Send,
  Eye,
  AlertCircle,
  Loader2,
  UserPlus,
  FolderKanban,
  FileText,
  HardHat,
  PhoneCall,
  Receipt,
  ArrowRight,
} from "lucide-react";

/** ---- Status & Types ---- */
const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

type QuoteRecord = Tables<"quotes"> & {
  projects: Pick<Tables<"projects">, "project_ref" | "client_name" | "product_name"> | null;
};

const statusMeta: Record<QuoteStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Brouillon",
    className: "bg-gray-500/10 text-gray-700 border-gray-200",
  },
  SENT: {
    label: "Envoyé",
    className: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  ACCEPTED: {
    label: "Accepté",
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  REJECTED: {
    label: "Refusé",
    className: "bg-red-500/10 text-red-700 border-red-200",
  },
  EXPIRED: {
    label: "Expiré",
    className: "bg-orange-500/10 text-orange-700 border-orange-200",
  },
};

/** ---- Utils ---- */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
};

/** ---- Data ---- */
const fetchQuotes = async (): Promise<QuoteRecord[]> => {
  const { data, error } = await supabase
    .from("quotes")
    .select("*, projects(project_ref, client_name, product_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching quotes", error);
    throw error;
  }

  return (data ?? []) as QuoteRecord[];
};

const Quotes = () => {
  const processSteps = [
    {
      label: "Lead",
      description: "Qualification commerciale",
      icon: UserPlus,
    },
    {
      label: "Projet",
      description: "Structure et estimation",
      icon: FolderKanban,
    },
    {
      label: "Devis",
      description: "Validation offre client",
      icon: FileText,
    },
    {
      label: "Chantier",
      description: "Pilotage d'exécution",
      icon: HardHat,
    },
    {
      label: "Appel à facture",
      description: "Préparation facturation",
      icon: PhoneCall,
    },
    {
      label: "Facture",
      description: "Transformation du devis",
      icon: Receipt,
    },
  ];

  const {
    data: quotes = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["quotes"],
    queryFn: fetchQuotes,
  });

  const metrics = useMemo(() => {
    const totalAmount = quotes.reduce((total, quote) => total + Number(quote.amount || 0), 0);
    const accepted = quotes.filter((q) => q.status === "ACCEPTED");
    const sent = quotes.filter((q) => q.status === "SENT");
    const draft = quotes.filter((q) => q.status === "DRAFT");
    const rejected = quotes.filter((q) => q.status === "REJECTED");
    const expired = quotes.filter((q) => q.status === "EXPIRED");

    const upcomingExpiry = quotes.filter((q) => {
      if (!q.valid_until) return false;
      const validityDate = new Date(q.valid_until);
      const now = new Date();
      const diffInDays = Math.ceil((validityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffInDays >= 0 && diffInDays <= 7;
    });

    const conversionRate = quotes.length ? Math.round((accepted.length / quotes.length) * 100) : 0;

    return {
      totalAmount,
      accepted: accepted.length,
      sent: sent.length,
      draft: draft.length,
      rejected: rejected.length,
      expired: expired.length,
      upcomingExpiry: upcomingExpiry.length,
      conversionRate,
    };
  }, [quotes]);

  const renderStatus = (status: string) => {
    const normalized = (status?.toUpperCase() as QuoteStatus) || "DRAFT";
    const meta = statusMeta[normalized] ?? statusMeta.DRAFT;
    return <Badge className={meta.className}>{meta.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Devis
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi des propositions commerciales avec données Supabase en temps réel
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importer CSV
            </Button>
            <Button variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Nouveau Devis
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Total pipeline</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(metrics.totalAmount)}
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Taux de conversion</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-semibold">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              {metrics.conversionRate}%
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Devis envoyés</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              {metrics.sent}
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Expiration prochaine</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <Timer className="w-5 h-5 text-orange-500" />
              {metrics.upcomingExpiry}
            </CardContent>
          </Card>
        </div>

        {/* Search / Filters */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher par client, référence, projet ou solution" className="pl-10" />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres avancés
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader>
            <CardTitle>Parcours opérationnel</CardTitle>
            <p className="text-sm text-muted-foreground">
              Le devis s'inscrit dans la chaîne Lead → Projet → Devis → Chantier → Appel à Facture → Facture.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-stretch">
              {processSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="flex items-center gap-3 rounded-lg border bg-background/60 px-4 py-3 shadow-sm">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    {index < processSteps.length - 1 && (
                      <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Impossible de charger les devis</AlertTitle>
            <AlertDescription>
              {error?.message || "Vérifiez votre connexion Supabase puis réessayez."}
            </AlertDescription>
            <div className="mt-4">
              <Button variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          </Alert>
        )}

        {/* Table + Side actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="shadow-card bg-gradient-card border-0 xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Devis ({quotes.length})</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dernière mise à jour {formatDate(new Date().toISOString())}
                </p>
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              {quotes.length === 0 && !isLoading ? (
                <div className="text-center py-12">
                  <Eye className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 text-muted-foreground">
                    Aucun devis n'est encore enregistré dans Supabase. Créez votre premier devis pour suivre votre pipeline.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Projet</TableHead>
                        <TableHead>Solution</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Validité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell className="font-medium">{quote.quote_ref}</TableCell>
                          <TableCell>{quote.client_name}</TableCell>
                          <TableCell>{quote.projects?.project_ref ?? "—"}</TableCell>
                          <TableCell>{(quote as any).product_name ?? quote.projects?.product_name ?? "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(quote.amount || 0))}</TableCell>
                          <TableCell>{renderStatus(quote.status || "DRAFT")}</TableCell>
                          <TableCell>{formatDate(quote.valid_until)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader>
              <CardTitle>Prochaines actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <Send className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <p className="font-medium">Relancer les devis envoyés</p>
                  <p className="text-sm text-muted-foreground">
                    {metrics.sent} devis en attente de réponse
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <p className="font-medium">Convertir en facture</p>
                  <p className="text-sm text-muted-foreground">
                    {metrics.accepted} devis acceptés prêts à être transformés
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <Timer className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="font-medium">Expiration prochaine (≤ 7 jours)</p>
                  <p className="text-sm text-muted-foreground">
                    {metrics.upcomingExpiry} devis à vérifier
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Aperçu Devis (gabarit)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Modèle visuel aligné sur le gabarit facture pour générer les PDF et assurer la continuité commerciale.
            </p>
          </CardHeader>
          <CardContent className="bg-slate-100">
            <QuotePreview />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Quotes;
