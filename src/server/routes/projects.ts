import { Router } from "express";

import { ensureAuthenticated } from "./authentication.js";
import { getOrganizationId, handleRouteError } from "./utils.js";
import {
  exportProjectBundle,
  getProjectDetails,
  syncProjectToWebhook,
  updateProjectStatusService,
} from "../services/projectsService.js";
import { generateInvoiceForProject } from "../services/invoiceService.js";

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

router.post(
  "/:projectId/backup/export",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ message: "Identifiant projet manquant" });
      }

      const payload = await exportProjectBundle(orgId, projectId);
      return res.json(payload);
    } catch (error) {
      return handleRouteError(res, error, "Impossible d'exporter le projet");
    }
  },
);

router.post(
  "/:projectId/backup/sync",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ message: "Identifiant projet manquant" });
      }

      const result = await syncProjectToWebhook(orgId, projectId);
      return res.json(result);
    } catch (error) {
      return handleRouteError(res, error, "Impossible de synchroniser le projet");
    }
  },
);

router.post(
  "/:projectId/invoices/generate",
  ensureAuthenticated,
  async (req, res) => {
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
  },
);

export default router;
