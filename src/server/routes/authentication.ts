import type { NextFunction, Request, Response } from "express";

export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const orgId = req.headers["x-organization-id"] ?? req.headers["x-organisation-id"];

  if (!authHeader || !orgId) {
    return res.status(401).json({
      message: "Authentification requise",
    });
  }

  return next();
};
