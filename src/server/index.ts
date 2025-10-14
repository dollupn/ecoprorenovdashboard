import { createServer } from "./app";

const port = Number(process.env.PORT ?? 8787);

if (process.env.NODE_ENV !== "test" && process.env.START_QUOTES_SERVER === "true") {
  const app = createServer();
  app.listen(port, () => {
    console.info(`Serveur devis prêt sur http://localhost:${port}`);
  });
}
