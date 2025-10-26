import type { ProductFormSchema } from "@/features/leads/api";

export const LEAD_STATUS_VALUES = [
  "Non éligible",
  "À rappeler",
  "Phoning",
  "À recontacter",
  "Programmer pré-visite",
  "Éligible",
] as const;

export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];

export type LeadSourceChannel =
  | "digital"
  | "recommendation"
  | "partner"
  | "event"
  | "outbound"
  | "other";

export interface LeadSourceSetting {
  id: string;
  name: string;
  channel: LeadSourceChannel;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStatusSetting {
  id: string;
  value: LeadStatusValue;
  label: string;
  description: string;
  color: string;
  order: number;
  isActive: boolean;
  followUpHours: number;
  probability?: number;
}

export type LeadDynamicFieldType = "text" | "textarea" | "number" | "select";

export interface LeadDynamicFieldSetting {
  id: string;
  name: string;
  label: string;
  type: LeadDynamicFieldType;
  placeholder?: string;
  helperText?: string;
  required: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
  order: number;
  isActive: boolean;
}

export type LeadAssignmentStrategy = "round_robin" | "load_balanced" | "manual";

export interface LeadAutomationSettings {
  autoAssignEnabled: boolean;
  assignmentStrategy: LeadAssignmentStrategy;
  includeManagersInRotation: boolean;
  notifyAssignee: boolean;
  notifyManagerOnSkip: boolean;
  duplicateDetectionEnabled: boolean;
  duplicateDetectionWindowHours: number;
  autoArchiveAfterDays: number;
  autoArchiveStatus: LeadStatusValue;
}

const LEAD_SOURCES_STORAGE_KEY = "lead-sources-settings";
export const LEAD_SOURCES_UPDATED_EVENT = "lead-sources-updated";

const LEAD_STATUS_STORAGE_KEY = "lead-status-settings";
export const LEAD_STATUS_SETTINGS_UPDATED_EVENT = "lead-status-settings-updated";

const LEAD_DYNAMIC_FIELDS_STORAGE_KEY = "lead-dynamic-fields-settings";
export const LEAD_DYNAMIC_FIELDS_UPDATED_EVENT = "lead-dynamic-fields-updated";

const LEAD_AUTOMATION_SETTINGS_STORAGE_KEY = "lead-automation-settings";
export const LEAD_AUTOMATION_SETTINGS_UPDATED_EVENT = "lead-automation-settings-updated";

const DEFAULT_STATUS_COLOR = "#6B7280";

const DEFAULT_LEAD_SOURCES: LeadSourceSetting[] = [
  {
    id: "source-google-ads",
    name: "Google Ads",
    channel: "digital",
    description: "Campagnes SEA et formulaires entrants",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "source-facebook",
    name: "Campagne Facebook",
    channel: "digital",
    description: "Génération de leads via Meta",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "source-recommendation",
    name: "Recommandation client",
    channel: "recommendation",
    description: "Bouche à oreille, parrainage",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "source-partner",
    name: "Partenaire commercial",
    channel: "partner",
    description: "Partenariats apporteurs d'affaires",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "source-telemarketing",
    name: "Téléprospection",
    channel: "outbound",
    description: "Listes louées ou fichiers internes",
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_LEAD_STATUS_SETTINGS: LeadStatusSetting[] = [
  {
    id: "status-non-eligible",
    value: "Non éligible",
    label: "Non éligible",
    description: "Lead non qualifié ou hors périmètre",
    color: "#EF4444",
    order: 6,
    isActive: true,
    followUpHours: 0,
    probability: 0,
  },
  {
    id: "status-a-rappeler",
    value: "À rappeler",
    label: "À rappeler",
    description: "Lead à contacter pour une première qualification",
    color: "#F59E0B",
    order: 1,
    isActive: true,
    followUpHours: 24,
    probability: 20,
  },
  {
    id: "status-phoning",
    value: "Phoning",
    label: "Phoning",
    description: "Lead en cours de traitement via script d'appel",
    color: "#0EA5E9",
    order: 2,
    isActive: true,
    followUpHours: 12,
    probability: 35,
  },
  {
    id: "status-a-recontacter",
    value: "À recontacter",
    label: "À recontacter",
    description: "Lead qualifié nécessitant un suivi",
    color: "#3B82F6",
    order: 3,
    isActive: true,
    followUpHours: 48,
    probability: 55,
  },
  {
    id: "status-pre-visite",
    value: "Programmer pré-visite",
    label: "Programmer pré-visite",
    description: "Lead à planifier pour une pré-visite terrain",
    color: "#A855F7",
    order: 4,
    isActive: true,
    followUpHours: 72,
    probability: 75,
  },
  {
    id: "status-eligible",
    value: "Éligible",
    label: "Éligible",
    description: "Lead qualifié et prêt à être converti",
    color: "#22C55E",
    order: 5,
    isActive: true,
    followUpHours: 0,
    probability: 100,
  },
];

const DEFAULT_LEAD_DYNAMIC_FIELDS: LeadDynamicFieldSetting[] = [
  {
    id: "field-building-surface",
    name: "building_surface",
    label: "Surface du bâtiment (m²)",
    type: "number",
    placeholder: "Ex: 120",
    required: false,
    min: 0,
    max: null,
    options: undefined,
    helperText: "Utilisé pour estimer la prime CEE",
    order: 1,
    isActive: true,
  },
  {
    id: "field-building-usage",
    name: "building_usage",
    label: "Usage du bâtiment",
    type: "select",
    placeholder: "Sélectionner l'usage",
    required: false,
    options: ["Résidentiel", "Tertiaire", "Industriel"],
    helperText: "Permet de calculer automatiquement le bon barème",
    order: 2,
    isActive: true,
  },
  {
    id: "field-notes",
    name: "qualification_notes",
    label: "Notes de qualification",
    type: "textarea",
    placeholder: "Détails supplémentaires recueillis lors de l'appel",
    required: false,
    options: undefined,
    helperText: undefined,
    order: 3,
    isActive: true,
  },
];

const DEFAULT_LEAD_AUTOMATION_SETTINGS: LeadAutomationSettings = {
  autoAssignEnabled: true,
  assignmentStrategy: "round_robin",
  includeManagersInRotation: false,
  notifyAssignee: true,
  notifyManagerOnSkip: true,
  duplicateDetectionEnabled: true,
  duplicateDetectionWindowHours: 72,
  autoArchiveAfterDays: 45,
  autoArchiveStatus: "Non éligible",
};

const hasWindow = typeof window !== "undefined";

const toRecord = <T>(value: unknown, fallback: T): T => {
  if (!value || typeof value !== "object") return fallback;
  return value as T;
};

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return toRecord(parsed, fallback);
  } catch (error) {
    console.error("Unable to parse lead settings from storage", error);
    return fallback;
  }
};

const readStorage = <T>(key: string, fallback: T): T => {
  if (!hasWindow) return fallback;
  try {
    return parseJson(window.localStorage.getItem(key), fallback);
  } catch (error) {
    console.error("Unable to read storage", error);
    return fallback;
  }
};

const writeStorage = <T>(key: string, value: T) => {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Unable to write storage", error);
  }
};

