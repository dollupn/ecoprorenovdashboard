import type { QuotePdfDTO } from "../types/quote-pdf";

export const sampleQuotePdfDto: QuotePdfDTO = {
  quote_number: 122,
  quote_date_city: "Saint-Denis",
  quote_date: "2025-06-10T00:00:00.000Z",
  valid_until: "2025-07-10T00:00:00.000Z",
  scheduled_date: "2025-09-01T00:00:00.000Z",
  discount_amount: 0,
  cee_prime_amount: -10800.4,
  vat_rate: 0.085,
  notes: {
    prime_cee_text:
      "Prime CEE valorisée sur la base des volumes de certificats disponibles. Montant définitif communiqué après validation.",
    payment_terms: "Par prélèvement ou par virement bancaire à réception de chaque facture intermédiaire.",
  },
  client: {
    company_name: "SCEA FERME YANN",
    siret_or_siren: "8132635000033",
    address_line1: "136 COMMUNE AGG",
    address_line2: null,
    city_postcode: "97411 SAINTE SUZANNE",
    contact_name: "Jean-Michel DELORT",
    contact_role: "Propriétaire nom propre",
    phone: "06 92 00 00 00",
    email: "contact@fermeyann.re",
    tenant_note: null,
  },
  building: {
    type: "Existant",
    usage: "Exploitation agricole",
    surface_total_m2: 260,
    surface_operation_m2: 260,
  },
  company: {
    label: "ECOPRORENOVE",
    address1: "104C Avenue Raymond Vergès",
    postcode_city: "97400 Saint-Denis",
    phone: "09 70 34 64 23",
    legal_footer:
      "Ecoprorenove (EB.CONSEILS), SAS au capital de 1000 € – SIRET : 89497510900058 – RCS : Saint-Denis de La Réunion – APE : 7112B – TVA intracommunautaire : FR 90 894975109",
    bank_bic: "AGRIFRPP880",
    bank_iban: "FR76 3000 4012 3400 0100 6755 701",
  },
  items: [
    {
      code: "BAT-EN-109",
      title: "Mise en place d’un système de toiture conforme à la BAT-EN-109",
      long_description:
        "Fourniture et pose d'un système de toiture conforme aux normes en vigueur.\nFourniture de tous les accessoires nécessaires.",
      unit_price_ht: 19.14,
      quantity: 260,
    },
    {
      code: "BAT-EN-106",
      title: "Isolation thermique complémentaire",
      long_description:
        "Installation d'une isolation thermique de toiture répondant aux exigences de la BAT-EN-106.",
      unit_price_ht: 18.15,
      quantity: 260,
    },
  ],
};
