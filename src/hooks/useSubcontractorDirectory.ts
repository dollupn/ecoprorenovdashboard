import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "site-subcontractors";

const normalizeName = (value: string) => value.trim();

const getStorageKey = (orgId?: string | null) => {
  const suffix = orgId && orgId.length > 0 ? `:${orgId}` : "";
  return `${STORAGE_KEY}${suffix}`;
};

export function useSubcontractorDirectory(orgId?: string | null) {
  const storageKey = useMemo(() => getStorageKey(orgId), [orgId]);
  const [subcontractors, setSubcontractors] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSubcontractors([]);
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((entry) => (typeof entry === "string" ? normalizeName(entry) : ""))
          .filter((entry) => entry.length > 0);
        setSubcontractors(Array.from(new Set(normalized)));
      } else {
        setSubcontractors([]);
      }
    } catch (error) {
      console.warn("Unable to read subcontractor directory", error);
      setSubcontractors([]);
    }
  }, [storageKey]);

  const saveSubcontractors = useCallback(
    (names: string[]) => {
      if (typeof window === "undefined") return;

      const normalized = names
        .map(normalizeName)
        .filter((name) => name.length > 0);

      if (normalized.length === 0) return;

      setSubcontractors((previous) => {
        const merged = Array.from(new Set([...previous, ...normalized]));
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(merged));
        } catch (error) {
          console.warn("Unable to persist subcontractor directory", error);
        }
        return merged;
      });
    },
    [storageKey],
  );

  return { subcontractors, saveSubcontractors };
}