const dispatchEvent = (name: string) => {
  if (!hasWindow) return;
  window.dispatchEvent(new CustomEvent(name));
};

const generateId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const normalizeHexColor = (color: string | undefined): string => {
  if (!color || typeof color !== "string") return DEFAULT_STATUS_COLOR;
  const trimmed = color.trim();
  const match = trimmed.match(/^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/);
  if (!match) return DEFAULT_STATUS_COLOR;
  const prefixed = trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
  if (prefixed.length === 4) {
    return `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`;
  }
  return prefixed;
};

const hexToRgba = (hexColor: string, alpha: number) => {
  const normalized = normalizeHexColor(hexColor);
  const hex = normalized.replace("#", "");
  const bigint = Number.parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const normalizeSourceName = (value: string) => value.trim();

const sanitizeChannel = (channel: string | undefined): LeadSourceChannel => {
  if (!channel) return "other";
  if (["digital", "recommendation", "partner", "event", "outbound", "other"].includes(channel)) {
    return channel as LeadSourceChannel;
  }
  return "other";
};

const sanitizeLeadSources = (sources: LeadSourceSetting[]): LeadSourceSetting[] => {
  if (!Array.isArray(sources) || sources.length === 0) {
    return DEFAULT_LEAD_SOURCES.map((source) => ({ ...source }));
  }

  const now = new Date().toISOString();
  const seen = new Set<string>();

  return sources
    .map((source) => {
      const name = normalizeSourceName(source.name ?? "");
      if (!name) return null;

      const id = source.id || generateId("lead-source");

      if (seen.has(name.toLowerCase())) {
        return null;
      }

      seen.add(name.toLowerCase());

      return {
        id,
        name,
        channel: sanitizeChannel(source.channel),
        description: source.description?.toString().trim() ?? "",
        isActive: Boolean(source.isActive),
        createdAt: source.createdAt ?? now,
        updatedAt: now,
      } satisfies LeadSourceSetting;
    })
    .filter(Boolean) as LeadSourceSetting[];
};

let cachedLeadSources: LeadSourceSetting[] | null = null;

export const getLeadSources = (options?: { includeInactive?: boolean; skipCache?: boolean }) => {
  const includeInactive = options?.includeInactive ?? false;

  if (options?.skipCache) {
    cachedLeadSources = null;
  }

  if (!cachedLeadSources) {
    const stored = readStorage(LEAD_SOURCES_STORAGE_KEY, DEFAULT_LEAD_SOURCES);
    cachedLeadSources = sanitizeLeadSources(stored);
  }

  const sources = cachedLeadSources ?? [];
  if (includeInactive) {
    return sources.map((source) => ({ ...source }));
  }

  return sources.filter((source) => source.isActive).map((source) => ({ ...source }));
};

export const saveLeadSources = (sources: LeadSourceSetting[]) => {
  const sanitized = sanitizeLeadSources(sources);
  cachedLeadSources = sanitized;
  writeStorage(LEAD_SOURCES_STORAGE_KEY, sanitized);
  dispatchEvent(LEAD_SOURCES_UPDATED_EVENT);
  return sanitized;
};

export const resetLeadSources = () => {
  cachedLeadSources = DEFAULT_LEAD_SOURCES.map((source) => ({ ...source }));
  writeStorage(LEAD_SOURCES_STORAGE_KEY, cachedLeadSources);
  dispatchEvent(LEAD_SOURCES_UPDATED_EVENT);
  return cachedLeadSources.map((source) => ({ ...source }));
};

const sanitizeLeadStatusSettings = (settings: LeadStatusSetting[]): LeadStatusSetting[] => {
  if (!Array.isArray(settings) || settings.length === 0) {
    return DEFAULT_LEAD_STATUS_SETTINGS.map((status) => ({ ...status }));
  }

  const validValues = new Set(LEAD_STATUS_VALUES);

  return settings
    .map((status) => {
      if (!validValues.has(status.value as LeadStatusValue)) {
        return null;
      }

      return {
        ...status,
        label: status.label?.trim() || status.value,
        description: status.description?.trim() || "",
        color: normalizeHexColor(status.color),
        order: Number.isFinite(status.order) ? Number(status.order) : 0,
        isActive: status.isActive !== false,
        followUpHours:
          Number.isFinite(status.followUpHours) && status.followUpHours >= 0
            ? Math.round(Number(status.followUpHours))
            : 0,
        probability:
          status.probability !== undefined && Number.isFinite(status.probability)
            ? Math.min(100, Math.max(0, Number(status.probability)))
            : undefined,
        id: status.id || `status-${status.value}`,
      } satisfies LeadStatusSetting;
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order) as LeadStatusSetting[];
};

let cachedLeadStatuses: LeadStatusSetting[] | null = null;

export const getLeadStatusSettings = (options?: { includeInactive?: boolean; skipCache?: boolean }) => {
  const includeInactive = options?.includeInactive ?? false;

  if (options?.skipCache) {
    cachedLeadStatuses = null;
  }

  if (!cachedLeadStatuses) {
    const stored = readStorage(LEAD_STATUS_STORAGE_KEY, DEFAULT_LEAD_STATUS_SETTINGS);
    cachedLeadStatuses = sanitizeLeadStatusSettings(stored);
  }

  const statuses = cachedLeadStatuses ?? [];
  if (includeInactive) {
    return statuses.map((status) => ({ ...status }));
  }

  return statuses.filter((status) => status.isActive).map((status) => ({ ...status }));
};

export const saveLeadStatusSettings = (settings: LeadStatusSetting[]) => {
  const sanitized = sanitizeLeadStatusSettings(settings);
  cachedLeadStatuses = sanitized;
  writeStorage(LEAD_STATUS_STORAGE_KEY, sanitized);
  dispatchEvent(LEAD_STATUS_SETTINGS_UPDATED_EVENT);
  return sanitized;
};

export const resetLeadStatusSettings = () => {
  cachedLeadStatuses = DEFAULT_LEAD_STATUS_SETTINGS.map((status) => ({ ...status }));
  writeStorage(LEAD_STATUS_STORAGE_KEY, cachedLeadStatuses);
  dispatchEvent(LEAD_STATUS_SETTINGS_UPDATED_EVENT);
  return cachedLeadStatuses.map((status) => ({ ...status }));
};

export const findLeadStatusSetting = (status: string) =>
  (cachedLeadStatuses ?? getLeadStatusSettings({ includeInactive: true })).find(
    (entry) => entry.value === status
  );

const sanitizeFieldName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const sanitizeLeadDynamicFields = (
  fields: LeadDynamicFieldSetting[]
): LeadDynamicFieldSetting[] => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return DEFAULT_LEAD_DYNAMIC_FIELDS.map((field) => ({ ...field }));
  }

  const allowedTypes: LeadDynamicFieldType[] = ["text", "textarea", "number", "select"];
  const seenNames = new Set<string>();
  let position = 1;

  return fields
    .map((field) => {
      const label = field.label?.toString().trim();
      if (!label) return null;

      const type = allowedTypes.includes(field.type as LeadDynamicFieldType)
        ? (field.type as LeadDynamicFieldType)
        : "text";

      const normalizedName = sanitizeFieldName(field.name || label);
      let uniqueName = normalizedName || `field_${position}`;
      let suffix = 1;

      while (seenNames.has(uniqueName)) {
        suffix += 1;
        uniqueName = `${normalizedName || "field"}_${suffix}`;
      }

      seenNames.add(uniqueName);

      const baseField: LeadDynamicFieldSetting = {
        id: field.id || generateId("lead-field"),
        name: uniqueName,
        label,
        type,
        placeholder: field.placeholder?.toString().trim() || "",
        helperText: field.helperText?.toString().trim() || undefined,
        required: Boolean(field.required),
        min: field.min != null && Number.isFinite(field.min) ? Number(field.min) : null,
        max: field.max != null && Number.isFinite(field.max) ? Number(field.max) : null,
        order: Number.isFinite(field.order) ? Number(field.order) : position,
        isActive: field.isActive !== false,
        options: undefined,
      };

      if (type === "select") {
        const rawOptions = Array.isArray(field.options)
          ? field.options
          : typeof field.options === "string"
            ? field.options.split(",")
            : [];

        const cleanedOptions = rawOptions
          .map((option) => option.toString().trim())
          .filter((option) => option.length > 0);

        if (cleanedOptions.length === 0) {
          cleanedOptions.push("Option 1", "Option 2");
        }

        baseField.options = cleanedOptions;
      }

      position += 1;
      return baseField;
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order) as LeadDynamicFieldSetting[];
};

let cachedLeadDynamicFields: LeadDynamicFieldSetting[] | null = null;

export const getLeadDynamicFields = (options?: { includeInactive?: boolean; skipCache?: boolean }) => {
  const includeInactive = options?.includeInactive ?? false;

  if (options?.skipCache) {
    cachedLeadDynamicFields = null;
  }

  if (!cachedLeadDynamicFields) {
    const stored = readStorage(LEAD_DYNAMIC_FIELDS_STORAGE_KEY, DEFAULT_LEAD_DYNAMIC_FIELDS);
    cachedLeadDynamicFields = sanitizeLeadDynamicFields(stored);
  }

  const fields = cachedLeadDynamicFields ?? [];
  if (includeInactive) {
    return fields.map((field) => ({ ...field }));
  }

  return fields.filter((field) => field.isActive).map((field) => ({ ...field }));
};

export const saveLeadDynamicFields = (fields: LeadDynamicFieldSetting[]) => {
  const sanitized = sanitizeLeadDynamicFields(fields);
  cachedLeadDynamicFields = sanitized;
  writeStorage(LEAD_DYNAMIC_FIELDS_STORAGE_KEY, sanitized);
  dispatchEvent(LEAD_DYNAMIC_FIELDS_UPDATED_EVENT);
  return sanitized;
};

export const resetLeadDynamicFields = () => {
  cachedLeadDynamicFields = DEFAULT_LEAD_DYNAMIC_FIELDS.map((field) => ({ ...field }));
  writeStorage(LEAD_DYNAMIC_FIELDS_STORAGE_KEY, cachedLeadDynamicFields);
  dispatchEvent(LEAD_DYNAMIC_FIELDS_UPDATED_EVENT);
  return cachedLeadDynamicFields.map((field) => ({ ...field }));
};

export const getLeadDynamicFieldSchema = (): ProductFormSchema | null => {
  const activeFields = getLeadDynamicFields();
  if (activeFields.length === 0) {
    return null;
  }

  return {
    title: "Informations complémentaires",
    fields: activeFields.map((field) => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder,
      min: field.type === "number" ? field.min ?? undefined : undefined,
      max: field.type === "number" ? field.max ?? undefined : undefined,
      options: field.type === "select" ? field.options : undefined,
    })),
  } satisfies ProductFormSchema;
};

