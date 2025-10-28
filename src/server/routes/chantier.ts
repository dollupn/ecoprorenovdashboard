import { Router } from "express";

import { ensureAuthenticated } from "./authentication";
import { getOrganizationId, handleRouteError } from "./utils";
import { startChantierService, updateChantierStatusService } from "../services/chantierService";

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

router.patch("/:chantierId/status", ensureAuthenticated, async (req, res) => {
  const { status } = req.body ?? {};

  if (!status || typeof status !== "string") {
    return res.status(400).json({ message: "Nouveau statut chantier requis" });
  }

  try {
    const orgId = getOrganizationId(req);
    const { chantierId } = req.params;

    if (!chantierId) {
      return res.status(400).json({ message: "Identifiant chantier manquant" });
    }

    const result = await updateChantierStatusService(orgId, chantierId, status);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de mettre à jour le statut du chantier");
  }
});

export default router;
