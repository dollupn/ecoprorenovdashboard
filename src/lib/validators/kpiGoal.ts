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
    title: z.string().min(1, "Le titre est requis"),
    description: z.string().optional(),
    metric: z.string().min(1, "La métrique est requise"),
    target_value: z
      .coerce.number({ required_error: "La valeur cible est requise" })
      .min(0, { message: "La valeur cible doit être positive" })
      .default(0),
    target_unit: z.string().min(1, "L'unité est requise"),
    period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
    is_active: z.boolean().default(true),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .transform((value) => ({
    ...value,
    target_value: Number.isNaN(value.target_value) ? 0 : value.target_value,
  }));

type KpiGoalRow = Database["public"]["Tables"]["kpi_goals"]["Row"];

export interface KpiGoal {
  id: KpiGoalRow["id"];
  org_id: KpiGoalRow["org_id"];
  title: KpiGoalRow["title"];
  description: KpiGoalRow["description"];
  metric: KpiGoalRow["metric"];
  target_value: KpiGoalRow["target_value"];
  target_unit: KpiGoalRow["target_unit"];
  period: KpiGoalRow["period"];
  is_active: KpiGoalRow["is_active"];
  created_at: KpiGoalRow["created_at"];
  updated_at: KpiGoalRow["updated_at"];
}

export type KpiGoalInput = z.infer<typeof kpiGoalSchema>;
