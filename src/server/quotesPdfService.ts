import path from "node:path";
import ejs from "ejs";
import puppeteer from "puppeteer";

import { fetchQuotePdfDto } from "./repositories/quotePdfRepository";
import type { QuotePdfDTO } from "./types/quote-pdf";
import { bankRound, formatCurrency, formatDate, formatNumber, toPercentageLabel } from "./utils/intl";
import { convertMultilineTextToHtml } from "./utils/text";

interface QuotePdfViewModel {
  quote: {
    number: number;
    city: string;
    date: string;
    valid_until: string;
    scheduled_date: string;
  };
  client: QuotePdfDTO["client"];
  company: QuotePdfDTO["company"];
  building: {
    type: string;
    usage: string;
    surface_total: string;
    surface_operation: string;
  };
  items: Array<{
    code: string;
    title: string;
    long_description_html: string | null;
    unit_price: string;
    quantity: string;
    amount: string;
  }>;
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
    prime_cee: string;
    payment_terms: string;
  };
}

const TEMPLATE_PATH = path.resolve(process.cwd(), "templates/quote.html.ejs");

const formatSurface = (value: number) => formatNumber(value, Number.isInteger(value) ? 0 : 2);

export class QuotesPdfService {
  constructor(private readonly templatePath: string = TEMPLATE_PATH) {}

  private createViewModel(dto: QuotePdfDTO): QuotePdfViewModel {
    const itemsWithAmount = dto.items.map((item) => ({
      ...item,
      amount_ht: bankRound(item.unit_price_ht * item.quantity),
    }));

    const linesTotal = itemsWithAmount.reduce((total, item) => total + item.amount_ht, 0);
    const totalHt = bankRound(linesTotal + dto.discount_amount);
    const vatAmount = bankRound(totalHt * dto.vat_rate);
    const totalTtc = bankRound(totalHt + vatAmount);
    const netToPay = bankRound(totalTtc + dto.cee_prime_amount);

    return {
      quote: {
        number: dto.quote_number,
        city: dto.quote_date_city,
        date: formatDate(dto.quote_date),
        valid_until: formatDate(dto.valid_until),
        scheduled_date: formatDate(dto.scheduled_date, "—"),
      },
      client: dto.client,
      company: dto.company,
      building: {
        type: dto.building.type,
        usage: dto.building.usage,
        surface_total: formatSurface(dto.building.surface_total_m2),
        surface_operation: formatSurface(dto.building.surface_operation_m2),
      },
      items: itemsWithAmount.map((item) => ({
        code: item.code ? String(item.code) : "—",
        title: item.title,
        long_description_html: convertMultilineTextToHtml(item.long_description),
        unit_price: formatCurrency(item.unit_price_ht),
        quantity: formatNumber(item.quantity, Number.isInteger(item.quantity) ? 0 : 2),
        amount: formatCurrency(item.amount_ht),
      })),
      totals: {
        total_ht: formatCurrency(totalHt),
        vat_rate_label: toPercentageLabel(dto.vat_rate, 1),
        vat_amount: formatCurrency(vatAmount),
        total_ttc: formatCurrency(totalTtc),
        discount_amount: formatCurrency(dto.discount_amount),
        cee_prime_amount: formatCurrency(dto.cee_prime_amount),
        net_to_pay: formatCurrency(netToPay),
      },
      notes: {
        prime_cee:
          dto.notes?.prime_cee_text ??
          "Le montant de la prime CEE est soumis à validation définitive des certificats d'économie d'énergie.",
        payment_terms:
          dto.notes?.payment_terms ?? "Par prélèvement ou par virement bancaire à réception de facture.",
      },
    };
  }

  async renderQuoteHtml(quoteId: string): Promise<string> {
    const dto = await fetchQuotePdfDto(quoteId);
    return this.renderQuoteHtmlFromDto(dto);
  }

  async renderQuoteHtmlFromDto(dto: QuotePdfDTO): Promise<string> {
    const viewModel = this.createViewModel(dto);
    return ejs.renderFile(this.templatePath, viewModel, { async: true });
  }

  async generateQuotePdf(quoteId: string): Promise<Buffer> {
    const dto = await fetchQuotePdfDto(quoteId);
    return this.generateQuotePdfFromDto(dto);
  }

  async generateQuotePdfFromDto(dto: QuotePdfDTO): Promise<Buffer> {
    const html = await this.renderQuoteHtmlFromDto(dto);
    return this.generatePdfFromHtml(html);
  }

  private async generatePdfFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--font-render-hinting=none", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0mm",
          bottom: "0mm",
          left: "0mm",
          right: "0mm",
        },
      });

      await page.close();
      return buffer;
    } finally {
      await browser.close();
    }
  }
}

export const quotesPdfService = new QuotesPdfService();
