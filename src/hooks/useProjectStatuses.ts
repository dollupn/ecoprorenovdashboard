import { useEffect, useState } from "react";
import {
  getProjectStatusSettings,
  PROJECT_STATUS_STORAGE_KEY,
  PROJECT_STATUS_UPDATED_EVENT,
  type ProjectStatusSetting,
} from "@/lib/projects";

export const useProjectStatuses = () => {
  const [statuses, setStatuses] = useState<ProjectStatusSetting[]>(() => getProjectStatusSettings());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleUpdate = () => {
      setStatuses(getProjectStatusSettings({ skipCache: true }));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROJECT_STATUS_STORAGE_KEY) {
        handleUpdate();
      }
    };

    window.addEventListener(PROJECT_STATUS_UPDATED_EVENT, handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(PROJECT_STATUS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return statuses;
};
