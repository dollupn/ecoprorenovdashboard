export type InvoicePdfItem = {
  code?: string | null;
  title: string;
  long_description?: string | null;
  unit_price_ht: number;
  quantity: number;
};

export type InvoicePdfDTO = {
  invoice_number: string;
  invoice_date_city: string;
  invoice_date: string;
  due_date: string;
  
  client: {
    company_name: string;
    contact_name?: string | null;
    contact_role?: string | null;
    address_line1: string;
    address_line2?: string | null;
    city_postcode: string;
    phone?: string | null;
    email?: string | null;
    siret?: string | null;
  };
  
  project: {
    ref: string;
    site_ref?: string | null;
    work_start_date?: string | null;
    surface_m2?: number | null;
    building_type?: string | null;
    building_usage?: string | null;
  };
  
  subcontractor?: {
    name: string;
    siret: string;
    insurance_policy?: string | null;
    qualifications?: string | null;
  } | null;
  
  company: {
    label: string;
    address1: string;
    address2?: string | null;
    postcode_city: string;
    phone: string;
    email: string;
    website?: string | null;
    legal_footer: string;
    siret: string;
    tva_intracommunautaire: string;
    bank_bic: string;
    bank_iban: string;
    bank_name?: string | null;
  };
  
  items: InvoicePdfItem[];
  
  amounts: {
    discount_amount: number;
    cee_prime_amount: number;
    vat_rate: number;
  };
  
  notes?: {
    cee_prime_text?: string;
    payment_terms?: string;
    consultation_link?: string;
  } | null;
};
