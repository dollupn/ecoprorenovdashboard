import { Router } from "express";

import { ensureAuthenticated } from "./authentication.js";
import { getOrganizationId, handleRouteError } from "./utils.js";
import { generateInvoiceForProject } from "../services/invoiceService.js";
import { invoicesPdfService } from "../invoicesPdfService.js";
import {
  InvoicePdfConfigurationError,
  InvoicePdfNotFoundError,
  InvoicePdfValidationError,
} from "../errors.js";

const router = Router();

// Generate invoice for a project
router.post("/:projectId/generate", ensureAuthenticated, async (req, res) => {
  try {
    console.log("[Invoice Generation] Starting for project:", req.params.projectId);
    const orgId = getOrganizationId(req);
    const { projectId } = req.params;

    if (!projectId) {
      console.log("[Invoice Generation] Missing projectId");
      return res.status(400).json({ message: "Identifiant projet manquant" });
    }

    console.log("[Invoice Generation] Generating invoice for project:", projectId, "org:", orgId);
    const result = await generateInvoiceForProject(orgId, projectId);
    console.log("[Invoice Generation] Success:", result.invoice.id);
    return res.status(201).json(result);
  } catch (error) {
    console.error("[Invoice Generation] Error:", error);
    return handleRouteError(res, error, "Impossible de générer la facture");
  }
});

// Download invoice PDF
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
