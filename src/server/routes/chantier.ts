import { Router } from "express";

import { ensureAuthenticated } from "./authentication.js";
import { getOrganizationId, handleRouteError } from "./utils.js";
import { startChantierService, updateChantierService } from "../services/chantierService.js";

const router = Router();

router.post("/:projectId/start", ensureAuthenticated, async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "Identifiant projet manquant" });
    }

    const result = await startChantierService(orgId, projectId, req.body ?? {});
    return res.status(201).json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de démarrer le chantier");
  }
});

router.patch("/:siteId", ensureAuthenticated, async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { siteId } = req.params;

    if (!siteId) {
      return res.status(400).json({ message: "Identifiant chantier manquant" });
    }

    const result = await updateChantierService(orgId, siteId, req.body ?? {});
    return res.status(200).json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de mettre à jour le chantier");
  }
});

export default router;
