import type { Request, Response } from "express";

import { ApiError } from "../errors";

export const getOrganizationId = (req: Request): string => {
  const orgId = req.headers["x-organization-id"] ?? req.headers["x-organisation-id"];

  if (typeof orgId !== "string") {
    throw new ApiError("Identifiant d'organisation manquant", 401);
  }

  return orgId;
};

export const handleRouteError = (res: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
};
