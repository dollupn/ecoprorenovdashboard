import type { Request, Response } from "express";
import { Router } from "express";

import { invoicesPdfService } from "../invoicesPdfService.js";
import {
  InvoicePdfConfigurationError,
  InvoicePdfNotFoundError,
  InvoicePdfValidationError,
} from "../errors.js";
import { ensureAuthenticated } from "./authentication.js";

const router = Router();

router.get("/:id/pdf", ensureAuthenticated, async (req, res) => {
  const invoiceId = req.params.id;

  if (!invoiceId) {
    return res.status(400).json({ message: "Identifiant de facture manquant" });
  }

  try {
    const buffer = await invoicesPdfService.generateInvoicePdf(invoiceId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Facture-${invoiceId}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    if (error instanceof InvoicePdfNotFoundError) {
      return res.status(404).json({ message: error.message });
    }

    if (error instanceof InvoicePdfConfigurationError) {
      return res.status(500).json({ message: error.message });
    }

    if (error instanceof InvoicePdfValidationError) {
      return res.status(422).json({ message: error.message });
    }

    console.error("Erreur génération PDF facture:", error);
    return res.status(500).json({ message: "Une erreur inattendue est survenue" });
  }
});

export default router;
