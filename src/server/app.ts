import express from "express";

import quotesPdfRoute from "./routes/quotesPdfRoute";

export const createServer = () => {
  const app = express();
  app.use(express.json());

  app.use("/api/quotes", quotesPdfRoute);

  return app;
};

export type QuotesServer = ReturnType<typeof createServer>;
