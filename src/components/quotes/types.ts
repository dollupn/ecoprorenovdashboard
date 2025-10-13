import type { Tables } from "@/integrations/supabase/types";

export type QuoteRecord = Tables<"quotes"> & {
  projects: Pick<Tables<"projects">, "project_ref" | "client_name" | "product_name"> | null;
};

export interface QuoteLineItem {
  reference?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number | null;
}

export interface QuoteMetadata {
  clientEmail?: string;
  clientPhone?: string;
  siteAddress?: string;
  paymentTerms?: string;
  driveFolderUrl?: string;
  emailMessage?: string;
  internalNotes?: string;
  lineItems?: QuoteLineItem[];
}
