import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import {
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import {
  ADDITIONAL_COST_TVA_RATES,
  computeAdditionalCostTTC,
  createSiteSchema,
  defaultSiteFormValues,
  normalizeAdditionalCostTvaRate,
  normalizeAdditionalCostsArray,
  type SiteFormValues,
  type SiteSubmitValues,
} from "@/components/sites/siteFormSchema";
import {
  TRAVAUX_NON_SUBVENTIONNES_OPTIONS,
  normalizeTravauxNonSubventionnesValue,
} from "@/components/sites/travauxNonSubventionnes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DriveMultiFileUploader } from "@/components/integrations/DriveMultiFileUploader";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { calculateRentability, buildRentabilityInputFromSite, isLedProduct, calculateCategoryRentability } from "@/lib/rentability";
import {
  calcEclairageHT,
  calcEclairageTTC,
  calcIsolationHT,
  calcIsolationTTC,
  formatEuro,
  type EclairageRentabiliteInput,
  type IsolationRentabiliteInput,
} from "@/lib/rentabilite";
import { getProjectStatusBadgeStyle, deriveProjectCategory } from "@/lib/projects";
import { parseSiteNotes, serializeSiteNotes, type SiteNoteAttachment } from "@/lib/sites";
import { cn } from "@/lib/utils";
import { ClipboardList, Loader2, Lock, Info, Save } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

type SiteWithProject = Tables<"sites"> & {
  project: (Tables<"projects"> & {
    lead?: Pick<Tables<"leads">, "email" | "phone_raw"> | null;
  }) | null;
  subcontractor?: Pick<Tables<"subcontractors">, "id" | "name"> | null;
};

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDecimal = (value: number) => decimalFormatter.format(value);
const formatPercent = (value: number) => percentFormatter.format(value);
const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
};

const sanitizeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const numbersAreClose = (a: number, b: number) => Math.abs(a - b) < 0.005;

const getStatusGradient = (marginRate: number) => {
  if (marginRate >= 0) {
    return "border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent";
  }
  return "border-destructive/60 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent";
};

const COMPLETED_PROJECT_STATUS_VALUES = new Set([
  "CHANTIER_TERMINE",
  "LIVRE",
  "FACTURE_ENVOYEE",
  "AH",
  "AAF",
  "CLOTURE",
  "TERMINE",
]);

interface ChantierDetailsFormProps {
  chantier: SiteWithProject;
  orgId: string | null;
  embedded?: boolean;
  onUpdate?: () => void;
}

