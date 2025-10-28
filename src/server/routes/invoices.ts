import { Router } from "express";

import { ensureAuthenticated } from "./authentication";
import { getOrganizationId, handleRouteError } from "./utils";
import { generateInvoiceForProject } from "../services/invoiceService";

const router = Router();

router.post("/:projectId/generate", ensureAuthenticated, async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "Identifiant projet manquant" });
    }

    const result = await generateInvoiceForProject(orgId, projectId);
    return res.status(201).json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de générer la facture");
  }
});

export default router;
