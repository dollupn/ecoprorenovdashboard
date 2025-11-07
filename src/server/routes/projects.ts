import { Router } from "express";

import { ensureAuthenticated } from "./authentication.js";
import { getOrganizationId, handleRouteError } from "./utils.js";
import { getProjectDetails, updateProjectStatusService } from "../services/projectsService.js";

const router = Router();

router.get("/:projectId", ensureAuthenticated, async (req, res) => {
  try {
    const orgId = getOrganizationId(req);
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "Identifiant projet manquant" });
    }

    const payload = await getProjectDetails(orgId, projectId);
    return res.json(payload);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de récupérer le projet");
  }
});

router.patch("/:projectId/status", ensureAuthenticated, async (req, res) => {
  const { status } = req.body ?? {};

  if (!status || typeof status !== "string") {
    return res.status(400).json({ message: "Nouveau statut projet requis" });
  }

  try {
    const orgId = getOrganizationId(req);
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "Identifiant projet manquant" });
    }

    const result = await updateProjectStatusService(orgId, projectId, status);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de mettre à jour le statut du projet");
  }
});

export default router;
