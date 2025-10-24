import { useMemo } from "react";
import { useOrg } from "./OrgContext";
import type { Database } from "@/integrations/supabase/types";

export type BusinessLocation = Database["public"]["Enums"]["business_location"];

const DEFAULT_PRIME_SETTINGS: { businessLocation: BusinessLocation; primeBonification: number } = {
  businessLocation: "metropole",
  primeBonification: 1,
};

export const useOrganizationPrimeSettings = () => {
  const { currentOrg } = useOrg();

  return useMemo(() => {
    const businessLocation =
      (currentOrg?.business_location as BusinessLocation | null) ?? DEFAULT_PRIME_SETTINGS.businessLocation;
    const primeBonification =
      typeof currentOrg?.prime_bonification === "number" && Number.isFinite(currentOrg.prime_bonification)
        ? currentOrg.prime_bonification
        : DEFAULT_PRIME_SETTINGS.primeBonification;

    return { businessLocation, primeBonification };
  }, [currentOrg]);
};
