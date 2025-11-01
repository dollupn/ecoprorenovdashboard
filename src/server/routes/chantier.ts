import { Router } from "express";

import { ensureAuthenticated } from "./authentication";
import { getOrganizationId, handleRouteError } from "./utils";
import { startChantierService } from "../services/chantierService";

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

export default router;
