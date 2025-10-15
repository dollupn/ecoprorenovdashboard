const DEFAULT_BUILDING_TYPES = [
  "Commerce",
  "Hôtellerie",
  "Enseignement",
  "Santé",
  "Entrepôts",
  "Bureaux",
  "Restauration",
  "Autres",
] as const;

const DEFAULT_BUILDING_USAGES = ["Commercial", "Stockage", "Agricole", "Production"] as const;

const BUILDING_TYPES_STORAGE_KEY = "project-building-types";
const BUILDING_USAGES_STORAGE_KEY = "project-building-usages";

const BUILDING_TYPES_UPDATED_EVENT = "project-building-types-updated";
const BUILDING_USAGES_UPDATED_EVENT = "project-building-usages-updated";

let cachedBuildingTypes: string[] | null = null;
let cachedBuildingUsages: string[] | null = null;

const clone = (values: string[]): string[] => values.map((value) => value);

const sanitizeStringList = (values: unknown, fallback: readonly string[]): string[] => {
  if (!Array.isArray(values)) {
    return fallback.map((value) => value);
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  values.forEach((value) => {
    if (typeof value !== "string") {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    if (seen.has(trimmed)) {
      return;
    }

    seen.add(trimmed);
    sanitized.push(trimmed);
  });

  if (sanitized.length === 0) {
    return fallback.map((value) => value);
  }

  return sanitized;
};

const readFromStorage = (key: string): unknown => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return null;
    }

    return JSON.parse(stored);
  } catch (error) {
    console.error(`Unable to parse stored value for ${key}`, error);
    return null;
  }
};

const writeToStorage = (key: string, values: string[], eventName: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(values));
  window.dispatchEvent(new CustomEvent(eventName));
};

export const getProjectBuildingTypes = (options?: { skipCache?: boolean }): string[] => {
  if (options?.skipCache) {
    cachedBuildingTypes = null;
  }

  if (cachedBuildingTypes) {
    return clone(cachedBuildingTypes);
  }

  const stored = readFromStorage(BUILDING_TYPES_STORAGE_KEY);
  cachedBuildingTypes = sanitizeStringList(stored, DEFAULT_BUILDING_TYPES);
  return clone(cachedBuildingTypes);
};

export const getProjectUsages = (options?: { skipCache?: boolean }): string[] => {
  if (options?.skipCache) {
    cachedBuildingUsages = null;
  }

  if (cachedBuildingUsages) {
    return clone(cachedBuildingUsages);
  }

  const stored = readFromStorage(BUILDING_USAGES_STORAGE_KEY);
  cachedBuildingUsages = sanitizeStringList(stored, DEFAULT_BUILDING_USAGES);
  return clone(cachedBuildingUsages);
};

export const saveProjectBuildingTypes = (types: string[]): string[] => {
  const sanitized = sanitizeStringList(types, DEFAULT_BUILDING_TYPES);
  cachedBuildingTypes = clone(sanitized);
  writeToStorage(BUILDING_TYPES_STORAGE_KEY, cachedBuildingTypes, BUILDING_TYPES_UPDATED_EVENT);
  return clone(cachedBuildingTypes);
};

export const saveProjectUsages = (usages: string[]): string[] => {
  const sanitized = sanitizeStringList(usages, DEFAULT_BUILDING_USAGES);
  cachedBuildingUsages = clone(sanitized);
  writeToStorage(BUILDING_USAGES_STORAGE_KEY, cachedBuildingUsages, BUILDING_USAGES_UPDATED_EVENT);
  return clone(cachedBuildingUsages);
};

export const resetProjectBuildingTypes = () => saveProjectBuildingTypes([...DEFAULT_BUILDING_TYPES]);

export const resetProjectUsages = () => saveProjectUsages([...DEFAULT_BUILDING_USAGES]);

export {
  DEFAULT_BUILDING_TYPES,
  DEFAULT_BUILDING_USAGES,
  BUILDING_TYPES_STORAGE_KEY,
  BUILDING_USAGES_STORAGE_KEY,
  BUILDING_TYPES_UPDATED_EVENT,
  BUILDING_USAGES_UPDATED_EVENT,
};
