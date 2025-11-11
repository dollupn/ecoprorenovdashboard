import { Router } from "express";
import multer from "multer";
import {
  disconnectDrive,
  exchangeDriveAuthCode,
  generateDriveAuthUrl,
  getDriveConnectionSummary,
  getOrCreateProjectFolder,
  normalizeDriveSettingsInput,
  refreshDriveCredentials,
  uploadFileToDrive,
} from "../services/googleDriveService.js";
import { upsertDriveSettings } from "../repositories/googleDriveRepository.js";
import { ensureAuthenticated } from "./authentication.js";
import { getOrganizationId } from "./utils.js";
import { ApiError, ForbiddenError, ValidationError } from "../errors.js";

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

router.put("/settings", ensureAuthenticated, async (req, res) => {
  try {
    const headerOrgId = getOrganizationId(req);
    const { orgId, clientId, clientSecret, redirectUri, rootFolderId, sharedDriveId } = req.body ?? {};

    if (typeof orgId !== "string" || !orgId.trim()) {
      throw new ValidationError("Identifiant d'organisation requis pour configurer Google Drive");
    }

    if (orgId !== headerOrgId) {
      throw new ForbiddenError("Vous n'avez pas accès à cette organisation");
    }

    const normalized = normalizeDriveSettingsInput({
      clientId,
      clientSecret,
      redirectUri,
      rootFolderId,
      sharedDriveId,
    });

    await upsertDriveSettings(orgId, {
      client_id: normalized.clientId,
      client_secret: normalized.clientSecret,
      redirect_uri: normalized.redirectUri,
      root_folder_id: normalized.rootFolderId,
      shared_drive_id: normalized.sharedDriveId,
    });

    const summary = await getDriveConnectionSummary(orgId);
    return res.json(summary);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[Drive] Unable to save settings", error);
    return res.status(500).json({ error: "Impossible d'enregistrer la configuration Google Drive" });
  }
});

router.post("/connection/refresh", ensureAuthenticated, async (req, res) => {
  try {
    const headerOrgId = getOrganizationId(req);
    const bodyOrgId = typeof req.body?.orgId === "string" ? req.body.orgId : undefined;

    if (bodyOrgId && bodyOrgId !== headerOrgId) {
      throw new ForbiddenError("Vous n'avez pas accès à cette organisation");
    }

    const orgId = bodyOrgId ?? headerOrgId;
    const summary = await refreshDriveCredentials(orgId);
    return res.json(summary);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[Drive] Refresh failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'actualiser le token Google Drive";
    return res.status(400).json({ error: message });
  }
});

router.delete("/connection", ensureAuthenticated, async (req, res) => {
  try {
    const headerOrgId = getOrganizationId(req);
    const bodyOrgId = typeof req.body?.orgId === "string" ? req.body.orgId : undefined;

    if (bodyOrgId && bodyOrgId !== headerOrgId) {
      throw new ForbiddenError("Vous n'avez pas accès à cette organisation");
    }

    const orgId = bodyOrgId ?? headerOrgId;
    const summary = await disconnectDrive(orgId);
    return res.json(summary);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

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
    const { url, redirectUri: resolvedRedirectUri } = await generateDriveAuthUrl(orgId, {
      redirectUri,
      state,
      prompt,
    });
    return res.json({ url, redirectUri: resolvedRedirectUri });
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

  console.log("[Drive] Exchange endpoint called:", {
    orgId,
    hasCode: !!code,
    codeLength: code?.length,
    providedRedirectUri: redirectUri,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
    },
  });

  if (typeof orgId !== "string" || !orgId.trim() || typeof code !== "string" || !code.trim()) {
    console.error("[Drive] Invalid exchange parameters:", { orgId, hasCode: !!code });
    return res.status(400).json({ error: "Paramètres d'authentification Drive invalides" });
  }

  try {
    const summary = await exchangeDriveAuthCode(orgId, code, redirectUri);
    console.log("[Drive] Exchange successful, returning summary:", {
      orgId,
      connected: summary.connected,
      status: summary.status,
    });
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

router.post("/upload", ensureAuthenticated, upload.single("file"), async (req, res) => {
  try {
    const headerOrgId = getOrganizationId(req);
    const { orgId, parentFolderId, entityType, entityId, description } = req.body ?? {};
    const bodyOrgId = typeof orgId === "string" ? orgId : undefined;

    if (bodyOrgId && bodyOrgId !== headerOrgId) {
      throw new ForbiddenError("Vous n'avez pas accès à cette organisation");
    }

    const resolvedOrgId = bodyOrgId ?? headerOrgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    const userHeader = req.headers["x-user-id"] || req.headers["x-user"];
    const userId = typeof userHeader === "string" ? userHeader : undefined;

    const result = await uploadFileToDrive({
      orgId: resolvedOrgId,
      file,
      parentFolderId: typeof parentFolderId === "string" ? parentFolderId : undefined,
      entityType: typeof entityType === "string" ? entityType : undefined,
      entityId: typeof entityId === "string" ? entityId : undefined,
      description: typeof description === "string" ? description : undefined,
      userId: userId ?? null,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[Drive] Upload failed", error);
    const status = error instanceof Error && /token|auth/i.test(error.message) ? 401 : 500;
    const message =
      error instanceof Error ? error.message : "Impossible d'uploader le fichier vers Google Drive";
    return res.status(status).json({ error: message });
  }
});

router.get("/project-folder/:projectId", ensureAuthenticated, async (req, res) => {
  try {
    const headerOrgId = getOrganizationId(req);
    const { projectId } = req.params;
    const projectRef = typeof req.query.projectRef === "string" ? req.query.projectRef : "";
    const clientName = typeof req.query.clientName === "string" ? req.query.clientName : "";

    if (!projectId || !projectRef || !clientName) {
      return res.status(400).json({ 
        error: "Project ID, reference, and client name are required" 
      });
    }

    const result = await getOrCreateProjectFolder(
      headerOrgId,
      projectId,
      projectRef,
      clientName
    );

    return res.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[Drive] Project folder creation failed", error);
    const status = error instanceof Error && /token|auth/i.test(error.message) ? 401 : 500;
    const message =
      error instanceof Error ? error.message : "Failed to create project folder";
    return res.status(status).json({ error: message });
  }
});

export default router;
