import { QuoteMetadata, QuoteRecord } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseQuoteMetadata = (quote: Pick<QuoteRecord, "notes">): QuoteMetadata => {
  const rawNotes = quote.notes;

  if (!rawNotes) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawNotes);

    if (!isObject(parsed)) {
      return { internalNotes: String(rawNotes) };
    }

    const metadata: QuoteMetadata = {};

    if (typeof parsed.clientEmail === "string" && parsed.clientEmail.trim()) {
      metadata.clientEmail = parsed.clientEmail.trim();
    }

    if (typeof parsed.clientPhone === "string" && parsed.clientPhone.trim()) {
      metadata.clientPhone = parsed.clientPhone.trim();
    }

    if (typeof parsed.siteAddress === "string" && parsed.siteAddress.trim()) {
      metadata.siteAddress = parsed.siteAddress.trim();
    }

    if (typeof parsed.paymentTerms === "string" && parsed.paymentTerms.trim()) {
      metadata.paymentTerms = parsed.paymentTerms.trim();
    }

    if (typeof parsed.driveFolderUrl === "string" && parsed.driveFolderUrl.trim()) {
      metadata.driveFolderUrl = parsed.driveFolderUrl.trim();
    }

    if (typeof parsed.emailMessage === "string" && parsed.emailMessage.trim()) {
      metadata.emailMessage = parsed.emailMessage;
    }

    if (typeof parsed.internalNotes === "string" && parsed.internalNotes.trim()) {
      metadata.internalNotes = parsed.internalNotes;
    }

    if (Array.isArray(parsed.lineItems)) {
      metadata.lineItems = parsed.lineItems
        .filter((item) => isObject(item))
        .map((item) => {
          const description = typeof item.description === "string" ? item.description : "";
          const reference = typeof item.reference === "string" ? item.reference : undefined;
          const quantity = Number(item.quantity ?? 0) || 0;
          const unitPrice = Number(item.unitPrice ?? 0) || 0;
          const taxRate =
            item.taxRate === null || item.taxRate === undefined
              ? undefined
              : Number(item.taxRate);

          return {
            description,
            reference,
            quantity,
            unitPrice,
            taxRate: Number.isFinite(taxRate as number) ? (taxRate as number) : undefined,
          };
        })
        .filter((item) => item.description || item.reference);
    }

    return metadata;
  } catch (error) {
    console.warn("Unable to parse quote metadata", error);
    return { internalNotes: String(rawNotes) };
  }
};

export const formatQuoteCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);

export const computeLineItemsTotal = (lineItems: QuoteMetadata["lineItems"] = []) =>
  lineItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
