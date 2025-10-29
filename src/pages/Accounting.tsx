import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import {
  Calculator,
  TrendingUp,
  Receipt,
  FileText,
  RefreshCw,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";

type InvoiceRecord = Tables<"invoices"> & {
  quotes: Pick<Tables<"quotes">, "quote_ref"> | null;
  projects: Pick<Tables<"projects">, "project_ref" | "client_name"> | null;
};

type AccountingInvoice = InvoiceRecord & {
  category: "TO_COLLECT" | "OVERDUE" | "PAID";
  daysLate: number;
  agingBucket: AgingBucket;
};

type AgingBucket = "0-30" | "31-60" | "61-90" | "91+";

type StatusFilter = "ALL" | "TO_COLLECT" | "OVERDUE" | "PAID";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

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
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching accounting invoices", error);
    throw error;
  }

  return (data ?? []) as InvoiceRecord[];
};

const getDaysLate = (dueDate: string | null, paidDate: string | null) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const reference = paidDate ? new Date(paidDate) : new Date();
  const diff = Math.floor((reference.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

const getAgingBucket = (daysLate: number): AgingBucket => {
  if (daysLate <= 30) return "0-30";
  if (daysLate <= 60) return "31-60";
  if (daysLate <= 90) return "61-90";
  return "91+";
};

const Accounting = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

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

  const processedInvoices = useMemo<AccountingInvoice[]>(() => {
    const now = new Date();

    return invoices.map((invoice) => {
      const normalizedStatus = (invoice.status || "").toUpperCase();
      const isPaid = normalizedStatus === "PAID" || Boolean(invoice.paid_date);
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
      const isOverdue =
        !isPaid &&
        ((normalizedStatus === "OVERDUE" && Boolean(dueDate)) ||
          (dueDate ? dueDate.getTime() < now.getTime() : false));

      const category: AccountingInvoice["category"] = isPaid
        ? "PAID"
        : isOverdue
        ? "OVERDUE"
        : "TO_COLLECT";

      const daysLate = getDaysLate(invoice.due_date, invoice.paid_date);
      const agingBucket = getAgingBucket(daysLate);

      return {
        ...invoice,
        category,
        daysLate,
        agingBucket,
      };
    });
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const loweredSearch = searchTerm.trim().toLowerCase();

    return processedInvoices.filter((invoice) => {
      const matchesSearch = loweredSearch
        ? [
            invoice.invoice_ref,
            invoice.client_name,
            invoice.projects?.project_ref,
            invoice.quotes?.quote_ref,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(loweredSearch))
        : true;

      const matchesStatus =
        statusFilter === "ALL" ? true : invoice.category === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [processedInvoices, searchTerm, statusFilter]);

  const bucketedInvoices = useMemo(() => {
    return {
      toCollect: filteredInvoices.filter((invoice) => invoice.category === "TO_COLLECT"),
      overdue: filteredInvoices.filter((invoice) => invoice.category === "OVERDUE"),
      paid: filteredInvoices.filter((invoice) => invoice.category === "PAID"),
    };
  }, [filteredInvoices]);

  const aggregates = useMemo(() => {
    const agingDistribution: Record<AgingBucket, number> = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "91+": 0,
    };

    let totalBilled = 0;
    let outstanding = 0;
    let overdueAmount = 0;
    let paidAmount = 0;

    processedInvoices.forEach((invoice) => {
      const amount = Number(invoice.amount || 0);
      totalBilled += amount;

      if (invoice.category === "PAID") {
        paidAmount += amount;
      } else {
        outstanding += amount;
        if (invoice.category === "OVERDUE") {
          overdueAmount += amount;
        }
        agingDistribution[invoice.agingBucket] += amount;
      }
    });

    return {
      totalBilled,
      outstanding,
      overdueAmount,
      paidAmount,
      agingDistribution,
    };
  }, [processedInvoices]);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    await refetch();
  };

  const renderStatus = (status: AccountingInvoice["category"]) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-500/10 text-green-700 border-green-200">Payée</Badge>;
      case "OVERDUE":
        return <Badge className="bg-red-500/10 text-red-700 border-red-200">En retard</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">À encaisser</Badge>;
    }
  };

  const renderAgingBadge = (bucket: AgingBucket) => {
    const colors: Record<AgingBucket, string> = {
      "0-30": "bg-emerald-500/10 text-emerald-700 border-emerald-200",
      "31-60": "bg-amber-500/10 text-amber-700 border-amber-200",
      "61-90": "bg-orange-500/10 text-orange-700 border-orange-200",
      "91+": "bg-red-500/10 text-red-700 border-red-200",
    };

    return <Badge className={colors[bucket]}>{bucket} jours</Badge>;
  };

  const renderTable = (data: AccountingInvoice[]) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Chargement des factures…
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          <Clock className="mx-auto mb-4 h-10 w-10 opacity-60" />
          Aucune facture à afficher pour le moment.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Date de paiement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Jours de retard</TableHead>
              <TableHead>Tranche</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoice_ref}</TableCell>
                <TableCell>{invoice.client_name}</TableCell>
                <TableCell>{invoice.projects?.project_ref ?? "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(invoice.amount || 0))}</TableCell>
                <TableCell>{formatDate(invoice.due_date)}</TableCell>
                <TableCell>{formatDate(invoice.paid_date)}</TableCell>
                <TableCell>{renderStatus(invoice.category)}</TableCell>
                <TableCell>{invoice.daysLate}</TableCell>
                <TableCell>{renderAgingBadge(invoice.agingBucket)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
            <p className="text-muted-foreground">
              Vision consolidée des flux de facturation et priorisation des relances
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Input
                  placeholder="Rechercher par client, référence ou chantier"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-3"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="TO_COLLECT">À encaisser</SelectItem>
                  <SelectItem value="OVERDUE">En retard</SelectItem>
                  <SelectItem value="PAID">Payées</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setSearchTerm("")}>Réinitialiser</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total facturé</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(aggregates.totalBilled)}</div>
              <p className="text-xs text-muted-foreground">Toutes factures confondues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">À encaisser</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(aggregates.outstanding - aggregates.overdueAmount)}
              </div>
              <p className="text-xs text-muted-foreground">Factures non payées hors retard</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En retard</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(aggregates.overdueAmount)}</div>
              <p className="text-xs text-muted-foreground">Montant total à relancer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Déjà encaissé</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(aggregates.paidAmount)}</div>
              <p className="text-xs text-muted-foreground">Paiements enregistrés</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Répartition des retards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {(["0-30", "31-60", "61-90", "91+"] as AgingBucket[]).map((bucket) => (
                <div key={bucket} className="rounded-lg border bg-muted/10 p-4">
                  <p className="text-sm text-muted-foreground">Retards {bucket} jours</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(aggregates.agingDistribution[bucket])}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Impossible de charger les données comptables</AlertTitle>
            <AlertDescription>
              {error?.message || "Vérifiez votre connexion à Supabase puis réessayez."}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="toCollect" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="toCollect">À encaisser ({bucketedInvoices.toCollect.length})</TabsTrigger>
            <TabsTrigger value="overdue">En retard ({bucketedInvoices.overdue.length})</TabsTrigger>
            <TabsTrigger value="paid">Payées ({bucketedInvoices.paid.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="toCollect">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Factures à encaisser</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Factures envoyées ou à échéance prochaine
                  </p>
                </div>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent>{renderTable(bucketedInvoices.toCollect)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overdue">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Factures en retard</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Priorisez vos actions de relance par tranche d'ancienneté
                  </p>
                </div>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent>{renderTable(bucketedInvoices.overdue)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Factures payées</CardTitle>
                  <p className="text-sm text-muted-foreground">Historique des encaissements enregistrés</p>
                </div>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent>{renderTable(bucketedInvoices.paid)}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Accounting;