let cachedLeadAutomationSettings: LeadAutomationSettings | null = null;

const sanitizeAutomationSettings = (
  settings: LeadAutomationSettings
): LeadAutomationSettings => {
  if (!settings || typeof settings !== "object") {
    return { ...DEFAULT_LEAD_AUTOMATION_SETTINGS };
  }

  const strategy: LeadAssignmentStrategy = [
    "round_robin",
    "load_balanced",
    "manual",
  ].includes(settings.assignmentStrategy)
    ? settings.assignmentStrategy
    : DEFAULT_LEAD_AUTOMATION_SETTINGS.assignmentStrategy;

  const autoArchiveStatus = LEAD_STATUS_VALUES.includes(
    settings.autoArchiveStatus as LeadStatusValue
  )
    ? (settings.autoArchiveStatus as LeadStatusValue)
    : DEFAULT_LEAD_AUTOMATION_SETTINGS.autoArchiveStatus;

  return {
    autoAssignEnabled: Boolean(settings.autoAssignEnabled),
    assignmentStrategy: strategy,
    includeManagersInRotation: Boolean(settings.includeManagersInRotation),
    notifyAssignee: Boolean(settings.notifyAssignee),
    notifyManagerOnSkip: Boolean(settings.notifyManagerOnSkip),
    duplicateDetectionEnabled: Boolean(settings.duplicateDetectionEnabled),
    duplicateDetectionWindowHours:
      Number.isFinite(settings.duplicateDetectionWindowHours) && settings.duplicateDetectionWindowHours > 0
        ? Math.round(Number(settings.duplicateDetectionWindowHours))
        : DEFAULT_LEAD_AUTOMATION_SETTINGS.duplicateDetectionWindowHours,
    autoArchiveAfterDays:
      Number.isFinite(settings.autoArchiveAfterDays) && settings.autoArchiveAfterDays >= 0
        ? Math.round(Number(settings.autoArchiveAfterDays))
        : DEFAULT_LEAD_AUTOMATION_SETTINGS.autoArchiveAfterDays,
    autoArchiveStatus,
  } satisfies LeadAutomationSettings;
};

