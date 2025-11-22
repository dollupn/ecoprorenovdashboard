import type { Tables } from "@/integrations/supabase/types";
import type { ProductCeeConfig } from "@/lib/prime-cee-unified";

type QuoteProjectProduct = {
  product: (Pick<Tables<"product_catalog">, "code" | "cee_config"> & {
    cee_config: ProductCeeConfig;
    kwh_cumac_values?: Tables<"product_kwh_cumac">[];
  }) | null;
};

type QuoteProject = Pick<
  Tables<"projects">,
  "project_ref" | "client_name" | "client_first_name" | "client_last_name" | "product_name"
> & {
  project_products?: QuoteProjectProduct[];
};

export type QuoteRecord = Tables<"quotes"> & {
  projects: QuoteProject | null;
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
  clientSiren?: string;
  siteAddress?: string;
  siteCity?: string;
  sitePostalCode?: string;
  paymentTerms?: string;
  driveFolderUrl?: string;
  driveFileUrl?: string;
  driveFileId?: string;
  driveFileName?: string;
  emailMessage?: string;
  internalNotes?: string;
  lineItems?: QuoteLineItem[];
}
