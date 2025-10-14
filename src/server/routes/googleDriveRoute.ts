import { Router } from "express";
import multer from "multer";
import {
  disconnectDrive,
  exchangeDriveAuthCode,
  generateDriveAuthUrl,
  getDriveConnectionSummary,
  refreshDriveCredentials,
  uploadFileToDrive,
} from "../services/googleDriveService";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get("/connection", async (req, res) => {
  const orgId = req.query.orgId;

  if (typeof orgId !== "string" || !orgId.trim()) {
    return res.status(400).json({ error: "Paramètre orgId manquant" });
  }

  try {
    const summary = await getDriveConnectionSummary(orgId);
    return res.json(summary);
  } catch (error) {
    console.error("[Drive] Unable to fetch connection", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Impossible de récupérer l'état de la connexion Google Drive",
    });
  }
});

router.post("/connection/refresh", async (req, res) => {
  const { orgId } = req.body ?? {};

  if (typeof orgId !== "string" || !orgId.trim()) {
    return res.status(400).json({ error: "orgId requis" });
  }

  try {
    const summary = await refreshDriveCredentials(orgId);
    return res.json(summary);
  } catch (error) {
    console.error("[Drive] Refresh failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'actualiser le token Google Drive";
    return res.status(400).json({ error: message });
  }
});

router.delete("/connection", async (req, res) => {
  const { orgId } = req.body ?? {};

  if (typeof orgId !== "string" || !orgId.trim()) {
    return res.status(400).json({ error: "orgId requis" });
  }

  try {
    const summary = await disconnectDrive(orgId);
    return res.json(summary);
  } catch (error) {
    console.error("[Drive] Disconnect failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Impossible de déconnecter Google Drive",
    });
  }
});

router.get("/auth/url", async (req, res) => {
  const orgId = req.query.orgId;

  if (typeof orgId !== "string" || !orgId.trim()) {
    return res.status(400).json({ error: "Paramètre orgId manquant" });
  }

  const redirectUri = typeof req.query.redirectUri === "string" ? req.query.redirectUri : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const prompt = typeof req.query.prompt === "string" ? req.query.prompt : undefined;

  try {
    const url = await generateDriveAuthUrl(orgId, { redirectUri, state, prompt });
    return res.json({ url });
  } catch (error) {
    console.error("[Drive] Unable to generate auth url", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Impossible de générer l'URL d'authentification Google Drive",
    });
  }
});

router.post("/auth/exchange", async (req, res) => {
  const { orgId, code, redirectUri } = req.body ?? {};

  if (typeof orgId !== "string" || !orgId.trim() || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Paramètres d'authentification Drive invalides" });
  }

  try {
    const summary = await exchangeDriveAuthCode(orgId, code, redirectUri);
    return res.json(summary);
  } catch (error) {
    console.error("[Drive] Auth code exchange failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'échanger le code d'autorisation Google Drive";
    return res.status(400).json({ error: message });
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  const { orgId, parentFolderId, entityType, entityId, description } = req.body ?? {};
  const file = req.file;

  if (typeof orgId !== "string" || !orgId.trim()) {
    return res.status(400).json({ error: "orgId requis" });
  }

  if (!file) {
    return res.status(400).json({ error: "Aucun fichier fourni" });
  }

  try {
    const userHeader = req.headers["x-user-id"] || req.headers["x-user"];
    const userId = typeof userHeader === "string" ? userHeader : undefined;

    const result = await uploadFileToDrive({
      orgId,
      file,
      parentFolderId: typeof parentFolderId === "string" ? parentFolderId : undefined,
      entityType: typeof entityType === "string" ? entityType : undefined,
      entityId: typeof entityId === "string" ? entityId : undefined,
      description: typeof description === "string" ? description : undefined,
      userId: userId ?? null,
    });

    return res.json(result);
  } catch (error) {
    console.error("[Drive] Upload failed", error);
    const status = error instanceof Error && /token|auth/i.test(error.message) ? 401 : 500;
    const message =
      error instanceof Error ? error.message : "Impossible d'uploader le fichier vers Google Drive";
    return res.status(status).json({ error: message });
  }
});

export default router;
