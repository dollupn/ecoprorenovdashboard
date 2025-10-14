export type QuotePdfItem = {
  code?: string | null;
  title: string;
  long_description?: string | null;
  unit_price_ht: number;
  quantity: number;
};

export type QuotePdfDTO = {
  quote_number: number;
  quote_date_city: string;
  quote_date: string;
  valid_until: string;
  scheduled_date?: string | null;
  discount_amount: number;
  cee_prime_amount: number;
  vat_rate: number;
  notes?: {
    prime_cee_text?: string;
    payment_terms?: string;
  } | null;
  client: {
    company_name: string;
    siret_or_siren: string;
    address_line1: string;
    address_line2?: string | null;
    city_postcode: string;
    contact_name?: string | null;
    contact_role?: string | null;
    phone?: string | null;
    email?: string | null;
    tenant_note?: string | null;
  };
  building: {
    type: string;
    usage: string;
    surface_total_m2: number;
    surface_operation_m2: number;
  };
  company: {
    label: string;
    address1: string;
    postcode_city: string;
    phone: string;
    legal_footer: string;
    bank_bic: string;
    bank_iban: string;
  };
  items: QuotePdfItem[];
};
