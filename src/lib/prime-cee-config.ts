import {
  getCategoryDefaultMultiplierKey,
  LEGACY_QUANTITY_KEY,
  resolveMultiplierKeyForCategory,
} from "./valorisation-formula";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s+/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toPositiveNumber = (value: unknown): number | null => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;
  return numeric > 0 ? numeric : null;
};

export const PRODUCT_CEE_CATEGORIES = [
  { value: "isolation", label: "Isolation" },
  { value: "heating", label: "Chauffage" },
  { value: "lighting", label: "Éclairage" },
  { value: "ventilation", label: "Ventilation" },
  { value: "other", label: "Autre" },
] as const;

export type ProductCeeCategory = (typeof PRODUCT_CEE_CATEGORIES)[number]["value"];

export type ProductCeeFormulaTemplateId = "standard" | "lighting-led" | "custom";

export type ProductCeeFormulaTemplate = {
  id: ProductCeeFormulaTemplateId;
  label: string;
  description: string;
  expression: string | null;
  allowedCategories?: ProductCeeCategory[] | null;
  requiresLedWattConstant?: boolean;
  isCustom?: boolean;
};

export const PRODUCT_CEE_FORMULA_TEMPLATES: ProductCeeFormulaTemplate[] = [
  {
    id: "standard",
    label: "Formule standard",
    description:
      "Utilise la formule CEE classique : (kWh cumac × bonification × coefficient) / 1000.",
    expression: null,
  },
  {
    id: "lighting-led",
    label: "Éclairage LED (BONUS_DOM × LED_WATT)",
    description:
      "Formule spécifique aux opérations d'éclairage : KWH_CUMAC × BONUS_DOM × LED_WATT / MWH_DIVISOR.",
    expression: "KWH_CUMAC * BONUS_DOM * LED_WATT / MWH_DIVISOR",
    allowedCategories: ["lighting"],
    requiresLedWattConstant: true,
  },
  {
    id: "custom",
    label: "Formule personnalisée",
    description:
      "Définissez votre propre formule en utilisant les variables disponibles (KWH_CUMAC, BONUS_DOM, LED_WATT, MWH_DIVISOR, BONIFICATION, COEFFICIENT).",
    expression: null,
    isCustom: true,
  },
];

export const getProductCeeFormulaTemplateById = (
  id: string | null | undefined,
): ProductCeeFormulaTemplate | undefined =>
  PRODUCT_CEE_FORMULA_TEMPLATES.find((template) => template.id === id);

export type ProductCeeConfig = {
  category: ProductCeeCategory;
  formulaTemplate: ProductCeeFormulaTemplateId;
  formulaExpression: string | null;
  primeMultiplierParam: string | null;
  primeMultiplierCoefficient: number | null;
  ledWattConstant: number | null;
};

const getDefaultMultiplierKey = (category: ProductCeeCategory) =>
  getCategoryDefaultMultiplierKey(category) ?? LEGACY_QUANTITY_KEY;

export const DEFAULT_PRODUCT_CEE_CONFIG: ProductCeeConfig = {
  category: "isolation",
  formulaTemplate: "standard",
  formulaExpression: null,
  primeMultiplierParam: getDefaultMultiplierKey("isolation"),
  primeMultiplierCoefficient: null,
  ledWattConstant: null,
};

const sanitizeMultiplierKey = (
  value: unknown,
  category: ProductCeeCategory,
): string | null => resolveMultiplierKeyForCategory(value, category);

export const normalizeProductCeeConfig = (value: unknown): ProductCeeConfig => {
  if (!isRecord(value)) {
    return { ...DEFAULT_PRODUCT_CEE_CONFIG };
  }

  const fromLegacyDefaults = isRecord(value.defaults) ? value.defaults : undefined;
  const legacyMultiplier = isRecord(fromLegacyDefaults?.multiplier)
    ? fromLegacyDefaults?.multiplier
    : undefined;

  const rawCategory =
    typeof value.category === "string"
      ? value.category
      : typeof value.category_key === "string"
        ? value.category_key
        : null;

  const category = PRODUCT_CEE_CATEGORIES.some((item) => item.value === rawCategory)
    ? (rawCategory as ProductCeeCategory)
    : DEFAULT_PRODUCT_CEE_CONFIG.category;

  const rawTemplate =
    typeof value.formulaTemplate === "string"
      ? value.formulaTemplate
      : typeof value.formula_template === "string"
        ? value.formula_template
        : null;

  const template =
    getProductCeeFormulaTemplateById(rawTemplate) ??
    getProductCeeFormulaTemplateById(DEFAULT_PRODUCT_CEE_CONFIG.formulaTemplate)!;

  const rawExpression =
    typeof value.formulaExpression === "string"
      ? value.formulaExpression
      : typeof value.formula_expression === "string"
        ? value.formula_expression
        : null;

  const expression = template.isCustom
    ? rawExpression && rawExpression.trim().length > 0
      ? rawExpression.trim()
      : null
    : template.expression ?? null;

  const defaultMultiplierKey = getDefaultMultiplierKey(category);
  const rawMultiplier =
    sanitizeMultiplierKey(
      value.primeMultiplierParam ?? value.prime_multiplier_param,
      category,
    ) ?? sanitizeMultiplierKey(legacyMultiplier?.key, category);

  const multiplierParam = rawMultiplier ?? defaultMultiplierKey;

  const multiplierCoefficient =
    toPositiveNumber(
      value.primeMultiplierCoefficient ??
        value.prime_multiplier_coefficient ??
        legacyMultiplier?.coefficient,
    ) ?? DEFAULT_PRODUCT_CEE_CONFIG.primeMultiplierCoefficient;

  const rawLedWatt =
    toPositiveNumber(value.ledWattConstant ?? value.led_watt_constant) ??
    toPositiveNumber(fromLegacyDefaults?.led_watt_constant);

  const ledWattConstant = category === "lighting" ? rawLedWatt ?? null : null;

  return {
    category,
    formulaTemplate: template.id,
    formulaExpression: expression,
    primeMultiplierParam: multiplierParam,
    primeMultiplierCoefficient: multiplierCoefficient,
    ledWattConstant,
  };
};

export const formatProductCeeMultiplierLabel = (
  label: string,
  coefficient: number | null,
): string => {
  if (!coefficient || !Number.isFinite(coefficient) || coefficient === 1) {
    return label;
  }
  return `${label} × ${
    Number.isInteger(coefficient) ? coefficient.toString() : coefficient.toFixed(2).replace(/\.00$/, "")
  }`;
};