export const getLeadAutomationSettings = (options?: { skipCache?: boolean }) => {
  if (options?.skipCache) {
    cachedLeadAutomationSettings = null;
  }

  if (!cachedLeadAutomationSettings) {
    const stored = readStorage(
      LEAD_AUTOMATION_SETTINGS_STORAGE_KEY,
      DEFAULT_LEAD_AUTOMATION_SETTINGS
    );
    cachedLeadAutomationSettings = sanitizeAutomationSettings(stored);
  }

  return { ...cachedLeadAutomationSettings };
};

export const saveLeadAutomationSettings = (settings: LeadAutomationSettings) => {
  const sanitized = sanitizeAutomationSettings(settings);
  cachedLeadAutomationSettings = sanitized;
  writeStorage(LEAD_AUTOMATION_SETTINGS_STORAGE_KEY, sanitized);
  dispatchEvent(LEAD_AUTOMATION_SETTINGS_UPDATED_EVENT);
  return sanitized;
};

export const resetLeadAutomationSettings = () => {
  cachedLeadAutomationSettings = { ...DEFAULT_LEAD_AUTOMATION_SETTINGS };
  writeStorage(LEAD_AUTOMATION_SETTINGS_STORAGE_KEY, cachedLeadAutomationSettings);
  dispatchEvent(LEAD_AUTOMATION_SETTINGS_UPDATED_EVENT);
  return { ...cachedLeadAutomationSettings };
};

