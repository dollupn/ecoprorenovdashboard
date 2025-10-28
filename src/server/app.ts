import express from "express";

import quotesPdfRoute from "./routes/quotesPdfRoute";
import googleDriveRoute from "./routes/googleDriveRoute";
import projectsRoute from "./routes/projects";
import chantierRoute from "./routes/chantier";
import invoicesRoute from "./routes/invoices";

export const createServer = () => {
  const app = express();
  app.use(express.json());

  app.use("/api/quotes", quotesPdfRoute);
  app.use("/api/google-drive", googleDriveRoute);
  app.use("/api/projects", projectsRoute);
  app.use("/api/chantiers", chantierRoute);
  app.use("/api/invoices", invoicesRoute);

  return app;
};

export type QuotesServer = ReturnType<typeof createServer>;
