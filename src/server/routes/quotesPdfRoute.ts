import type { Request, Response, NextFunction } from "express";
import { Router } from "express";

import { quotesPdfService } from "../quotesPdfService";
import { QuotePdfConfigurationError, QuotePdfError, QuotePdfNotFoundError } from "../errors";

const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const orgId = req.headers["x-organization-id"];

  if (!authHeader || !orgId) {
    return res.status(401).json({
      message: "Authentification requise pour télécharger le devis",
    });
  }

  return next();
};

const router = Router();

router.get("/:id/pdf", ensureAuthenticated, async (req, res) => {
  const quoteId = req.params.id;

  if (!quoteId) {
    return res.status(400).json({ message: "Identifiant de devis manquant" });
  }

  try {
    const buffer = await quotesPdfService.generateQuotePdf(quoteId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Devis-${quoteId}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    if (error instanceof QuotePdfNotFoundError) {
      return res.status(404).json({ message: error.message });
    }

    if (error instanceof QuotePdfConfigurationError) {
      return res.status(500).json({ message: error.message });
    }

    if (error instanceof QuotePdfError) {
      return res.status(422).json({ message: error.message });
    }

    return res.status(500).json({ message: "Une erreur inattendue est survenue" });
  }
});

export default router;
