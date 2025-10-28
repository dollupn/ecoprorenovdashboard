import type { NextFunction, Request, Response } from "express";

import { getServiceSupabaseClient } from "../repositories/supabaseClient";

const AUTH_ERROR_MESSAGE = "Authentification requise";

export const ensureAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const orgIdHeader = req.headers["x-organization-id"] ?? req.headers["x-organisation-id"];

  if (typeof authHeader !== "string" || typeof orgIdHeader !== "string") {
    return res.status(401).json({ message: AUTH_ERROR_MESSAGE });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return res.status(401).json({ message: AUTH_ERROR_MESSAGE });
  }

  const supabase = getServiceSupabaseClient();

  try {
    const { data: userResponse, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userResponse?.user) {
      return res.status(401).json({ message: AUTH_ERROR_MESSAGE });
    }

    const userId = userResponse.user.id;

    const { data: membership, error: membershipError } = await supabase.rpc("has_org_membership", {
      _org_id: orgIdHeader,
      _user_id: userId,
    });

    if (membershipError) {
      console.error("Organisation membership verification failed", membershipError);
      return res.status(500).json({ message: "Erreur d'authentification" });
    }

    if (membership !== true) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    return next();
  } catch (error) {
    console.error("Unexpected authentication failure", error);
    return res.status(500).json({ message: "Erreur d'authentification" });
  }
};
