import { createServer } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

// Always start the app in production; we don't gate behind START_QUOTES_SERVER
const app = createServer();
app.listen(port, () => {
  console.info(`✅ Server running on http://localhost:${port}`);
});
