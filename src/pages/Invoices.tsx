import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { AddInvoiceDialog } from "@/components/invoices/AddInvoiceDialog";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

import {
  Search,
  Filter,
  PlusCircle,
  FileDown,
  FileSpreadsheet,
  Timer,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Loader2,
  TrendingUp,
  Send,
} from "lucide-react";

/** ---- Status & Types ---- */
const INVOICE_STATUSES = [
  "PENDING_VALIDATION",
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type InvoiceRecord = Tables<"invoices"> & {
  quotes: Pick<Tables<"quotes">, "quote_ref"> | null;
  projects: Pick<Tables<"projects">, "project_ref" | "client_name"> | null;
};

const statusMeta: Record<InvoiceStatus, { label: string; className: string }> = {
  PENDING_VALIDATION: {
    label: "En attente de validation",
    className: "bg-amber-500/10 text-amber-700 border-amber-200",
  },
  DRAFT: {
    label: "Brouillon",
    className: "bg-gray-500/10 text-gray-700 border-gray-200",
  },
  SENT: {
    label: "Envoyée",
    className: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  PAID: {
    label: "Payée",
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  OVERDUE: {
    label: "En retard",
    className: "bg-red-500/10 text-red-700 border-red-200",
  },
  CANCELLED: {
    label: "Annulée",
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
const fetchInvoices = async (): Promise<InvoiceRecord[]> => {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, quotes(quote_ref), projects(project_ref, client_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invoices", error);
    throw error;
  }

  return (data ?? []) as InvoiceRecord[];
};

const Invoices = () => {
  const { session } = useAuth();
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const {
    data: invoices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const handleDownloadPdf = async (invoiceId: string, invoiceRef: string) => {
    try {
      setGeneratingPdf(invoiceId);

      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erreur lors de la génération du PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Facture-${invoiceRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("PDF téléchargé avec succès");
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la génération du PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const metrics = useMemo(() => {
    const totalPaid = invoices
      .filter((invoice) => invoice.status === "PAID")
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

    const outstanding = invoices
      .filter((invoice) =>
        ["SENT", "OVERDUE"].includes((invoice.status || "").toUpperCase()),
      )
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

    const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE");
    const draft = invoices.filter((invoice) =>
      ["DRAFT", "PENDING_VALIDATION"].includes((invoice.status || "").toUpperCase()),
    );
    const paidCount = invoices.filter((invoice) => invoice.status === "PAID");

    const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const collectionRate = totalBilled ? Math.round((totalPaid / totalBilled) * 100) : 0;

    return {
      totalPaid,
      outstanding,
      overdueCount: overdue.length,
      draftCount: draft.length,
      collectionRate,
      totalBilled,
    };
  }, [invoices]);

  const renderStatus = (status: string) => {
    const normalized = (status?.toUpperCase() as InvoiceStatus) || "PENDING_VALIDATION";
    const meta = statusMeta[normalized] ?? statusMeta.PENDING_VALIDATION;
    return <Badge className={meta.className}>{meta.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Factures
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi des encaissements et conformité Factur-X avec données Supabase
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importer Factur-X
            </Button>
            <Button variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <Button variant="outline">
              <Send className="w-4 h-4 mr-2" />
              Relance email
            </Button>
            <AddInvoiceDialog onInvoiceAdded={async () => { await refetch(); }} />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total facturé</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(metrics.totalBilled)}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Encaissements</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              {formatCurrency(metrics.totalPaid)}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>En attente</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-500" />
              {formatCurrency(metrics.outstanding)}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Taux d'encaissement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                {metrics.collectionRate}%
              </div>
              <div className="mt-2">
                <Progress value={metrics.collectionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="client" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="client">Facture Client</TabsTrigger>
            <TabsTrigger value="delegataire">Facture Délégataire</TabsTrigger>
            <TabsTrigger value="subcontractor">Facture Sous-traitant</TabsTrigger>
            <TabsTrigger value="supplier">Facture Fournisseur</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-6">
            {/* Search / Filters */}
            <Card className="shadow-card bg-gradient-card border-0">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par client, référence, devis ou chantier"
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtres avancés
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error state */}
            {isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Impossible de charger les factures</AlertTitle>
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

            {/* Table */}
            <Card className="shadow-card bg-gradient-card border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Factures Client ({invoices.length})</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Dernière mise à jour {formatDate(new Date().toISOString())}
                  </p>
                </div>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent>
                {invoices.length === 0 && !isLoading ? (
                  <div className="text-center py-12">
                    <Timer className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-4 text-muted-foreground">
                      Aucune facture enregistrée. Créez votre première facture ou synchronisez vos devis acceptés.
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
                          <TableHead>Devis associé</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Échéance</TableHead>
                          <TableHead>Paiement</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_ref}</TableCell>
                            <TableCell>{invoice.client_name}</TableCell>
                            <TableCell>{invoice.projects?.project_ref ?? "—"}</TableCell>
                            <TableCell>{invoice.quotes?.quote_ref ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(invoice.amount || 0))}
                            </TableCell>
                            <TableCell>
                              {renderStatus(invoice.status || "PENDING_VALIDATION")}
                            </TableCell>
                            <TableCell>{formatDate(invoice.due_date)}</TableCell>
                            <TableCell>{formatDate(invoice.paid_date)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_ref)}
                                disabled={generatingPdf === invoice.id}
                              >
                                {generatingPdf === invoice.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Génération...
                                  </>
                                ) : (
                                  <>
                                    <FileDown className="w-4 h-4 mr-2" />
                                    PDF
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Design preview */}
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Aperçu Facture (gabarit)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Modèle visuel de référence pour la génération PDF.
                </p>
              </CardHeader>
              <CardContent className="bg-slate-100">
                <InvoicePreview />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delegataire" className="space-y-6">
            <Card className="shadow-card bg-gradient-card border-0">
              <CardContent className="py-12">
                <div className="text-center">
                  <Timer className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 text-muted-foreground">
                    Gestion des factures délégataires à venir.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subcontractor" className="space-y-6">
            <Card className="shadow-card bg-gradient-card border-0">
              <CardContent className="py-12">
                <div className="text-center">
                  <Timer className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 text-muted-foreground">
                    Gestion des factures sous-traitants à venir.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supplier" className="space-y-6">
            <Card className="shadow-card bg-gradient-card border-0">
              <CardContent className="py-12">
                <div className="text-center">
                  <Timer className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 text-muted-foreground">
                    Gestion des factures fournisseurs à venir.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Invoices;
