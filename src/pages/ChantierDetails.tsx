import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
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
  TRAVAUX_NON_SUBVENTIONNES_LABELS,
  normalizeTravauxNonSubventionnesValue,
} from "@/components/sites/travauxNonSubventionnes";
import { Layout } from "@/components/layout/Layout";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DriveMultiFileUploader } from "@/components/integrations/DriveMultiFileUploader";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { calculateRentability, buildRentabilityInputFromSite } from "@/lib/rentability";
import { getProjectStatusBadgeStyle } from "@/lib/projects";
import { parseSiteNotes, serializeSiteNotes, type SiteNoteAttachment } from "@/lib/sites";
import { cn } from "@/lib/utils";
import { ClipboardList, HandCoins, Loader2, MapPin, UserRound, ArrowLeft, Building2, Lock } from "lucide-react";
import { format } from "date-fns";

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

type ChantierQueryResult = {
  site: SiteWithProject;
};

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDecimal = (value: number) => decimalFormatter.format(value);
const formatPercent = (value: number) => percentFormatter.format(value);

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

const ChantierDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { statuses: statusOptions } = useProjectStatuses();
  const [siteAttachments, setSiteAttachments] = useState<SiteNoteAttachment[]>([]);

  const resolver = useMemo(() => zodResolver(createSiteSchema(false)), []);

  const form = useForm<SiteFormValues>({
    resolver,
    defaultValues: defaultSiteFormValues,
    mode: "onChange",
  });

  const { control, reset, handleSubmit, formState } = form;
  const watchedTravaux = useWatch({ control, name: "travaux_non_subventionnes" });
  const rentabilityWatch = useWatch({
    control,
    name: [
      "revenue",
      "cout_main_oeuvre_m2_ht",
      "cout_isolation_m2",
      "isolation_utilisee_m2",
      "surface_facturee",
      "montant_commission",
      "travaux_non_subventionnes",
      "travaux_non_subventionnes_montant",
      "product_name",
      "additional_costs",
      "valorisation_cee",
      "commission_eur_per_m2_enabled",
      "commission_eur_per_m2",
      "subcontractor_id",
      "subcontractor_payment_confirmed",
      "subcontractor_base_units",
      "subcontractor_payment_amount",
      "subcontractor_payment_units",
      "subcontractor_payment_rate",
      "subcontractor_payment_unit_label",
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
      const tvaRate = normalizeAdditionalCostTvaRate(cost?.tva_rate, 20);
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

  const chantierQuery = useQuery<ChantierQueryResult | null>({
    queryKey: ["chantier", id, currentOrgId],
    enabled: Boolean(id && user?.id),
    queryFn: async () => {
      if (!id || !user?.id) return null;

      let query = supabase
        .from("sites")
        .select(
          `*, project:projects(*, lead:leads(id,email,phone_raw)), subcontractor:subcontractors(id,name,pricing_details)`,
        )
        .eq("id", id);

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      const { data, error} = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { site: data as SiteWithProject } satisfies ChantierQueryResult;
    },
  });

  const subcontractorsQuery = useQuery<{ id: string; name: string; pricing_details: string | null }[]>({
    queryKey: ["subcontractors", currentOrgId],
    enabled: Boolean(currentOrgId),
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id,name,pricing_details")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const chantier = chantierQuery.data?.site ?? null;
  const project = chantier?.project ?? null;
  const projectStatusValue = project?.status ?? null;
  const isEditingLocked = projectStatusValue !== "CHANTIER_TERMINE";
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
      valorisation_cee: sanitizeNumber(chantier.valorisation_cee),
      subcontractor_id: chantier.subcontractor_id ?? null,
      subcontractor_payment_confirmed: Boolean(chantier.subcontractor_payment_confirmed),
      travaux_non_subventionnes: normalizeTravauxNonSubventionnesValue(
        chantier.travaux_non_subventionnes,
      ),
      travaux_non_subventionnes_montant: sanitizeNumber(chantier.travaux_non_subventionnes_montant),
      notes: parsedNotes.text ?? "",
      additional_costs: normalizeAdditionalCostsArray(chantier.additional_costs ?? []),
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
  ]);

  const rentabilityMetrics = useMemo(() => {
    const [
      revenue,
      laborCost,
      materialCost,
      isolationUsed,
      surfaceFacturee,
      commission,
      travauxChoice,
      travauxMontant,
      productName,
      additionalCosts,
      valorisationCee,
      commissionPerM2Enabled,
      commissionPerM2,
      subcontractorId,
      subcontractorPaymentConfirmed,
      subcontractorBaseUnits,
      subcontractorPaymentAmount,
      subcontractorPaymentUnits,
      subcontractorPaymentRate,
      subcontractorPaymentUnitLabel,
    ] = (rentabilityWatch ?? []) as [
      number | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      SiteFormValues["travaux_non_subventionnes"] | undefined,
      number | undefined,
      string | undefined,
      SiteFormValues["additional_costs"] | undefined,
      number | undefined,
      boolean | undefined,
      number | undefined,
      string | undefined,
      boolean | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      string | undefined,
    ];

    const normalizedAdditionalCosts = Array.isArray(additionalCosts)
      ? additionalCosts.map((cost) => {
          const amountHT = sanitizeNumber(cost?.amount_ht);
          const tvaRate = normalizeAdditionalCostTvaRate(cost?.tva_rate, 20);
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
      
      const updatePayload: Partial<Tables<"sites">> = {
        ...payload,
        team_members: payload.team_members?.map(m => m.id) ?? [],
      };
      
      const { error } = await supabase
        .from("sites")
        .update(updatePayload)
        .eq("id", chantier.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Chantier mis à jour", description: "Les informations ont été enregistrées." });
      await chantierQuery.refetch();
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
          const tvaRate = normalizeAdditionalCostTvaRate(cost.tva_rate, 20);
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
      profit_margin: rentabilityResult.marginRate,
      rentability_total_costs: rentabilityResult.totalCosts,
      rentability_margin_total: rentabilityResult.marginTotal,
      rentability_margin_per_unit: rentabilityResult.marginPerUnit,
      rentability_margin_rate: rentabilityResult.marginRate,
      rentability_unit_label: rentabilityResult.unitLabel,
      rentability_unit_count: rentabilityResult.unitsUsed,
      rentability_additional_costs_total: rentabilityResult.additionalCostsTotal,
      subcontractor_payment_amount: rentabilityResult.subcontractorEstimatedCost,
      subcontractor_payment_units: rentabilityResult.subcontractorBaseUnits,
      subcontractor_payment_unit_label: rentabilityResult.unitLabel,
      subcontractor_payment_rate: rentabilityResult.subcontractorRate,
      subcontractor_base_units: rentabilityResult.subcontractorBaseUnits,
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
    ],
  );

  const handleBlurSave = useCallback(() => {
    if (isEditingLocked) return;
    void form.handleSubmit(handleFormSubmit)();
  }, [form, handleFormSubmit, isEditingLocked]);

  const disableInputs = isEditingLocked || isUpdating;

  if (chantierQuery.isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (chantierQuery.isError) {
    const errorMessage = chantierQuery.error instanceof Error ? chantierQuery.error.message : "Erreur inattendue";
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
          <Card className="p-8">
            <CardHeader className="space-y-2 text-left">
              <CardTitle>Impossible de charger le chantier</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Retour
              </Button>
              <Button onClick={() => chantierQuery.refetch()}>Réessayer</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!chantier) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
          <Card className="p-8">
            <CardHeader className="space-y-2 text-left">
              <CardTitle>Chantier introuvable</CardTitle>
              <CardDescription>Le chantier recherché n'existe pas ou vous n'y avez pas accès.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Retour
              </Button>
              <Button onClick={() => navigate("/projects")}>Aller aux projets</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const progressValue = Math.min(Math.max(sanitizeNumber(chantier.progress_percentage), 0), 100);
  const plannedDates = [chantier.date_debut, chantier.date_fin_prevue].filter(Boolean) as string[];
  const clientIdentity = chantier.client_name || project?.client_name || "Client";
  const addressLine = chantier.address ? `${chantier.address}, ${chantier.postal_code} ${chantier.city}` : "Adresse à compléter";
  const phone = project?.phone ?? project?.lead?.phone_raw ?? null;
  const email = project?.lead?.email ?? null;
  const primeCeeValue = project?.prime_cee_total_cents
    ? project.prime_cee_total_cents / 100
    : project?.prime_cee ?? chantier.valorisation_cee ?? 0;

  const marginRate = rentabilityMetrics.marginRate ?? 0;
  const rentabilityBorder = getStatusGradient(marginRate);
  const rentabilityIsLighting = rentabilityMetrics.measurementMode === "luminaire";
  const rentabilityBilledUnitsLabel = rentabilityIsLighting
    ? "Nombre de luminaires facturés"
    : "Surface facturée (m²)";
  const rentabilityExecutedUnitsLabel = rentabilityIsLighting
    ? "Nombre de luminaires posés"
    : "Surface posée (m²)";
  const rentabilityLaborCostLabel = rentabilityIsLighting
    ? "Coût main d'œuvre / luminaire (€)"
    : "Coût main d'œuvre / m² (€)";
  const rentabilityMaterialCostLabel = rentabilityIsLighting
    ? "Coût matériel / luminaire (€)"
    : "Coût matériaux / m² (€)";

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Chantier</p>
                <h1 className="text-2xl font-semibold leading-tight">
                  {chantier.site_ref} • {clientIdentity}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" style={projectStatusBadgeStyle}>
                  {projectStatusLabel}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Retour
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-start gap-3">
                <UserRound className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
                  <p className="text-sm font-medium text-foreground">{clientIdentity}</p>
                  {phone ? <p className="text-xs text-muted-foreground">Tél. {phone}</p> : null}
                  {email ? <p className="text-xs text-muted-foreground">{email}</p> : null}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Adresse</p>
                  <p className="text-sm font-medium text-foreground">{addressLine}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Entreprise</p>
                  <p className="text-sm font-medium text-foreground">{project?.company ?? "Non renseignée"}</p>
                  {project?.siren ? <p className="text-xs text-muted-foreground">SIREN : {project.siren}</p> : null}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HandCoins className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Prime CEE</p>
                  <p className="text-sm font-medium text-emerald-600">{formatCurrency(sanitizeNumber(primeCeeValue))}</p>
                  {plannedDates.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {plannedDates.map((date, index) => (
                        <span key={date}>
                          {index === 0 ? "Du " : " au "}
                          {format(new Date(date), "dd/MM/yyyy")}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {chantier.subcontractor ? (
                    <p className="text-xs text-muted-foreground">Sous-traitant : {chantier.subcontractor.name}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avancement</span>
                <span className="text-xs font-medium text-muted-foreground">{formatDecimal(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8">
          <Form {...form}>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="space-y-6">
                {isEditingLocked ? (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">Modifications verrouillées</p>
                      <p className="text-xs">
                        Passez le projet au statut «&nbsp;CHANTIER_TERMINE&nbsp;» depuis l'onglet Projet pour activer la mise à jour du chantier.
                      </p>
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
                              handleBlurSave();
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
                    <FormField
                      control={control}
                      name="revenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chiffre d'affaires (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="valorisation_cee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valorisation CEE (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="montant_commission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission commerciale (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="surface_facturee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{rentabilityBilledUnitsLabel}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={rentabilityIsLighting ? 1 : 0.1}
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="cout_main_oeuvre_m2_ht"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{rentabilityLaborCostLabel}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="cout_isolation_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{rentabilityMaterialCostLabel}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="isolation_utilisee_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{rentabilityExecutedUnitsLabel}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={rentabilityIsLighting ? 1 : 0.1}
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                handleBlurSave();
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
                      name="commission_eur_per_m2_enabled"
                      render={({ field }) => (
                        <FormItem className="col-span-full">
                          <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                handleBlurSave();
                              }}
                              disabled={disableInputs}
                            />
                            <div className="space-y-2">
                              <FormLabel>
                                Commission commerciale ({rentabilityIsLighting ? "€/luminaire" : "€/m²"})
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Activez pour ajouter une commission calculée par{" "}
                                {rentabilityIsLighting ? "luminaire" : "mètre carré"} facturé.
                              </p>
                              <FormField
                                control={control}
                                name="commission_eur_per_m2"
                                render={({ field: amountField }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Montant commission ({rentabilityIsLighting ? "€/luminaire" : "€/m²"})
                                    </FormLabel>
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
                  </CardContent>
                </Card>

                <Card className="border border-dashed">
                  <CardHeader>
                    <CardTitle>Travaux non subventionnés</CardTitle>
                    <CardDescription>Déclarez les travaux complémentaires.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={control}
                      name="travaux_non_subventionnes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de travaux</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleBlurSave();
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
                              {TRAVAUX_NON_SUBVENTIONNES_OPTIONS.map((option) => (
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
                    {watchedTravaux !== "NA" ? (
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
                                    handleBlurSave();
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
                                    handleBlurSave();
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
                                  handleBlurSave();
                                }}
                                disabled={disableInputs}
                              />
                              <FormLabel className="font-normal">Financement externe confirmé</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}
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
                          const tvaRateValue = normalizeAdditionalCostTvaRate(costValue?.tva_rate, 20);
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
                                          handleBlurSave();
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
                                          handleBlurSave();
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
                                        handleBlurSave();
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
                                            handleBlurSave();
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
                                    handleBlurSave();
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
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sous-traitant</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleBlurSave();
                            }}
                            value={field.value ?? ""}
                            disabled={disableInputs}
                          >
                            <FormControl>
                              <SelectTrigger disabled={disableInputs}>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Aucun</SelectItem>
                              {(subcontractorsQuery.data ?? []).map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
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
                                handleBlurSave();
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
                        orgId={currentOrgId ?? chantier.org_id ?? null}
                        entityType="site"
                        entityId={chantier.site_ref}
                        value={siteAttachments}
                        onChange={(attachments) => {
                          setSiteAttachments(attachments);
                          if (!isEditingLocked) {
                            setTimeout(() => handleBlurSave(), 0);
                          }
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
                                handleBlurSave();
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
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" /> Rentabilité prévisionnelle
                    </CardTitle>
                    <CardDescription>Calculée automatiquement à partir des montants saisis.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Chiffre d'affaires</span>
                      <span className="font-semibold text-foreground">{formatCurrency(rentabilityMetrics.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Coût chantier (HT+TVA)</span>
                      <span className="font-semibold text-foreground">{formatCurrency(rentabilityMetrics.totalCosts)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Marge totale</span>
                      <span className="font-semibold text-foreground">{formatCurrency(rentabilityMetrics.marginTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Marge (%)</span>
                      <span className={cn("font-semibold", marginRate >= 0 ? "text-emerald-600" : "text-destructive")}>{formatPercent(marginRate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Marge / {rentabilityMetrics.unitLabel === "luminaire" ? "luminaire" : "m²"}
                      </span>
                      <span className="font-semibold text-foreground">
                        {rentabilityMetrics.unitsUsed > 0
                          ? `${formatDecimal(rentabilityMetrics.marginPerUnit)} €`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Frais additionnels</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(rentabilityMetrics.additionalCostsTotal)}
                      </span>
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
                      <span className="text-muted-foreground">Projet</span>
                      <span className="font-medium text-foreground">{project?.project_ref ?? chantier.project_ref}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Produit</span>
                      <span className="font-medium text-foreground">{project?.product_name ?? chantier.product_name ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Responsable</span>
                      <span className="font-medium text-foreground">{project?.assigned_to ?? "—"}</span>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </form>
          </Form>
        </div>
      </div>
    </Layout>
  );
};

export default ChantierDetails;
