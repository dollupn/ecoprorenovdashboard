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
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
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
} from "lucide-react";

const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;

type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type InvoiceRecord = Tables<"invoices"> & {
  quotes: Pick<Tables<"quotes">, "quote_ref"> | null;
  projects: Pick<Tables<"projects">, "project_ref" | "client_name"> | null;
};

const statusMeta: Record<InvoiceStatus, { label: string; className: string }> = {
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

  const metrics = useMemo(() => {
    const totalPaid = invoices
      .filter((invoice) => invoice.status === "PAID")
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    const outstanding = invoices
      .filter((invoice) => ["SENT", "OVERDUE"].includes(invoice.status))
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE");
    const draft = invoices.filter((invoice) => invoice.status === "DRAFT");
    const paidCount = invoices.filter((invoice) => invoice.status === "PAID");

    const collectionRate = invoices.length
      ? Math.round((paidCount.length / invoices.length) * 100)
      : 0;

    return {
      totalPaid,
      outstanding,
      overdueCount: overdue.length,
      draftCount: draft.length,
      collectionRate,
    };
  }, [invoices]);

  const renderStatus = (status: string) => {
    const normalizedStatus = (status?.toUpperCase() as InvoiceStatus) || "DRAFT";
    const meta = statusMeta[normalizedStatus];

    if (!meta) {
      return <Badge className={statusMeta.DRAFT.className}>{status}</Badge>;
    }

    return <Badge className={meta.className}>{meta.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
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
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Nouvelle Facture
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <CardTitle>En retard</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-red-500" />
              {metrics.overdueCount}
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Taux d'encaissement</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              {metrics.collectionRate}%
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher par client, référence, devis..." className="pl-10" />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
            </div>
          </CardContent>
        </Card>

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

        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Factures ({invoices.length})</CardTitle>
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
                  Aucune facture n'est encore enregistrée. Créez votre première facture ou synchronisez vos devis acceptés.
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_ref}</TableCell>
                        <TableCell>{invoice.client_name}</TableCell>
                        <TableCell>{invoice.projects?.project_ref ?? "—"}</TableCell>
                        <TableCell>{invoice.quotes?.quote_ref ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(invoice.amount))}</TableCell>
                        <TableCell>{renderStatus(invoice.status)}</TableCell>
                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                        <TableCell>{formatDate(invoice.paid_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Invoices;
