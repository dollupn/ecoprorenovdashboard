import { existsSync } from "node:fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import quotesPdfRoute from "./routes/quotesPdfRoute.js";
import googleDriveRoute from "./routes/googleDriveRoute.js";
import projectsRoute from "./routes/projects.js";
import chantierRoute from "./routes/chantier.js";
import invoicesRoute from "./routes/invoices.js";

const resolveProjectRoot = () => {
  const __filename = fileURLToPath(import.meta.url);
  let currentDir = path.dirname(__filename);
  const { root } = path.parse(currentDir);

  while (currentDir !== root) {
    if (existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
};

export const createServer = () => {
  const app = express();
  app.use(express.json());

  // --- API routes
  app.use("/api/quotes", quotesPdfRoute);
  app.use("/api/google-drive", googleDriveRoute);
  app.use("/api/projects", projectsRoute);
  app.use("/api/chantiers", chantierRoute);
  app.use("/api/invoices", invoicesRoute);

  // --- Serve the built Vite client and enable SPA refresh
  const projectRoot = resolveProjectRoot();
  const distDir = path.join(projectRoot, "dist");

  if (existsSync(distDir)) {
    app.use(express.static(distDir)); // static assets (JS/CSS/images)

    // SPA fallback: let the client router handle non-API routes
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    console.warn(
      `⚠️  Static assets directory not found at "${distDir}". ` +
        "Client assets will not be served by the quotes server.",
    );
  }

  return app;
};

export type QuotesServer = ReturnType<typeof createServer>;
