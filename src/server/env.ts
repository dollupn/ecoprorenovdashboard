import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

let loaded = false;

export const loadServerEnv = () => {
  if (loaded) {
    return;
  }

  loaded = true;
  const rootDir = process.cwd();
  const candidates = [
    ".env",
    ".env.local",
    process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : null,
  ];

  const files = [...new Set(candidates.filter((value): value is string => Boolean(value)))];

  for (const file of files) {
    const filePath = path.resolve(rootDir, file);
    if (fs.existsSync(filePath)) {
      config({ path: filePath, override: true });
    }
  }
};

loadServerEnv();
