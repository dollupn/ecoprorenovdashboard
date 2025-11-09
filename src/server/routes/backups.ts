import { Router } from "express";

import { ensureAuthenticated } from "./authentication.js";
import { getOrganizationId, handleRouteError } from "./utils.js";
import { exportOrganizationBackup, testBackupWebhook } from "../services/backupService.js";

const router = Router();

router.post("/test", ensureAuthenticated, async (req, res) => {
  const { webhookUrl } = req.body ?? {};

  if (!webhookUrl || typeof webhookUrl !== "string") {
    return res.status(400).json({ message: "URL du webhook requise" });
  }

  try {
    getOrganizationId(req);
    const result = await testBackupWebhook(webhookUrl);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de contacter le webhook de sauvegarde");
  }
});

router.post("/export", ensureAuthenticated, async (req, res) => {
  const { webhookUrl, chunkSize } = req.body ?? {};

  if (!webhookUrl || typeof webhookUrl !== "string") {
    return res.status(400).json({ message: "URL du webhook requise" });
  }

  try {
    const orgId = getOrganizationId(req);
    const result = await exportOrganizationBackup(orgId, webhookUrl, {
      chunkSize: typeof chunkSize === "number" ? chunkSize : undefined,
    });

    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error, "Impossible de lancer l'export des sauvegardes");
  }
});

export default router;