export const ChantierDetailsForm = ({ chantier, orgId, embedded = false, onUpdate }: ChantierDetailsFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { statuses: statusOptions } = useProjectStatuses();
  const [siteAttachments, setSiteAttachments] = useState<SiteNoteAttachment[]>([]);
  
  // HT/TTC toggle state (persisted in URL)
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") === "ttc" ? "ttc" : "ht";

  const toggleViewMode = () => {
    const newMode = viewMode === "ht" ? "ttc" : "ht";
    const newParams = new URLSearchParams(searchParams);
    newParams.set("view", newMode);
    setSearchParams(newParams);
  };

  const resolver = useMemo(() => zodResolver(createSiteSchema(false)), []);

  const form = useForm<SiteFormValues>({
    resolver,
    defaultValues: defaultSiteFormValues,
    mode: "onChange",
  });

  const { control, reset, handleSubmit, formState } = form;
  const watchedTravauxEnabled = useWatch({ control, name: "travaux_non_subventionnes_enabled" });
  const watchedTravaux = useWatch({ control, name: "travaux_non_subventionnes" });
  const watchedProductName = useWatch({ control, name: "product_name" });
  const watchedSurfaceFacturee = useWatch({ control, name: "surface_facturee_m2" });
  const watchedSurfacePosee = useWatch({ control, name: "surface_posee_m2" });
  const watchedCoutIsolant = useWatch({ control, name: "cout_isolant_par_m2" });
  const watchedTravauxMontant = useWatch({ control, name: "travaux_non_subventionnes_montant" });
  
  const rentabilityWatch = useWatch({
    control,
    name: [
      "cout_main_oeuvre_m2_ht",
      "cout_isolation_m2",
      "isolation_utilisee_m2",
      "surface_facturee",
      "travaux_non_subventionnes",
      "travaux_non_subventionnes_enabled",
      "travaux_non_subventionnes_montant",
      "product_name",
      "additional_costs",
      "commission_eur_per_m2_enabled",
      "commission_eur_per_m2",
      "commission_eur_per_led_enabled",
      "commission_eur_per_led",
      "subcontractor_id",
      "subcontractor_payment_confirmed",
      "subcontractor_base_units",
      "subcontractor_payment_amount",
      "subcontractor_payment_units",
      "subcontractor_payment_rate",
      "subcontractor_payment_unit_label",
      "surface_facturee_m2",
      "surface_posee_m2",
      "cout_mo_par_m2",
      "cout_isolant_par_m2",
      "cout_materiaux_par_m2",
      "cout_total_materiaux",
      "commission_commerciale_par_m2",
      "nb_luminaires",
      "cout_total_mo",
      "cout_total_materiaux_eclairage",
      "travaux_non_subventionnes_client",
      "tva_rate",
      "frais_additionnels_total",
    ],
  });
  const watchedAdditionalCosts = useWatch({ control, name: "additional_costs" });

  const { fields: costFields, append: appendCost, remove: removeCost } = useFieldArray({
    control,
    name: "additional_costs",
  });

  useEffect(() => {
    if (!Array.isArray(watchedAdditionalCosts)) return;

    watchedAdditionalCosts.forEach((cost, index) => {
      const amountHT =
        cost && typeof cost.amount_ht === "number" && Number.isFinite(cost.amount_ht)
          ? cost.amount_ht
          : 0;
      const tvaRate = normalizeAdditionalCostTvaRate(cost?.tva_rate, 8.5);
      const computedTTC = computeAdditionalCostTTC(amountHT, tvaRate);
      const currentValue = form.getValues(`additional_costs.${index}.amount_ttc`);
      const normalizedCurrent =
        typeof currentValue === "number" && Number.isFinite(currentValue) ? currentValue : 0;

      if (Math.abs(normalizedCurrent - computedTTC) > 0.005) {
        form.setValue(`additional_costs.${index}.amount_ttc`, computedTTC, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    });
  }, [form, watchedAdditionalCosts]);

  const subcontractorsQuery = useQuery<{ id: string; name: string; pricing_details: string | null }[]>({
    queryKey: ["subcontractors", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id,name,pricing_details")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const project = chantier?.project ?? null;
  const projectStatusValue = project?.status ?? null;
  
  // Allow editing for chantier and post-completion statuses
  const EDITABLE_STATUSES = [
    "CHANTIER_PLANIFIE",
    "CHANTIER_EN_COURS", 
    "CHANTIER_TERMINE",
    "LIVRE",
    "FACTURE_ENVOYEE",
    "AH",
    "AAF",
    "CLOTURE"
  ];
  const isEditingLocked = projectStatusValue ? !EDITABLE_STATUSES.includes(projectStatusValue) : true;
  
  // Use the same category detection logic as the Projects list
  const projectCategory = deriveProjectCategory(project ?? {});
  const isEclairage = projectCategory === "EQ";
  const projectStatusConfig = useMemo(
    () =>
      projectStatusValue
        ? statusOptions.find((option) => option.value === projectStatusValue) ?? null
        : null,
    [projectStatusValue, statusOptions],
  );
  const projectStatusLabel = projectStatusConfig?.label ?? projectStatusValue ?? "Statut non défini";
  const projectStatusBadgeStyle = getProjectStatusBadgeStyle(projectStatusConfig?.color);
  const isProjectCompleted = projectStatusValue
    ? COMPLETED_PROJECT_STATUS_VALUES.has(projectStatusValue)
    : false;
  const parsedNotes = useMemo(() => parseSiteNotes(chantier?.notes), [chantier?.notes]);

  useEffect(() => {
    if (!chantier) return;
    const defaults: Partial<SiteFormValues> = {
      ...defaultSiteFormValues,
      site_ref: chantier.site_ref,
      project_ref: chantier.project_ref ?? project?.project_ref ?? "",
      client_name: chantier.client_name ?? project?.client_name ?? "",
      product_name: chantier.product_name ?? project?.product_name ?? "",
      address: chantier.address,
      city: chantier.city,
      postal_code: chantier.postal_code,
      cofrac_status: chantier.cofrac_status as "EN_ATTENTE" | "CONFORME" | "NON_CONFORME" | "A_PLANIFIER",
      date_debut: chantier.date_debut,
      date_fin_prevue: chantier.date_fin_prevue ?? "",
      progress_percentage: chantier.progress_percentage ?? 0,
      revenue: sanitizeNumber(chantier.revenue),
      profit_margin: sanitizeNumber(chantier.profit_margin),
      surface_facturee: sanitizeNumber(chantier.surface_facturee),
      cout_main_oeuvre_m2_ht: sanitizeNumber(chantier.cout_main_oeuvre_m2_ht),
      cout_isolation_m2: sanitizeNumber(chantier.cout_isolation_m2),
      isolation_utilisee_m2: sanitizeNumber(chantier.isolation_utilisee_m2),
      montant_commission: sanitizeNumber(chantier.montant_commission),
      commission_eur_per_m2_enabled: Boolean(
        chantier.commission_eur_per_m2_enabled ?? chantier.commission_commerciale_par_m2,
      ),
      commission_eur_per_m2: sanitizeNumber(
        chantier.commission_eur_per_m2 ?? chantier.commission_commerciale_par_m2,
      ),
      valorisation_cee: sanitizeNumber(chantier.valorisation_cee),
      subcontractor_id: chantier.subcontractor_id ?? null,
      subcontractor_payment_confirmed: Boolean(chantier.subcontractor_payment_confirmed),
      travaux_non_subventionnes_enabled: Boolean(
        chantier.travaux_non_subventionnes && 
        chantier.travaux_non_subventionnes !== "NA"
      ),
      travaux_non_subventionnes: normalizeTravauxNonSubventionnesValue(
        chantier.travaux_non_subventionnes,
      ),
      travaux_non_subventionnes_montant: sanitizeNumber(chantier.travaux_non_subventionnes_montant),
      notes: parsedNotes.text ?? "",
      additional_costs: normalizeAdditionalCostsArray(chantier.additional_costs ?? []),
      // Isolation fields - use correct column names
      surface_facturee_m2: sanitizeNumber(chantier.surface_facturee_m2),
      surface_posee_m2: sanitizeNumber(chantier.surface_posee_m2),
      cout_mo_par_m2: sanitizeNumber(chantier.cout_mo_par_m2),
      cout_isolant_par_m2: sanitizeNumber(chantier.cout_isolant_par_m2),
      cout_materiaux_par_m2: sanitizeNumber(chantier.cout_materiaux_par_m2),
      cout_total_materiaux: sanitizeNumber(chantier.cout_total_materiaux),
      commission_commerciale_par_m2: sanitizeNumber(chantier.commission_commerciale_par_m2),
      // Éclairage fields - provide 0 default if this is an Éclairage project
      nb_luminaires: isEclairage 
        ? (chantier.nb_luminaires !== null ? sanitizeNumber(chantier.nb_luminaires) : 0)
        : sanitizeNumber(chantier.nb_luminaires),
      cout_total_mo: isEclairage 
        ? (chantier.cout_total_mo !== null ? sanitizeNumber(chantier.cout_total_mo) : 0)
        : sanitizeNumber(chantier.cout_total_mo),
      cout_total_materiaux_eclairage: isEclairage 
        ? (chantier.cout_total_materiaux_eclairage !== null ? sanitizeNumber(chantier.cout_total_materiaux_eclairage) : 0)
        : sanitizeNumber(chantier.cout_total_materiaux_eclairage),
    };
    reset(defaults, { keepDefaultValues: false });
    setSiteAttachments(parsedNotes.attachments);
  }, [
    chantier,
    parsedNotes.attachments,
    parsedNotes.text,
    project?.client_name,
    project?.product_name,
    project?.project_ref,
    reset,
    isEclairage,
  ]);

  const rentabilityMetrics = useMemo(() => {
    const values = rentabilityWatch ?? [];
    const laborCost = values[0] as number | undefined;
    const materialCost = values[1] as number | undefined;
    const isolationUsed = values[2] as number | undefined;
    const surfaceFacturee = values[3] as number | undefined;
    const travauxChoice = values[4] as SiteFormValues["travaux_non_subventionnes"] | undefined;
    const travauxEnabled = values[5] as boolean | undefined;
    const travauxMontant = values[6] as number | undefined;
    const productName = values[7] as string | undefined;
    const additionalCosts = values[8] as SiteFormValues["additional_costs"] | undefined;
    const commissionPerM2Enabled = values[9] as boolean | undefined;
    const commissionPerM2 = values[10] as number | undefined;
    const commissionPerLedEnabled = values[11] as boolean | undefined;
    const commissionPerLed = values[12] as number | undefined;
    const subcontractorId = values[13] as string | undefined;
    const subcontractorPaymentConfirmed = values[14] as boolean | undefined;
    const subcontractorBaseUnits = values[15] as number | undefined;
    const subcontractorPaymentAmount = values[16] as number | undefined;
    const subcontractorPaymentUnits = values[17] as number | undefined;
    const subcontractorPaymentRate = values[18] as number | undefined;
    const subcontractorPaymentUnitLabel = values[19] as string | undefined;

    // Get calculated values from form
    const revenue = sanitizeNumber(form.getValues("revenue"));
    const commission = sanitizeNumber(form.getValues("montant_commission"));
    const valorisationCee = sanitizeNumber(form.getValues("valorisation_cee"));

    const normalizedAdditionalCosts = Array.isArray(additionalCosts)
      ? additionalCosts.map((cost) => {
          const amountHT = sanitizeNumber(cost?.amount_ht);
          const tvaRate = normalizeAdditionalCostTvaRate(cost?.tva_rate, 8.5);
          const amountTTC = computeAdditionalCostTTC(amountHT, tvaRate);
          const taxes = Math.max(0, amountTTC - amountHT);
          return {
            amount_ht: amountHT,
            taxes,
            tva_rate: tvaRate,
            amount_ttc: amountTTC,
          };
        })
      : [];

    const selectedSubcontractor = (subcontractorsQuery.data ?? []).find(
      (option) => option.id === (subcontractorId ?? form.getValues("subcontractor_id")),
    );
    const subcontractorRate = (() => {
      if (!selectedSubcontractor) return undefined;
      const raw = selectedSubcontractor.pricing_details;
      if (typeof raw === "number") return raw;
      if (typeof raw === "string") {
        const normalized = raw.replace(/,/g, ".").trim();
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    })();

    const rentabilityInput = buildRentabilityInputFromSite({
      revenue: sanitizeNumber(revenue),
      cout_main_oeuvre_m2_ht: sanitizeNumber(laborCost),
      cout_isolation_m2: sanitizeNumber(materialCost),
      isolation_utilisee_m2: sanitizeNumber(isolationUsed),
      surface_facturee: sanitizeNumber(surfaceFacturee),
      montant_commission: sanitizeNumber(commission),
      travaux_non_subventionnes: (travauxChoice ?? "NA") as SiteFormValues["travaux_non_subventionnes"],
      travaux_non_subventionnes_montant: sanitizeNumber(travauxMontant),
      additional_costs: normalizedAdditionalCosts,
      product_name: productName,
      valorisation_cee: sanitizeNumber(valorisationCee),
      commission_eur_per_m2_enabled: commissionPerM2Enabled,
      commission_eur_per_m2: sanitizeNumber(commissionPerM2),
      subcontractor_pricing_details: subcontractorRate,
      subcontractor_payment_confirmed: Boolean(subcontractorPaymentConfirmed),
      subcontractor_base_units: sanitizeNumber(subcontractorBaseUnits),
      subcontractor_payment_amount: sanitizeNumber(subcontractorPaymentAmount),
      subcontractor_payment_units: sanitizeNumber(subcontractorPaymentUnits),
      subcontractor_payment_rate: sanitizeNumber(subcontractorPaymentRate),
      subcontractor_payment_unit_label: subcontractorPaymentUnitLabel,
      project_prime_cee: project?.prime_cee ?? undefined,
      project_prime_cee_total_cents: project?.prime_cee_total_cents ?? undefined,
      project_category: project?.product_name ?? chantier?.product_name ?? undefined,
    });

    return calculateRentability(rentabilityInput);
  }, [rentabilityWatch, subcontractorsQuery.data, project?.prime_cee, project?.prime_cee_total_cents, project?.product_name, chantier?.product_name, form]);

  const subcontractorAmountDisplay = rentabilityMetrics.subcontractorEstimatedCost > 0
    ? formatCurrency(rentabilityMetrics.subcontractorEstimatedCost)
    : "—";
  const subcontractorUnitsDisplay = rentabilityMetrics.subcontractorBaseUnits > 0
    ? `${formatDecimal(rentabilityMetrics.subcontractorBaseUnits)} ${rentabilityMetrics.unitLabel}`
    : `— ${rentabilityMetrics.unitLabel}`;
  const subcontractorRateDisplay = rentabilityMetrics.subcontractorRate > 0
    ? `${formatCurrency(rentabilityMetrics.subcontractorRate)} / ${rentabilityMetrics.unitLabel}`
    : null;

  useEffect(() => {
    const updateNumericField = (
      name:
        | "subcontractor_base_units"
        | "subcontractor_payment_units"
        | "subcontractor_payment_amount"
        | "subcontractor_payment_rate",
      value: number,
    ) => {
      const current = sanitizeNumber(form.getValues(name));
      if (!numbersAreClose(current, value)) {
        form.setValue(name, value, { shouldDirty: true, shouldValidate: false });
      }
    };

    updateNumericField("subcontractor_base_units", rentabilityMetrics.subcontractorBaseUnits);
    updateNumericField("subcontractor_payment_units", rentabilityMetrics.subcontractorBaseUnits);
    updateNumericField("subcontractor_payment_amount", rentabilityMetrics.subcontractorEstimatedCost);
    updateNumericField("subcontractor_payment_rate", rentabilityMetrics.subcontractorRate);

    const currentLabel = form.getValues("subcontractor_payment_unit_label") ?? "";
    const nextLabel = rentabilityMetrics.unitLabel ?? "";
    if (typeof currentLabel !== "string" || currentLabel.trim() !== nextLabel) {
      form.setValue("subcontractor_payment_unit_label", nextLabel, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [form, rentabilityMetrics]);

  const updateMutation = useMutation({
    mutationFn: async (payload: SiteSubmitValues) => {
      if (!chantier || !user?.id) return;
      
      // Remove UI-only fields that don't exist in the database
      const { 
        commission_eur_per_m2_enabled, 
        commission_eur_per_m2, 
        cout_total_materiaux_eclairage,
        subcontractor_base_units,
        subcontractor_payment_amount,
        subcontractor_payment_units,
        subcontractor_payment_unit_label,
        subcontractor_payment_rate,
        travaux_non_subventionnes_description,
        travaux_non_subventionnes_financement,
        travaux_non_subventionnes_enabled,
        ...rest 
      } = payload;
      
      const updatePayload: Partial<Tables<"sites">> = {
        ...rest,
        team_members: rest.team_members?.map(m => m.id) ?? [],
        // Ensure cout_total_materiaux is used for both categories
        cout_total_materiaux: payload.cout_total_materiaux ?? payload.cout_total_materiaux_eclairage ?? null,
      };
      
      const { error } = await supabase
        .from("sites")
        .update(updatePayload)
        .eq("id", chantier.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Chantier mis à jour", description: "Les informations ont été enregistrées." });
      onUpdate?.();
    },
    onError: (error) => {
      console.error("Erreur mise à jour chantier", error);
      toast({ title: "Mise à jour impossible", description: "Veuillez vérifier le formulaire.", variant: "destructive" });
    },
  });
  const { mutate: mutateSite, isPending: isUpdating } = updateMutation;

  const handleFormSubmit = useCallback(
    (values: SiteFormValues) => {
      if (!chantier || !user?.id) return;
      if (isEditingLocked) return;
      if (isUpdating) return;
      if (!formState.isDirty) return;
      const filteredCosts = (values.additional_costs ?? [])
        .filter((cost) => cost.label.trim().length > 0)
        .map((cost) => {
          const amountHT = sanitizeNumber(cost.amount_ht);
          const tvaRate = normalizeAdditionalCostTvaRate(cost.tva_rate, 8.5);
          const amountTTC = computeAdditionalCostTTC(amountHT, tvaRate);
          const montantTVA = Math.max(0, amountTTC - amountHT);
          const attachment = cost.attachment?.trim() ?? "";
          return {
            label: cost.label.trim(),
            amount_ht: amountHT,
            tva_rate: tvaRate,
            montant_tva: montantTVA,
            amount_ttc: amountTTC,
            attachment: attachment.length > 0 ? attachment : null,
          };
        });

    const travauxChoice = values.travaux_non_subventionnes ?? "NA";
    const shouldResetTravaux = travauxChoice === "NA";
    const travauxDescription = shouldResetTravaux ? "" : values.travaux_non_subventionnes_description?.trim() ?? "";
    const travauxMontant = shouldResetTravaux ? 0 : sanitizeNumber(values.travaux_non_subventionnes_montant);
    const travauxFinancement = shouldResetTravaux ? false : Boolean(values.travaux_non_subventionnes_financement);
    const commissionPerM2Enabled = Boolean(values.commission_eur_per_m2_enabled);
    const commissionPerM2Value = commissionPerM2Enabled
      ? sanitizeNumber(values.commission_eur_per_m2)
      : 0;

    const selectedSubcontractor = (subcontractorsQuery.data ?? []).find(
      (option) => option.id === values.subcontractor_id,
    );
    const subcontractorRate = (() => {
      if (!selectedSubcontractor) return undefined;
      const raw = selectedSubcontractor.pricing_details;
      if (typeof raw === "number") return raw;
      if (typeof raw === "string") {
        const normalized = raw.replace(/,/g, ".").trim();
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    })();

    const rentabilityResult = calculateRentability(
      buildRentabilityInputFromSite({
        ...values,
        valorisation_cee: values.valorisation_cee,
        additional_costs: filteredCosts,
        project_prime_cee: project?.prime_cee ?? undefined,
        project_prime_cee_total_cents: project?.prime_cee_total_cents ?? undefined,
        project_category: project?.product_name ?? values.product_name ?? undefined,
        subcontractor_pricing_details: subcontractorRate,
      }),
    );
    
    // Use the same category detection logic as the form display
    const projectCategory = deriveProjectCategory(project ?? {});
    const isEclairageProduct = projectCategory === "EQ";
    
    // Common values
    const primeCee = sanitizeNumber(
      (chantier?.valorisation_cee && chantier.valorisation_cee > 0) 
        ? chantier.valorisation_cee 
        : project?.prime_cee
    );
    const travauxClient = sanitizeNumber(values.travaux_non_subventionnes_client);
    const fraisAdditionnels = sanitizeNumber(rentabilityResult.additionalCostsTotal);
    const tvaRateValue = sanitizeNumber(values.tva_rate);
    
    // Isolation raw fields (with guards)
    const surfaceFactureeM2 = sanitizeNumber(values.surface_facturee_m2);
    const surfacePoseeM2 = surfaceFactureeM2 > 0 ? sanitizeNumber(values.surface_posee_m2) : 0;
    const coutMoParM2 = surfaceFactureeM2 > 0 ? sanitizeNumber(values.cout_mo_par_m2) : 0;
    const coutIsolantParM2 = surfaceFactureeM2 > 0 ? sanitizeNumber(values.cout_isolant_par_m2) : 0;
    const coutMateriauxParM2 = surfaceFactureeM2 > 0 ? sanitizeNumber(values.cout_materiaux_par_m2) : 0;
    const coutTotalMateriaux = surfaceFactureeM2 > 0 ? sanitizeNumber(values.cout_total_materiaux) : 0;
    const commissionCommerciale = surfaceFactureeM2 > 0 && commissionPerM2Enabled ? commissionPerM2Value : 0;
    
    // Éclairage raw fields (with guards)
    const nbLuminaires = sanitizeNumber(values.nb_luminaires);
    const coutTotalMo = nbLuminaires > 0 ? sanitizeNumber(values.cout_total_mo) : 0;
    const coutTotalMateriauxEclairage = nbLuminaires > 0 ? sanitizeNumber(values.cout_total_materiaux_eclairage) : 0;
    
    // Calculate category-based snapshots with guarded values
    const categorySnapshots = calculateCategoryRentability({
      category: isEclairageProduct ? "Eclairage" : "Isolation",
      prime_cee: primeCee,
      travaux_non_subventionnes_client: travauxClient,
      frais_additionnels_total: fraisAdditionnels,
      // Isolation fields (guarded)
      surface_facturee_m2: surfaceFactureeM2,
      cout_mo_par_m2: coutMoParM2,
      cout_total_materiaux: coutTotalMateriaux,
      commission_commerciale_par_m2: commissionCommerciale,
      commission_enabled: commissionPerM2Enabled && surfaceFactureeM2 > 0,
      // Éclairage fields (guarded)
      nb_luminaires: nbLuminaires,
      cout_total_mo: coutTotalMo,
      cout_total_materiaux_eclairage: coutTotalMateriauxEclairage,
    });

      const serializedNotes = serializeSiteNotes(values.notes, siteAttachments[0]?.file ?? null, siteAttachments);

      const payload: SiteSubmitValues = {
        ...values,
        project_ref: values.project_ref?.trim() ?? chantier.project_ref ?? "",
        client_name: values.client_name?.trim() ?? chantier.client_name ?? "",
        subcontractor_id: values.subcontractor_id ?? null,
      additional_costs: filteredCosts,
      notes: serializedNotes,
      travaux_non_subventionnes: travauxChoice,
      travaux_non_subventionnes_description: travauxDescription,
      travaux_non_subventionnes_montant: travauxMontant,
      travaux_non_subventionnes_financement: travauxFinancement,
      commission_eur_per_m2_enabled: commissionPerM2Enabled,
      commission_eur_per_m2: commissionPerM2Value,
      
      // Common financial fields
      travaux_non_subventionnes_client: travauxClient,
      tva_rate: tvaRateValue,
      frais_additionnels_total: fraisAdditionnels,
      
      // Category-specific raw fields (null for non-applicable)
      ...(isEclairageProduct ? {
        // Éclairage: save éclairage fields, null out isolation fields
        nb_luminaires: nbLuminaires,
        cout_total_mo: coutTotalMo,
        cout_total_materiaux_eclairage: coutTotalMateriauxEclairage,
        cout_total_materiaux: coutTotalMateriauxEclairage,
        surface_facturee_m2: null,
        surface_posee_m2: null,
        cout_mo_par_m2: null,
        cout_isolant_par_m2: null,
        cout_materiaux_par_m2: null,
        commission_commerciale_par_m2: null,
      } : {
        // Isolation: save isolation fields, null out éclairage fields
        surface_facturee_m2: surfaceFactureeM2,
        surface_posee_m2: surfacePoseeM2,
        cout_mo_par_m2: coutMoParM2,
        cout_isolant_par_m2: coutIsolantParM2,
        cout_materiaux_par_m2: coutMateriauxParM2,
        cout_total_materiaux: coutTotalMateriaux,
        commission_commerciale_par_m2: commissionCommerciale,
        nb_luminaires: null,
        cout_total_mo: null,
        cout_total_materiaux_eclairage: null,
      }),
      
      // Legacy rentability (keep for backward compatibility)
      profit_margin: rentabilityResult.marginRate,
      rentability_total_costs: rentabilityResult.totalCosts,
      rentability_margin_total: rentabilityResult.marginTotal,
      rentability_margin_per_unit: rentabilityResult.marginPerUnit,
      rentability_margin_rate: rentabilityResult.marginRate,
      rentability_unit_label: rentabilityResult.unitLabel,
      rentability_additional_costs_total: rentabilityResult.additionalCostsTotal,
      subcontractor_payment_amount: rentabilityResult.subcontractorEstimatedCost,
      subcontractor_payment_units: rentabilityResult.subcontractorBaseUnits,
      subcontractor_payment_unit_label: rentabilityResult.unitLabel,
      subcontractor_payment_rate: rentabilityResult.subcontractorRate,
      subcontractor_base_units: rentabilityResult.subcontractorBaseUnits,
      
      // Snapshot totals (TTC only) for instant dashboard KPIs
      ca_ttc: categorySnapshots.ca_ttc,
      cout_chantier_ttc: categorySnapshots.cout_chantier_ttc,
      marge_totale_ttc: categorySnapshots.marge_totale_ttc,
    };

      mutateSite(payload);
    },
    [
      chantier,
      formState.isDirty,
      isEditingLocked,
      isUpdating,
      siteAttachments,
      mutateSite,
      user?.id,
      subcontractorsQuery.data,
      project,
    ],
  );

  const handleBlurSave = useCallback(() => {
    if (isEditingLocked) return;
    void form.handleSubmit(handleFormSubmit)();
  }, [form, handleFormSubmit, isEditingLocked]);

  // Auto-compute isolation derived fields (can be manually overridden)
  useEffect(() => {
    if (isEclairage) return;
    
    const surfaceFacturee = sanitizeNumber(watchedSurfaceFacturee);
    const surfacePosee = sanitizeNumber(watchedSurfacePosee);
    const coutIsolant = sanitizeNumber(watchedCoutIsolant);
    
    if (surfaceFacturee > 0) {
      const coutMateriauxParM2 = (surfacePosee * coutIsolant) / surfaceFacturee;
      const coutTotalMateriaux = coutMateriauxParM2 * surfaceFacturee;
      
      const currentMat = sanitizeNumber(form.getValues("cout_materiaux_par_m2"));
      const currentTotal = sanitizeNumber(form.getValues("cout_total_materiaux"));
      
      if (!numbersAreClose(currentMat, coutMateriauxParM2)) {
        form.setValue("cout_materiaux_par_m2", coutMateriauxParM2, { shouldDirty: true });
      }
      if (!numbersAreClose(currentTotal, coutTotalMateriaux)) {
        form.setValue("cout_total_materiaux", coutTotalMateriaux, { shouldDirty: true });
      }
    } else {
      form.setValue("cout_materiaux_par_m2", 0, { shouldDirty: true });
      form.setValue("cout_total_materiaux", 0, { shouldDirty: true });
    }
  }, [watchedSurfaceFacturee, watchedSurfacePosee, watchedCoutIsolant, isEclairage, form]);

  // Auto-calculate travaux_non_subventionnes_client based on checkbox and type
  useEffect(() => {
    const travauxClient = (watchedTravauxEnabled && watchedTravaux !== "NA")
      ? sanitizeNumber(watchedTravauxMontant) 
      : 0;
    
    const currentValue = sanitizeNumber(form.getValues("travaux_non_subventionnes_client"));
    if (!numbersAreClose(currentValue, travauxClient)) {
      form.setValue("travaux_non_subventionnes_client", travauxClient, { shouldDirty: true });
    }
  }, [watchedTravauxEnabled, watchedTravaux, watchedTravauxMontant, form]);

  const disableInputs = isEditingLocked || isUpdating;

  const marginRate = rentabilityMetrics.marginRate ?? 0;
  const marginTotal = rentabilityMetrics.marginTotal ?? 0;
  const marginPerUnit = rentabilityMetrics.marginPerUnit ?? 0;
  const rentabilityBorder = getStatusGradient(marginRate);
  
  // New HT/TTC calculation
  const categoryRentability = useMemo(() => {
    const primeCee = sanitizeNumber(
      (chantier?.valorisation_cee && chantier.valorisation_cee > 0) 
        ? chantier.valorisation_cee 
        : project?.prime_cee
    );
    
    const travauxClient = (watchedTravauxEnabled && watchedTravaux !== "NA")
      ? sanitizeNumber(watchedTravauxMontant) 
      : 0;
    
    // Get additional costs array
    const additionalCosts = (form.getValues("additional_costs") ?? []).map(cost => ({
      amount_ht: sanitizeNumber(cost.amount_ht),
      amount_ttc: sanitizeNumber(cost.amount_ttc),
    }));
    
    if (isEclairage) {
      const nbLuminaires = sanitizeNumber(form.getValues("nb_luminaires"));
      const commissionPerLed = sanitizeNumber(form.getValues("commission_eur_per_led"));
      const commissionEnabled = Boolean(form.getValues("commission_eur_per_led_enabled"));

      const input: EclairageRentabiliteInput = {
        primeCEE_TTC: primeCee,
        travauxNonSubv_HT: travauxClient,
        MO_HT: sanitizeNumber(form.getValues("cout_total_mo")),
        MAT_HT: sanitizeNumber(form.getValues("cout_total_materiaux_eclairage")),
        commission_HT: commissionEnabled ? commissionPerLed * nbLuminaires : 0,
        nbLuminaires: nbLuminaires,
        fraisAdditionnels: additionalCosts,
      };
      
      return viewMode === "ht" ? calcEclairageHT(input) : calcEclairageTTC(input);
    } else {
      // Isolation
      const surfaceFacturee = sanitizeNumber(form.getValues("surface_facturee_m2"));
      const surfacePosee = sanitizeNumber(form.getValues("surface_posee_m2"));
      const moPerM2 = sanitizeNumber(form.getValues("cout_mo_par_m2"));
      const commissionPerM2 = sanitizeNumber(form.getValues("commission_commerciale_par_m2"));
      const commissionEnabled = Boolean(form.getValues("commission_eur_per_m2_enabled"));
      
      const input: IsolationRentabiliteInput = {
        primeCEE_TTC: primeCee,
        travauxNonSubv_HT: travauxClient,
        surface_facturee_m2: surfaceFacturee,
        surface_posee_m2: surfacePosee,
        MO_HT_per_m2: moPerM2,
        MAT_HT: sanitizeNumber(form.getValues("cout_total_materiaux")),
        commission_HT: commissionEnabled ? commissionPerM2 * surfaceFacturee : 0,
        fraisAdditionnels: additionalCosts,
      };
      
      return viewMode === "ht" ? calcIsolationHT(input) : calcIsolationTTC(input);
    }
  }, [
    isEclairage, 
    viewMode, 
    watchedTravauxEnabled, 
    watchedTravaux, 
    watchedTravauxMontant,
    chantier?.valorisation_cee, 
    project?.prime_cee, 
    form,
    rentabilityWatch
  ]);

  // Live recompute for Éclairage changes
  useEffect(() => {
    if (!isEclairage) return;
    
    const subscription = form.watch((values, { name }) => {
      const relevantFields = [
        'nb_luminaires',
        'cout_total_mo',
        'cout_total_materiaux_eclairage',
        'travaux_non_subventionnes_client',
        'tva_rate',
        'frais_additionnels_total',
        'valorisation_cee',
      ];
      
      if (!name || !relevantFields.includes(name)) return;
      
      // Trigger recalculation by forcing rentabilityWatch update
      // The useMemo for categoryRentability will automatically recalculate
    });
    
    return () => subscription.unsubscribe();
  }, [isEclairage, form]);

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="space-y-6">
            {isEditingLocked ? (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Chantier Terminé</p>
                </div>
              </div>
            ) : null}
            {!isEditingLocked && isUpdating ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Enregistrement en cours…</span>
              </div>
            ) : null}
            <Card className="border border-dashed">
              <CardHeader>
                <CardTitle>Statut & conformité</CardTitle>
                <CardDescription>Consultez le statut du projet et mettez à jour le suivi COFRAC.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut projet</p>
                      <p className="text-sm font-medium text-foreground">{projectStatusLabel}</p>
                    </div>
                    <Badge variant="outline" style={projectStatusBadgeStyle}>
                      {projectStatusLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Le statut est piloté depuis la fiche projet.
                  </p>
                </div>
                <FormField
                  control={control}
                  name="cofrac_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>COFRAC</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                        disabled={disableInputs}
                      >
                        <FormControl>
                          <SelectTrigger disabled={disableInputs}>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                          <SelectItem value="A_PLANIFIER">À planifier</SelectItem>
                          <SelectItem value="CONFORME">Conforme</SelectItem>
                          <SelectItem value="NON_CONFORME">Non conforme</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border border-dashed">
              <CardHeader>
                <CardTitle>Finances du chantier</CardTitle>
                <CardDescription>CA, commissions et coûts principaux.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {!isEclairage ? (
                  <>
                    {/* Isolation fields */}
                    <FormField
                      control={control}
                      name="surface_facturee_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Surface facturée (m²)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="cout_mo_par_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coût main d'œuvre / m² (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="surface_posee_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            Surface posée (m²)
                            <span className="text-xs text-muted-foreground" title="Inclus chute">ℹ️</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="cout_isolant_par_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coût isolant / m² (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Computed fields - editable with auto-calculation */}
                    <div className="col-span-full grid gap-4 md:grid-cols-2 rounded-lg border bg-muted/30 p-4">
                      <FormField
                        control={control}
                        name="cout_materiaux_par_m2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              Coût matériaux / m² (€)
                              <span className="ml-1 text-xs opacity-60">(calculé automatiquement)</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                value={field.value ?? 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                onBlur={(e) => {
                                  field.onBlur();
                                }}
                                disabled={disableInputs}
                                placeholder="Calculé automatiquement"
                                className="text-right font-medium"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="cout_total_materiaux"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              Coût total matériaux (€)
                              <span className="ml-1 text-xs opacity-60">(calculé automatiquement)</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                value={field.value ?? 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                onBlur={(e) => {
                                  field.onBlur();
                                }}
                                disabled={disableInputs}
                                placeholder="Calculé automatiquement"
                                className="text-right font-medium"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Éclairage fields */}
                    <FormField
                      control={control}
                      name="nb_luminaires"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de luminaires installés</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="cout_total_mo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coût total main d'œuvre (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="cout_total_materiaux_eclairage"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Coût total matériaux (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                
                {/* Commission fields (Éclairage) */}
                {isEclairage && (
                  <FormField
                    control={control}
                    name="commission_eur_per_led_enabled"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                            }}
                            disabled={disableInputs}
                          />
                          <div className="space-y-2 flex-1">
                            <FormLabel>Commission commerciale (€ par LED installé)</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Activez pour ajouter une commission calculée par luminaire installé.
                            </p>
                            <FormField
                              control={control}
                              name="commission_eur_per_led"
                              render={({ field: amountField }) => (
                                <FormItem>
                                  <FormLabel>Montant commission (€/LED)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      {...amountField}
                                      value={amountField.value ?? ""}
                                      onBlur={(event) => {
                                        amountField.onBlur();
                                        handleBlurSave();
                                      }}
                                      disabled={!field.value || disableInputs}
                                      readOnly={isEditingLocked}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                {/* Commission block - only show for Isolation */}
                {!isEclairage && (
                  <FormField
                    control={control}
                    name="commission_eur_per_m2_enabled"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                            }}
                            disabled={disableInputs}
                          />
                          <div className="space-y-2">
                            <FormLabel>Commission commerciale (€/m²)</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Activez pour ajouter une commission calculée par mètre carré facturé.
                            </p>
                            <FormField
                              control={control}
                              name="commission_commerciale_par_m2"
                              render={({ field: amountField }) => (
                                <FormItem>
                                  <FormLabel>Montant commission (€/m²)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      {...amountField}
                                      onBlur={(event) => {
                                        amountField.onBlur();
                                        handleBlurSave();
                                      }}
                                      disabled={!field.value || disableInputs}
                                      readOnly={isEditingLocked}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border border-dashed">
              <CardHeader>
                <CardTitle>Travaux non subventionnés</CardTitle>
                <CardDescription>Déclarez les travaux complémentaires.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Checkbox to enable/disable the section */}
                <FormField
                  control={control}
                  name="travaux_non_subventionnes_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              // Reset to NA when disabled
                              form.setValue("travaux_non_subventionnes", "NA");
                            }
                          }}
                          disabled={disableInputs}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-medium">
                          Inclure des travaux non subventionnés
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Cochez pour déclarer des travaux complémentaires facturés au client
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Show fields only when enabled */}
                {watchedTravauxEnabled && (
                  <>
                    <FormField
                      control={control}
                      name="travaux_non_subventionnes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de travaux</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                            }}
                            value={field.value}
                            disabled={disableInputs}
                          >
                            <FormControl>
                              <SelectTrigger disabled={disableInputs}>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Remove "N/A" from options since it's controlled by checkbox */}
                              {TRAVAUX_NON_SUBVENTIONNES_OPTIONS.filter(opt => opt.value !== "NA").map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={control}
                      name="travaux_non_subventionnes_description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="travaux_non_subventionnes_montant"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                              }}
                              disabled={disableInputs}
                              readOnly={isEditingLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="travaux_non_subventionnes_financement"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                            }}
                            disabled={disableInputs}
                          />
                          <FormLabel className="font-normal">Financement externe confirmé</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border border-dashed">
              <CardHeader>
                <CardTitle>Frais additionnels</CardTitle>
                <CardDescription>Ajoutez les frais de chantier pour suivre la rentabilité.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {costFields.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Aucun frais enregistré pour le moment.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {costFields.map((field, index) => {
                      const costValue = Array.isArray(watchedAdditionalCosts)
                          ? watchedAdditionalCosts[index]
                        : undefined;
                      const amountHTValue =
                        costValue &&
                        typeof costValue.amount_ht === "number" &&
                        Number.isFinite(costValue.amount_ht)
                          ? costValue.amount_ht
                          : 0;
                      const tvaRateValue = normalizeAdditionalCostTvaRate(costValue?.tva_rate, 8.5);
                      const computedTTC = computeAdditionalCostTTC(amountHTValue, tvaRateValue);
                      const computedTaxes = Math.max(0, computedTTC - amountHTValue);

                      return (
                        <div
                          key={field.id}
                          className="grid gap-4 rounded-lg border border-border/60 p-4 md:grid-cols-4"
                        >
                          <FormField
                            control={control}
                            name={`additional_costs.${index}.label` as const}
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Intitulé</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    onBlur={(event) => {
                                      field.onBlur();
                                    }}
                                    disabled={disableInputs}
                                    readOnly={isEditingLocked}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`additional_costs.${index}.amount_ht` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Montant HT</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onBlur={(event) => {
                                      field.onBlur();
                                    }}
                                    disabled={disableInputs}
                                    readOnly={isEditingLocked}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`additional_costs.${index}.tva_rate` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Taux de TVA</FormLabel>
                                <Select
                                  value={
                                    field.value === undefined || field.value === null
                                      ? String(tvaRateValue)
                                      : String(field.value)
                                  }
                                  onValueChange={(next) => {
                                    const parsed = Number.parseFloat(next);
                                    field.onChange(Number.isFinite(parsed) ? parsed : tvaRateValue);
                                  }}
                                  disabled={disableInputs || isEditingLocked}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Sélectionner" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ADDITIONAL_COST_TVA_RATES.map((rate) => (
                                      <SelectItem key={rate} value={String(rate)}>
                                        {rate}%
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  TVA calculée : {Math.round(computedTaxes * 100) / 100} €
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="md:col-span-4 space-y-2">
                            <FormField
                              control={control}
                              name={`additional_costs.${index}.amount_ttc` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Montant TTC</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={
                                        field.value === undefined || field.value === null
                                          ? computedTTC
                                          : field.value
                                      }
                                      readOnly
                                      disabled
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`additional_costs.${index}.attachment` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Preuve (Drive)</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="URL ou ID du fichier"
                                      {...field}
                                      onBlur={(event) => {
                                        field.onBlur();
                                      }}
                                      disabled={disableInputs}
                                      readOnly={isEditingLocked}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                removeCost(index);
                              }}
                              className="text-destructive"
                              disabled={disableInputs}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendCost({
                      label: "",
                      amount_ht: 0,
                      tva_rate: 20,
                      amount_ttc: 0,
                      attachment: null,
                    })
                  }
                  disabled={disableInputs}
                >
                  Ajouter un frais
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-dashed">
              <CardHeader>
                <CardTitle>Suivi & documents</CardTitle>
                <CardDescription>Informations complémentaires et suivi des paiements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={control}
                  name="subcontractor_id"
                  render={({ field }) => {
                    const selectedSubcontractor = (subcontractorsQuery.data ?? []).find(
                      (s) => s.id === field.value
                    );
                    return (
                      <FormItem>
                        <FormLabel>Sous-traitant</FormLabel>
                        <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                          {selectedSubcontractor?.name ?? "Aucun"}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={control}
                  name="subcontractor_payment_confirmed"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                          }}
                          disabled={disableInputs}
                        />
                        <div className="space-y-1">
                          <FormLabel className="font-medium">Paiement sous-traitant confirmé</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Indiquez si le règlement du sous-traitant a été effectué.
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-foreground">{subcontractorAmountDisplay}</p>
                        <p className="text-xs text-muted-foreground">
                          {subcontractorRateDisplay
                            ? `${subcontractorUnitsDisplay} · ${subcontractorRateDisplay}`
                            : subcontractorUnitsDisplay}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <FormLabel>Documents chantier</FormLabel>
                  <DriveMultiFileUploader
                    orgId={orgId ?? chantier.org_id ?? null}
                    entityType="site"
                    entityId={chantier.site_ref}
                    value={siteAttachments}
                    onChange={(attachments) => {
                      setSiteAttachments(attachments);
                    }}
                    maxSizeMb={35}
                    accept="application/pdf,image/*"
                    description="Importer des photos ou documents Drive"
                    helperText="Prise en charge PDF et images, avec titres et tags personnalisés"
                    disabled={disableInputs}
                  />
                </div>
                <FormField
                  control={control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes internes</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          {...field}
                          onBlur={(event) => {
                            field.onBlur();
                          }}
                          disabled={disableInputs}
                          readOnly={isEditingLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {isProjectCompleted ? (
              <Card className="border border-primary/40 bg-primary/5">
                <CardHeader>
                  <CardTitle>Après chantier</CardTitle>
                  <CardDescription>Complétez les éléments de clôture.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Téléversez les photos finales et complétez les notes de fin d'intervention.
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className={cn("border-2", rentabilityBorder)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" /> Rentabilité prévisionnelle
                    </CardTitle>
                    <CardDescription>Calculée automatiquement à partir des montants saisis.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="view-toggle" className="text-sm font-medium">
                      {viewMode === "ht" ? "HT" : "TTC"}
                    </Label>
                    <Switch
                      id="view-toggle"
                      checked={viewMode === "ttc"}
                      onCheckedChange={toggleViewMode}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Chiffre d'affaires {viewMode === "ht" ? "(HT)" : "(TTC)"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatEuro(categoryRentability.ca)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Prime CEE + Travaux client</div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Coût chantier {viewMode === "ht" ? "(HT)" : "(TTC)"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatEuro(categoryRentability.cout_chantier)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">MO + Matériaux + Frais</div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Marge totale {viewMode === "ht" ? "(HT)" : "(TTC)"}
                    </span>
                    <span className={cn(
                      "font-semibold",
                      categoryRentability.marge_totale > 0 
                        ? "text-emerald-600" 
                        : categoryRentability.marge_totale < 0 
                          ? "text-destructive" 
                          : "text-foreground"
                    )}>
                      {formatEuro(categoryRentability.marge_totale)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    CA - Coût chantier - Commission
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Marge / {isEclairage ? "luminaire" : "m²"} {viewMode === "ht" ? "(HT)" : "(TTC)"}
                    </span>
                    <span className={cn(
                      "font-semibold",
                      categoryRentability.marge_par_unite > 0
                        ? "text-emerald-600"
                        : categoryRentability.marge_par_unite < 0
                          ? "text-destructive"
                          : "text-foreground"
                    )}>
                      {formatEuro(categoryRentability.marge_par_unite)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Marge totale / {isEclairage ? "Nombre luminaires" : "Surface facturée"}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Frais additionnels {viewMode === "ht" ? "(HT)" : "(TTC)"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatEuro(categoryRentability.frais_additionnels)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Frais de chantier additionnels
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informations projet</CardTitle>
                <CardDescription>Référence et coordonnées principales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date début</span>
                  <span className="font-medium text-foreground">
                    {formatDate((chantier as any).date_debut ?? project?.date_debut_prevue ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date fin prévisionnelle</span>
                  <span className="font-medium text-foreground">
                    {formatDate((chantier as any).date_fin_prevue ?? project?.date_fin_prevue ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sous-traitant</span>
                  <span className="font-medium text-foreground">
                    {chantier.subcontractor?.name ?? "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
      
      {/* Floating save button */}
      {formState.isDirty && !isEditingLocked && (
        <div className="fixed bottom-6 right-6 z-[9999] pointer-events-auto">
          <Button
            type="button"
            size="lg"
            className="shadow-lg pointer-events-auto"
            onClick={handleBlurSave}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
