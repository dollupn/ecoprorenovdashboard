import { useEffect, useState } from "react";
import {
  BUILDING_TYPES_STORAGE_KEY,
  BUILDING_TYPES_UPDATED_EVENT,
  getProjectBuildingTypes,
} from "@/lib/buildings";

export const useProjectBuildingTypes = () => {
  const [types, setTypes] = useState<string[]>(() => getProjectBuildingTypes());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleUpdate = () => {
      setTypes(getProjectBuildingTypes({ skipCache: true }));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BUILDING_TYPES_STORAGE_KEY) {
        handleUpdate();
      }
    };

    window.addEventListener(BUILDING_TYPES_UPDATED_EVENT, handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(BUILDING_TYPES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return types;
};
