import type { CSSProperties } from "react";
import type { Project } from "@/data/projects";

type ProjectNameFields = {
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_name?: string | null;
};

const normalizeNamePart = (value?: string | null) =>
  typeof value === "string" ? value.trim() : "";

export const getProjectClientName = (project?: ProjectNameFields | null) => {
  if (!project) return "";

  const firstName = normalizeNamePart(project.client_first_name);
  const lastName = normalizeNamePart(project.client_last_name);
  const combined = `${firstName} ${lastName}`.trim();

  if (combined.length > 0) {
    return combined;
  }

  return normalizeNamePart(project.client_name);
};

export interface ProjectStatusSetting {
  id: string;
  value: string;
  label: string;
  color: string;
}

export const DEFAULT_PROJECT_STATUSES: ProjectStatusSetting[] = [
  {
    id: "NOUVEAU",
    value: "NOUVEAU",
    label: "Nouveau",
    color: "#3B82F6",
  },
  {
    id: "ETUDE",
    value: "ETUDE",
    label: "Étude",
    color: "#8B5CF6",
  },
  {
    id: "DEVIS_ENVOYE",
    value: "DEVIS_ENVOYE",
    label: "Devis Envoyé",
    color: "#F97316",
  },
  {
    id: "ACCEPTE",
    value: "ACCEPTE",
    label: "Accepté",
    color: "#22C55E",
  },
  {
    id: "A_PLANIFIER",
    value: "A_PLANIFIER",
    label: "À Planifier",
    color: "#FACC15",
  },
  {
    id: "EN_COURS",
    value: "EN_COURS",
    label: "En Cours",
    color: "#2563EB",
  },
  {
    id: "LIVRE",
    value: "LIVRE",
    label: "Livré",
    color: "#14B8A6",
  },
  {
    id: "CLOTURE",
    value: "CLOTURE",
    label: "Clôturé",
    color: "#6B7280",
  },
];

export const PROJECT_STATUS_STORAGE_KEY = "project-status-config";
export const PROJECT_STATUS_UPDATED_EVENT = "project-statuses-updated";

const DEFAULT_STATUS_COLOR = "#6B7280";

let cachedStatuses: ProjectStatusSetting[] | null = null;

const generateStatusId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `status_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");

const expandShorthandHex = (color: string) => {
  if (color.length !== 4) return color;
  return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
};

const normalizeHexColor = (color: string | undefined): string => {
  if (!color || typeof color !== "string") return DEFAULT_STATUS_COLOR;
  const trimmed = color.trim();
  if (!/^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return DEFAULT_STATUS_COLOR;
  }
  const prefixed = trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
  return expandShorthandHex(prefixed);
};

const normalizeStatusValue = (value: string | undefined): string => {
  if (!value) return "STATUT";
  const sanitized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
  return sanitized || "STATUT";
};

const prettifyLabel = (label: string | undefined, fallbackValue: string) => {
  if (label && label.trim().length > 0) return label.trim();
  return toTitleCase(fallbackValue.replace(/_/g, " "));
};

const hexToRgba = (hexColor: string, alpha: number) => {
  const normalized = normalizeHexColor(hexColor);
  const hex = normalized.replace("#", "");
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ensureUniqueValues = (statuses: ProjectStatusSetting[]) => {
  const seen = new Set<string>();

  return statuses.map((status) => {
    const baseValue = normalizeStatusValue(status.value || status.id || status.label);
    let uniqueValue = baseValue;
    let suffix = 1;

    while (seen.has(uniqueValue)) {
      suffix += 1;
      uniqueValue = `${baseValue}_${suffix}`;
    }

    seen.add(uniqueValue);

    return {
      ...status,
      id: status.id || generateStatusId(),
      value: uniqueValue,
    };
  });
};

const sanitizeProjectStatuses = (statuses: ProjectStatusSetting[]): ProjectStatusSetting[] => {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status }));
  }

  const mapped = statuses
    .map((status) => ({
      ...status,
      color: normalizeHexColor(status.color),
      value: normalizeStatusValue(status.value || status.id || status.label),
      label: prettifyLabel(status.label, normalizeStatusValue(status.value || status.id || status.label)),
      id: status.id,
    }))
    .filter((status) => Boolean(status.value));

  const unique = ensureUniqueValues(mapped);

  return unique;
};

export const getProjectStatusSettings = (options?: { skipCache?: boolean }) => {
  if (options?.skipCache) {
    cachedStatuses = null;
  }

  if (cachedStatuses) {
    return cachedStatuses.map((status) => ({ ...status }));
  }

  if (typeof window === "undefined") {
    cachedStatuses = DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status }));
    return cachedStatuses.map((status) => ({ ...status }));
  }

  const stored = window.localStorage.getItem(PROJECT_STATUS_STORAGE_KEY);

  if (!stored) {
    cachedStatuses = DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status }));
    return cachedStatuses.map((status) => ({ ...status }));
  }

  try {
    const parsed = JSON.parse(stored) as ProjectStatusSetting[];
    cachedStatuses = sanitizeProjectStatuses(parsed);
    return cachedStatuses.map((status) => ({ ...status }));
  } catch (error) {
    console.error("Unable to parse stored project statuses", error);
    cachedStatuses = DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status }));
    return cachedStatuses.map((status) => ({ ...status }));
  }
};

export const saveProjectStatuses = (statuses: ProjectStatusSetting[]) => {
  const sanitized = sanitizeProjectStatuses(statuses);
  cachedStatuses = sanitized.map((status) => ({ ...status }));

  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROJECT_STATUS_STORAGE_KEY, JSON.stringify(cachedStatuses));
    window.dispatchEvent(new CustomEvent(PROJECT_STATUS_UPDATED_EVENT));
  }

  return cachedStatuses.map((status) => ({ ...status }));
};

export const resetProjectStatuses = () => saveProjectStatuses(DEFAULT_PROJECT_STATUSES);

export const getProjectStatusBadgeStyle = (color?: string): CSSProperties => ({
  backgroundColor: hexToRgba(color ?? DEFAULT_STATUS_COLOR, 0.12),
  borderColor: hexToRgba(color ?? DEFAULT_STATUS_COLOR, 0.4),
  color: normalizeHexColor(color ?? DEFAULT_STATUS_COLOR),
});

export const getStatusAppearance = (status: Project["status"]) => {
  const statuses = getProjectStatusSettings();
  const match = statuses.find((item) => item.value === status);
  const color = match?.color ?? DEFAULT_STATUS_COLOR;

  return {
    label: match?.label ?? prettifyLabel(undefined, normalizeStatusValue(String(status ?? ""))),
    style: getProjectStatusBadgeStyle(color),
    color,
  };
};

export const getStatusLabel = (status: Project["status"]) => getStatusAppearance(status).label;

export const getStatusStyle = (status: Project["status"]): CSSProperties => getStatusAppearance(status).style;
