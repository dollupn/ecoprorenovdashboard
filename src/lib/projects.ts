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
  isActive?: boolean;
}

export const DEFAULT_PROJECT_STATUSES: ProjectStatusSetting[] = [
  {
    id: "NOUVEAU",
    value: "NOUVEAU",
    label: "Nouveau",
    color: "#3B82F6",
    isActive: true,
  },
  {
    id: "DEVIS_SIGNE",
    value: "DEVIS_SIGNE",
    label: "Devis signé",
    color: "#22C55E",
    isActive: true,
  },
  {
    id: "CHANTIER_PLANIFIE",
    value: "CHANTIER_PLANIFIE",
    label: "Chantier planifié",
    color: "#FACC15",
    isActive: true,
  },
  {
    id: "CHANTIER_EN_COURS",
    value: "CHANTIER_EN_COURS",
    label: "Chantier en cours",
    color: "#2563EB",
    isActive: true,
  },
  {
    id: "CHANTIER_TERMINE",
    value: "CHANTIER_TERMINE",
    label: "Chantier terminé",
    color: "#8B5CF6",
    isActive: true,
  },
  {
    id: "VISITE_TECHNIQUE",
    value: "VISITE_TECHNIQUE",
    label: "Visite technique",
    color: "#F97316",
    isActive: true,
  },
  {
    id: "LIVRE",
    value: "LIVRE",
    label: "Livré",
    color: "#14B8A6",
    isActive: false,
  },
  {
    id: "FACTURE_ENVOYEE",
    value: "FACTURE_ENVOYEE",
    label: "Facture envoyée",
    color: "#F59E0B",
    isActive: true,
  },
  {
    id: "AH",
    value: "AH",
    label: "AH",
    color: "#0EA5E9",
    isActive: true,
  },
  {
    id: "AAF",
    value: "AAF",
    label: "AAF",
    color: "#F472B6",
    isActive: true,
  },
  {
    id: "CLOTURE",
    value: "CLOTURE",
    label: "Clôturé",
    color: "#475569",
    isActive: false,
  },
  {
    id: "ANNULE",
    value: "ANNULE",
    label: "Annulé",
    color: "#94A3B8",
    isActive: false,
  },
  {
    id: "ABANDONNE",
    value: "ABANDONNE",
    label: "Abandonné",
    color: "#A855F7",
    isActive: false,
  },
];

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

export const sanitizeProjectStatuses = (
  statuses: ProjectStatusSetting[],
): ProjectStatusSetting[] => {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status }));
  }

  const defaultStatusById = new Map(
    DEFAULT_PROJECT_STATUSES.map((status) => [status.id, status] as const),
  );
  const defaultStatusByValue = new Map(
    DEFAULT_PROJECT_STATUSES.map((status) => [
      normalizeStatusValue(status.value || status.id || status.label),
      status,
    ] as const),
  );

  const mapped = statuses
    .map((status) => {
      const normalizedValue = normalizeStatusValue(status.value || status.id || status.label);
      const fallbackStatus =
        (status.id && defaultStatusById.get(status.id)) ||
        defaultStatusByValue.get(normalizedValue);

      return {
        ...status,
        color: normalizeHexColor(status.color),
        value: normalizedValue,
        label: prettifyLabel(status.label, normalizedValue),
        isActive:
          status.isActive === false
            ? false
            : status.isActive === true
            ? true
            : fallbackStatus?.isActive ?? true,
        id: status.id,
      };
    })
    .filter((status) => Boolean(status.value));

  const unique = ensureUniqueValues(mapped);

  return unique;
};

export const getProjectStatusSettings = (options?: { skipCache?: boolean }) => {
  if (options?.skipCache) {
    cachedStatuses = null;
  }

  if (!cachedStatuses) {
    cachedStatuses = DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status }));
  }

  return cachedStatuses.map((status) => ({ ...status }));
};

export const saveProjectStatuses = (statuses: ProjectStatusSetting[]) => {
  const sanitized = sanitizeProjectStatuses(statuses);
  cachedStatuses = sanitized.map((status) => ({ ...status }));
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
