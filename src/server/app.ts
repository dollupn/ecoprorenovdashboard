import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import quotesPdfRoute from "./routes/quotesPdfRoute";
import googleDriveRoute from "./routes/googleDriveRoute";
import projectsRoute from "./routes/projects";
import chantierRoute from "./routes/chantier";
import invoicesRoute from "./routes/invoices";

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
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // When compiled, this file lives in dist/server/*
  // Vite client output is dist/*
  const distDir = path.resolve(__dirname, "../../dist");

  app.use(express.static(distDir)); // static assets (JS/CSS/images)

  // SPA fallback: let the client router handle non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });

  return app;
};

export type QuotesServer = ReturnType<typeof createServer>;
