import express from "express";

import quotesPdfRoute from "./routes/quotesPdfRoute";
import googleDriveRoute from "./routes/googleDriveRoute";

export const createServer = () => {
  const app = express();
  app.use(express.json());

  app.use("/api/quotes", quotesPdfRoute);
  app.use("/api/google-drive", googleDriveRoute);

  return app;
};

export type QuotesServer = ReturnType<typeof createServer>;
