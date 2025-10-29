import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, TrendingUp, Receipt, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { fetchAccountingMetrics } from "@/features/accounting/metrics";

const EMPTY_METRICS = {
  billedRevenue: 0,
  vatCollected: 0,
  outstandingBalance: 0,
  cashReceived: 0,
};

const Accounting = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const {
    data: metrics,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["invoices", currentOrgId, "accounting-metrics"],
    queryFn: () => fetchAccountingMetrics(supabase, currentOrgId ?? null),
    enabled: Boolean(user && currentOrgId),
    staleTime: 1000 * 60 * 5,
  });

  const resolvedMetrics = metrics ?? EMPTY_METRICS;

  const renderMetric = (value?: number) => {
    if (isLoading) {
      return <div className="text-sm text-muted-foreground">Chargement...</div>;
    }

    if (isError) {
      const message = error instanceof Error ? error.message : "Une erreur est survenue";
      return <div className="text-sm text-destructive">{message}</div>;
    }

    const formattedValue = currencyFormatter.format(value ?? 0);
    return (
      <>
        <div className="text-2xl font-bold">
          {formattedValue}
        </div>
        <p className="text-xs text-muted-foreground">Ce mois</p>
      </>
    );
  };

  const outstandingContent = () => {
    if (isLoading) {
      return <div className="text-sm text-muted-foreground">Chargement...</div>;
    }

    if (isError) {
      const message = error instanceof Error ? error.message : "Une erreur est survenue";
      return <div className="text-sm text-destructive">{message}</div>;
    }

    return (
      <>
        <div className="text-2xl font-bold">{currencyFormatter.format(resolvedMetrics.outstandingBalance)}</div>
        <p className="text-xs text-muted-foreground">À suivre</p>
      </>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
            <p className="text-muted-foreground">
              Vision consolidée des flux de facturation
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total facturé</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{renderMetric(resolvedMetrics.billedRevenue)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">TVA collectée</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{renderMetric(resolvedMetrics.vatCollected)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solde impayé</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{outstandingContent()}</CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Encaissé ce mois</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Chargement...</div>
              ) : isError ? (
                <div className="text-sm text-destructive">
                  {error instanceof Error ? error.message : "Une erreur est survenue"}
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {currencyFormatter.format(resolvedMetrics.cashReceived)}
                  </div>
                  <p className="text-xs text-muted-foreground">Paiements du mois</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Accounting;
