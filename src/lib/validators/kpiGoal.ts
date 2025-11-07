import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

export const kpiGoalSchema = z
  .object({
    id: z.string().uuid("Identifiant invalide").optional(),
    org_id: z
      .string({ required_error: "Organisation requise" })
      .uuid("Organisation invalide")
      .optional(),
    month: z
      .coerce.number({ required_error: "Le mois est requis" })
      .int("Le mois doit être un entier")
      .min(1, { message: "Le mois doit être compris entre 1 et 12" })
      .max(12, { message: "Le mois doit être compris entre 1 et 12" })
      .default(currentMonth),
    year: z
      .coerce.number({ required_error: "L'année est requise" })
      .int("L'année doit être un entier")
      .min(2000, { message: "L'année doit être supérieure ou égale à 2000" })
      .max(2100, { message: "L'année doit être inférieure ou égale à 2100" })
      .default(currentYear),
    surface_goal_m2: z
      .coerce.number({ required_error: "La surface cible est requise" })
      .min(0, { message: "La surface cible doit être positive" })
      .default(0),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .transform((value) => ({
    ...value,
    surface_goal_m2: Number.isNaN(value.surface_goal_m2) ? 0 : value.surface_goal_m2,
  }));

type KpiGoalRow = Database["public"]["Tables"]["kpi_goals"]["Row"];

export interface KpiGoal {
  id: KpiGoalRow["id"];
  org_id: KpiGoalRow["org_id"];
  month: KpiGoalRow["month"];
  year: KpiGoalRow["year"];
  surface_goal_m2: KpiGoalRow["surface_goal_m2"];
  created_at: KpiGoalRow["created_at"];
  updated_at: KpiGoalRow["updated_at"];
}

export type KpiGoalInput = z.infer<typeof kpiGoalSchema>;
