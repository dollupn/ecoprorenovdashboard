import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/integrations/supabase/types";

const VAT_RATE = 0.2;

export interface AccountingMetrics {
  billedRevenue: number;
  vatCollected: number;
  outstandingBalance: number;
  cashReceived: number;
}

const defaultMetrics: AccountingMetrics = {
  billedRevenue: 0,
  vatCollected: 0,
  outstandingBalance: 0,
  cashReceived: 0,
};

const getMonthBounds = (referenceDate: Date) => {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

export const fetchAccountingMetrics = async (
  client: SupabaseClient<Database>,
  orgId: string | null | undefined,
  referenceDate: Date = new Date(),
): Promise<AccountingMetrics> => {
  if (!orgId) {
    return defaultMetrics;
  }

  const { start, end, startIso, endIso } = getMonthBounds(referenceDate);

  const { data, error } = await client
    .from("invoices")
    .select("amount, status, paid_date, created_at")
    .eq("org_id", orgId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) {
    console.error("Failed to fetch accounting metrics", error);
    throw error;
  }

  const invoices = (data ?? []) as Pick<
    Tables<"invoices">,
    "amount" | "status" | "paid_date" | "created_at"
  >[];

  const billedRevenue = invoices.reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0);

  const vatCollected = invoices.reduce((total, invoice) => {
    const amount = Number(invoice.amount ?? 0);
    return total + amount * (VAT_RATE / (1 + VAT_RATE));
  }, 0);

  const outstandingBalance = invoices
    .filter((invoice) => {
      const status = (invoice.status ?? "").toUpperCase();
      return status && !["PAID", "CANCELLED"].includes(status);
    })
    .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0);

  const cashReceived = invoices
    .filter((invoice) => {
      if (!invoice.paid_date) return false;
      const status = (invoice.status ?? "").toUpperCase();
      if (status !== "PAID") return false;

      const paidDate = new Date(invoice.paid_date);
      return paidDate >= start && paidDate < end;
    })
    .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0);

  return {
    billedRevenue,
    vatCollected,
    outstandingBalance,
    cashReceived,
  };
};
