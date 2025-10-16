import { useEffect, useState } from "react";
import {
  BUILDING_USAGES_STORAGE_KEY,
  BUILDING_USAGES_UPDATED_EVENT,
  getProjectUsages,
} from "@/lib/buildings";

export const useProjectUsages = () => {
  const [usages, setUsages] = useState<string[]>(() => getProjectUsages());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleUpdate = () => {
      setUsages(getProjectUsages({ skipCache: true }));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BUILDING_USAGES_STORAGE_KEY) {
        handleUpdate();
      }
    };

    window.addEventListener(BUILDING_USAGES_UPDATED_EVENT, handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(BUILDING_USAGES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return usages;
};
