import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

import type { InvoicePdfDTO } from "./types/invoice-pdf.js";
import { fetchInvoicePdfDto } from "./repositories/invoicePdfRepository.js";
import { InvoicePdfConfigurationError } from "./errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.resolve(__dirname, "../../templates/invoice.html.ejs");

interface InvoiceItemViewModel {
  code: string;
  title: string;
  long_description_html: string | null;
  unit_price: string;
  quantity: string;
  amount: string;
}

interface InvoicePdfViewModel {
  invoice: {
    number: string;
    city: string;
    date: string;
    due_date: string;
  };
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
  items: InvoiceItemViewModel[];
  totals: {
    total_ht: string;
    vat_rate_label: string;
    vat_amount: string;
    total_ttc: string;
    discount_amount: string;
    cee_prime_amount: string;
    net_to_pay: string;
  };
  notes: {
    cee_prime?: string;
    payment_terms?: string;
    consultation_link?: string;
  };
}

const bankRound = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const toPercentageLabel = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

const convertMultilineTextToHtml = (text?: string | null): string | null => {
  if (!text) return null;
  return text.replace(/\n/g, "<br>");
};

export class InvoicesPdfService {
  private templatePath: string;

  constructor(templatePath?: string) {
    this.templatePath = templatePath ?? TEMPLATE_PATH;
  }

  private createViewModel(dto: InvoicePdfDTO): InvoicePdfViewModel {
    // Calculate item amounts
    const itemsWithAmount = dto.items.map((item) => ({
      ...item,
      amount_ht: bankRound(item.unit_price_ht * item.quantity),
    }));

    // Calculate totals
    const linesTotal = itemsWithAmount.reduce((sum, item) => sum + item.amount_ht, 0);
    const totalHt = bankRound(linesTotal + dto.amounts.discount_amount);
    const vatAmount = bankRound(totalHt * dto.amounts.vat_rate);
    const totalTtc = bankRound(totalHt + vatAmount);
    const netToPay = bankRound(totalTtc + dto.amounts.cee_prime_amount);

    return {
      invoice: {
        number: dto.invoice_number,
        city: dto.invoice_date_city,
        date: formatDate(dto.invoice_date),
        due_date: formatDate(dto.due_date),
      },
      client: dto.client,
      company: dto.company,
      project: {
        ...dto.project,
        work_start_date: dto.project.work_start_date
          ? formatDate(dto.project.work_start_date)
          : null,
      },
      subcontractor: dto.subcontractor,
      items: itemsWithAmount.map((item) => ({
        code: item.code || "—",
        title: item.title,
        long_description_html: convertMultilineTextToHtml(item.long_description),
        unit_price: formatCurrency(item.unit_price_ht),
        quantity: formatNumber(item.quantity),
        amount: formatCurrency(item.amount_ht),
      })),
      totals: {
        total_ht: formatCurrency(totalHt),
        vat_rate_label: toPercentageLabel(dto.amounts.vat_rate),
        vat_amount: formatCurrency(vatAmount),
        total_ttc: formatCurrency(totalTtc),
        discount_amount: formatCurrency(dto.amounts.discount_amount),
        cee_prime_amount: formatCurrency(dto.amounts.cee_prime_amount),
        net_to_pay: formatCurrency(netToPay),
      },
      notes: {
        cee_prime: dto.notes?.cee_prime_text,
        payment_terms:
          dto.notes?.payment_terms || "Par prélèvement ou par virement bancaire",
        consultation_link: dto.notes?.consultation_link,
      },
    };
  }

  async renderInvoiceHtml(invoiceId: string): Promise<string> {
    const dto = await fetchInvoicePdfDto(invoiceId);
    return this.renderInvoiceHtmlFromDto(dto);
  }

  async renderInvoiceHtmlFromDto(dto: InvoicePdfDTO): Promise<string> {
    const viewModel = this.createViewModel(dto);
    return ejs.renderFile(this.templatePath, viewModel);
  }

  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    const dto = await fetchInvoicePdfDto(invoiceId);
    return this.generateInvoicePdfFromDto(dto);
  }

  async generateInvoicePdfFromDto(dto: InvoicePdfDTO): Promise<Buffer> {
    const html = await this.renderInvoiceHtmlFromDto(dto);
    return this.generatePdfFromHtml(html);
  }

  private async generatePdfFromHtml(html: string): Promise<Buffer> {
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      throw new InvoicePdfConfigurationError(
        `Échec de la génération du PDF: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const invoicesPdfService = new InvoicesPdfService();