export const getLeadStatusColorFromSettings = (status: string) =>
  findLeadStatusSetting(status)?.color ?? DEFAULT_STATUS_COLOR;

export const getLeadStatusLabelFromSettings = (status: string) =>
  findLeadStatusSetting(status)?.label ?? status;

export const getLeadStatusDescription = (status: string) =>
  findLeadStatusSetting(status)?.description ?? "";

export const getLeadStatusFollowUpHours = (status: string) =>
  findLeadStatusSetting(status)?.followUpHours ?? 0;

export const getLeadStatusProbability = (status: string) =>
  findLeadStatusSetting(status)?.probability ?? undefined;

export const getLeadStatusBadgeStyle = (status: string) => {
  const hexColor = getLeadStatusColorFromSettings(status);
  return {
    backgroundColor: hexToRgba(hexColor, 0.12),
    color: hexColor,
    borderColor: hexToRgba(hexColor, 0.4),
  } as const;
};

export const getLeadSourceChannelLabel = (channel: LeadSourceChannel) => {
  switch (channel) {
    case "digital":
      return "Acquisition digitale";
    case "recommendation":
      return "Recommandation";
    case "partner":
      return "Partenaire";
    case "event":
      return "Événement";
    case "outbound":
      return "Prospection sortante";
    default:
      return "Autre";
  }
};

export const getLeadSourceChannelDescription = (channel: LeadSourceChannel) => {
  switch (channel) {
    case "digital":
      return "Campagnes en ligne, formulaires et inbound";
    case "recommendation":
      return "Parrainage, bouche à oreille, clients existants";
    case "partner":
      return "Apporteurs d'affaires, réseaux professionnels";
    case "event":
      return "Salons, foires, événements terrain";
    case "outbound":
      return "Téléprospection, phoning, porte-à-porte";
    default:
      return "Sources diverses ou non catégorisées";
  }
};

export const sortLeadStatusSettings = (settings: LeadStatusSetting[]) =>
  settings.slice().sort((a, b) => a.order - b.order);

export const sortLeadSources = (sources: LeadSourceSetting[]) =>
  sources.slice().sort((a, b) => a.name.localeCompare(b.name));

export const sortLeadDynamicFields = (fields: LeadDynamicFieldSetting[]) =>
  fields.slice().sort((a, b) => a.order - b.order);

