import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import {
  createSiteSchema,
  defaultSiteFormValues,
  type SiteFormValues,
  type SiteSubmitValues,
} from "@/components/sites/siteFormSchema";
import { TRAVAUX_NON_SUBVENTIONNES_OPTIONS } from "@/components/sites/travauxNonSubventionnes";
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
import { DriveFileUploader } from "@/components/integrations/DriveFileUploader";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { calculateRentability, buildRentabilityInputFromSite } from "@/lib/rentability";
import { parseSiteNotes, serializeSiteNotes } from "@/lib/sites";
import { cn } from "@/lib/utils";
import { ClipboardList, HandCoins, Loader2, MapPin, UserRound, ArrowLeft, Building2 } from "lucide-react";
import type { DriveFileMetadata } from "@/integrations/googleDrive";
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

const getStatusGradient = (marginRate: number) => {
  if (marginRate >= 0) {
    return "border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent";
  }
  return "border-destructive/60 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent";
};

const ChantierDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { statusOptions, isLoading: statusesLoading } = useProjectStatuses();
  const [siteDriveFile, setSiteDriveFile] = useState<DriveFileMetadata | null>(null);

  const projectStatusValues = useMemo(
    () => statusOptions.map((option) => option.value),
    [statusOptions],
  );

  const resolver = useMemo(() => zodResolver(createSiteSchema(projectStatusValues, false)), [projectStatusValues]);

  const form = useForm<SiteFormValues>({
    resolver,
    defaultValues: defaultSiteFormValues,
    mode: "onChange",
  });

  const { control, reset, handleSubmit, formState } = form;
  const watchedStatus = useWatch({ control, name: "status" });
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
    ],
  });

  const { fields: costFields, append: appendCost, remove: removeCost } = useFieldArray({
    control,
    name: "additional_costs",
  });

  const chantierQuery = useQuery<ChantierQueryResult | null>({
    queryKey: ["chantier", id, currentOrgId],
    enabled: Boolean(id && user?.id),
    queryFn: async () => {
      if (!id || !user?.id) return null;

      let query = supabase
        .from("sites")
        .select(
          `*, project:projects(*, lead:leads(id,email,phone_raw)), subcontractor:subcontractors(id,name)`,
        )
        .eq("id", id)
        .maybeSingle();

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return null;
      return { site: data as SiteWithProject } satisfies ChantierQueryResult;
    },
  });

  const subcontractorsQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["subcontractors", currentOrgId],
    enabled: Boolean(currentOrgId),
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id,name")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const chantier = chantierQuery.data?.site ?? null;
  const project = chantier?.project ?? null;
  const parsedNotes = useMemo(() => parseSiteNotes(chantier?.notes), [chantier?.notes]);

  useEffect(() => {
    if (!chantier) return;
    const defaults: SiteFormValues = {
      ...defaultSiteFormValues,
      ...chantier,
      project_ref: chantier.project_ref ?? project?.project_ref ?? "",
      client_name: chantier.client_name ?? project?.client_name ?? "",
      product_name: chantier.product_name ?? project?.product_name ?? "",
      subcontractor_id: chantier.subcontractor_id ?? null,
      travaux_non_subventionnes: (chantier.travaux_non_subventionnes as SiteFormValues["travaux_non_subventionnes"]) ?? "NA",
      travaux_non_subventionnes_description: chantier.travaux_non_subventionnes_description ?? "",
      travaux_non_subventionnes_montant: sanitizeNumber(chantier.travaux_non_subventionnes_montant),
      travaux_non_subventionnes_financement: Boolean(chantier.travaux_non_subventionnes_financement),
      commission_commerciale_ht: Boolean(chantier.commission_commerciale_ht),
      commission_commerciale_ht_montant: sanitizeNumber(chantier.commission_commerciale_ht_montant),
      notes: parsedNotes.text ?? "",
      additional_costs: Array.isArray(chantier.additional_costs)
        ? (chantier.additional_costs as SiteFormValues["additional_costs"])
        : [],
    };
    reset(defaults, { keepDefaultValues: false });
    setSiteDriveFile(parsedNotes.driveFile ?? null);
  }, [chantier, parsedNotes.driveFile, parsedNotes.text, project?.client_name, project?.product_name, project?.project_ref, reset]);

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
    ];

    const normalizedAdditionalCosts = Array.isArray(additionalCosts)
      ? additionalCosts.map((cost) => ({
          amount_ht: sanitizeNumber(cost?.amount_ht),
          taxes: sanitizeNumber(cost?.montant_tva),
        }))
      : [];

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
    });

    return calculateRentability(rentabilityInput);
  }, [rentabilityWatch]);

  const updateMutation = useMutation({
    mutationFn: async (payload: SiteSubmitValues) => {
      if (!chantier || !user?.id) return;
      const { error } = await supabase.from("sites").update(payload).eq("id", chantier.id);
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

  const handleFormSubmit = (values: SiteFormValues) => {
    if (!chantier || !user?.id) return;
    const filteredCosts = (values.additional_costs ?? [])
      .filter((cost) => cost.label.trim().length > 0)
      .map((cost) => {
        const amountHT = sanitizeNumber(cost.amount_ht);
        const montantTVA = sanitizeNumber(cost.montant_tva);
        const amountTTC = sanitizeNumber(cost.amount_ttc, amountHT + montantTVA);
        const attachment = cost.attachment?.trim() ?? "";
        return {
          label: cost.label.trim(),
          amount_ht: amountHT,
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
    const commissionActive = Boolean(values.commission_commerciale_ht);
    const commissionMontant = commissionActive ? sanitizeNumber(values.commission_commerciale_ht_montant) : 0;

    const rentabilityResult = calculateRentability(
      buildRentabilityInputFromSite({
        ...values,
        additional_costs: filteredCosts,
      }),
    );

    const serializedNotes = serializeSiteNotes(values.notes, siteDriveFile);

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
      commission_commerciale_ht: commissionActive,
      commission_commerciale_ht_montant: commissionMontant,
      profit_margin: rentabilityResult.marginRate,
      rentability_total_costs: rentabilityResult.totalCosts,
      rentability_margin_total: rentabilityResult.marginTotal,
      rentability_margin_per_unit: rentabilityResult.marginPerUnit,
      rentability_margin_rate: rentabilityResult.marginRate,
      rentability_unit_label: rentabilityResult.unitLabel,
      rentability_unit_count: rentabilityResult.unitsUsed,
      rentability_additional_costs_total: rentabilityResult.additionalCostsTotal,
    };

    updateMutation.mutate(payload);
  };

  if (chantierQuery.isLoading || statusesLoading) {
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
                <Badge variant="outline">{chantier.status}</Badge>
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
                <Card className="border border-dashed">
                  <CardHeader>
                    <CardTitle>Statut & conformité</CardTitle>
                    <CardDescription>Mettez à jour le statut du chantier et le suivi COFRAC.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un statut" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statusOptions.map((option) => (
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
                    <FormField
                      control={control}
                      name="cofrac_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COFRAC</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                            <Input type="number" step="0.01" {...field} />
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
                            <Input type="number" step="0.01" {...field} />
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
                            <Input type="number" step="0.01" {...field} />
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
                          <FormLabel>Surface facturée (m²)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} />
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
                          <FormLabel>Coût main d'œuvre / m² (€)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
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
                          <FormLabel>Coût matériaux / m² (€)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
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
                          <FormLabel>Surface posée (m²)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="commission_commerciale_ht"
                      render={({ field }) => (
                        <FormItem className="col-span-full">
                          <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            <div className="space-y-2">
                              <FormLabel>Commission HT active</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Activez si une commission HT est due. Renseignez le montant correspondant.
                              </p>
                              <FormField
                                control={control}
                                name="commission_commerciale_ht_montant"
                                render={({ field: amountField }) => (
                                  <FormItem>
                                    <FormLabel>Montant commission HT (€)</FormLabel>
                                    <FormControl>
                                      <Input type="number" step="0.01" {...amountField} disabled={!field.value} />
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                                <Textarea rows={3} {...field} />
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
                                <Input type="number" step="0.01" {...field} />
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
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                        {costFields.map((field, index) => (
                          <div key={field.id} className="grid gap-4 rounded-lg border border-border/60 p-4 md:grid-cols-4">
                            <FormField
                              control={control}
                              name={`additional_costs.${index}.label` as const}
                              render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                  <FormLabel>Intitulé</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
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
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`additional_costs.${index}.montant_tva` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>TVA</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
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
                                      <Input type="number" step="0.01" {...field} />
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
                                      <Input placeholder="URL ou ID du fichier" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCost(index)}
                                className="text-destructive"
                              >
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        ))}
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
                          montant_tva: 0,
                          amount_ttc: 0,
                          attachment: null,
                        })
                      }
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
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger>
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
                        <FormItem className="flex items-center gap-3">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <div className="space-y-1">
                            <FormLabel className="font-medium">Paiement sous-traitant confirmé</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Indiquez si le règlement du sous-traitant a été effectué.
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <FormLabel>Documents chantier</FormLabel>
                      <DriveFileUploader
                        orgId={currentOrgId ?? chantier.org_id ?? null}
                        entityType="site"
                        entityId={chantier.site_ref}
                        value={siteDriveFile}
                        onChange={setSiteDriveFile}
                        maxSizeMb={35}
                        description="Importer des photos ou documents Drive"
                        helperText="Prise en charge PDF et images"
                      />
                    </div>
                    <FormField
                      control={control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes internes</FormLabel>
                          <FormControl>
                            <Textarea rows={4} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {watchedStatus === "TERMINE" ? (
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
                      <span className="text-muted-foreground">Coûts totaux</span>
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

                <div className="flex flex-col gap-3">
                  <Button type="submit" disabled={updateMutation.isPending || !formState.isDirty}>
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Enregistrer les modifications
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </Layout>
  );
};

export default ChantierDetails;
