import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/features/organizations/OrgContext";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  getLeadStatusLabel,
  LEAD_STATUSES,
  leadStatusEnum,
  type LeadStatus,
} from "@/components/leads/status";
import { DynamicFields } from "./DynamicFields";
import {
  getOrganizationMembers,
  useCreateLead,
  useLeadProductTypes,
  type ProductFormSchema,
} from "./api";
import type { TablesInsert } from "@/integrations/supabase/types";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";
import { DriveFileUploader } from "@/components/integrations/DriveFileUploader";
import type { DriveFileMetadata } from "@/integrations/googleDrive";
import {
  getLeadDynamicFieldSchema,
  getLeadSources,
  getLeadStatusSettings,
  LEAD_DYNAMIC_FIELDS_UPDATED_EVENT,
  LEAD_SOURCES_UPDATED_EVENT,
  LEAD_STATUS_SETTINGS_UPDATED_EVENT,
  type LeadSourceSetting,
  type LeadStatusSetting,
} from "@/lib/leads";

const sirenSchema = z
  .string()
  .optional()
  .refine((value) => {
    if (!value || value.trim() === "") return true;
    const sanitized = value.replace(/\s+/g, "").trim();
    return /^\d{9}$/.test(sanitized);
  }, "Le numéro SIREN doit contenir 9 chiffres");

const optionalNumericString = z
  .string()
  .optional()
  .refine((value) => {
    if (!value || value.trim() === "") return true;
    const normalized = value.replace(/,/g, ".").trim();
    return !Number.isNaN(Number(normalized));
  }, "Veuillez saisir un nombre valide");

const leadSchema = z.object({
  first_name: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  last_name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  company: z.string().optional(),
  siren: sirenSchema,
  email: z.string().email("Email invalide"),
  phone_raw: z.string().min(6, "Numéro de téléphone invalide"),
  address: z.string().min(5, "L'adresse est requise"),
  city: z.string().min(2, "La ville est requise"),
  postal_code: z.string().min(4, "Code postal invalide"),
  product_type: z.string().min(1, "Le type de produit est requis"),
  utm_source: z.string().optional(),
  status: leadStatusEnum,
  commentaire: z.string().optional(),
  remarks: z.string().optional(),
  building_length: optionalNumericString,
  building_width: optionalNumericString,
  building_height: optionalNumericString,
  assigned_to: z.string().optional(),
  extra_fields: z.record(z.any()).default({}),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface LeadFormDialogProps {
  onCreated?: () => void | Promise<void>;
}

export const LeadFormDialog = ({ onCreated }: LeadFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [drivePhoto, setDrivePhoto] = useState<DriveFileMetadata | null>(null);
  const [isManualAddress, setIsManualAddress] = useState(false);
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { toast } = useToast();

  const orgId = currentOrgId;

  const initialStatusSettings = useMemo(
    () => getLeadStatusSettings({ includeInactive: false }),
    []
  );
  const initialLeadSources = useMemo(
    () => getLeadSources({ includeInactive: false }),
    []
  );
  const initialDynamicSchema = useMemo(() => getLeadDynamicFieldSchema(), []);

  const defaultStatusValue = initialStatusSettings[0]?.value ?? LEAD_STATUSES[0];

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      company: "",
      siren: "",
      email: "",
      phone_raw: "",
      address: "",
      city: "",
      postal_code: "",
      product_type: "",
      utm_source: "",
      status: defaultStatusValue,
      commentaire: "",
      remarks: "",
      building_length: "",
      building_width: "",
      building_height: "",
      assigned_to: user?.id ?? "",
      extra_fields: {},
    },
  });

  useEffect(() => {
    if (user?.id) {
      form.setValue("assigned_to", user.id);
    }
  }, [user?.id, form]);

  const [statusSettings, setStatusSettings] = useState<LeadStatusSetting[]>(initialStatusSettings);
  const [availableSources, setAvailableSources] = useState<LeadSourceSetting[]>(initialLeadSources);
  const [dynamicSchema, setDynamicSchema] = useState<ProductFormSchema | null>(
    initialDynamicSchema
  );

  const { data: productTypes } = useLeadProductTypes(orgId);
  const { data: members } = useQueryOrganizationMembers(orgId);

  const currentMemberRole = useMemo(() => {
    if (!members || !user?.id) return null;
    return members.find((member) => member.user_id === user.id)?.role ?? null;
  }, [members, user?.id]);

  const canAssignOthers = currentMemberRole === "owner" || currentMemberRole === "admin";

  const statusOptions = useMemo(
    () => statusSettings.filter((status) => status.isActive).sort((a, b) => a.order - b.order),
    [statusSettings]
  );

  const leadSourceOptions = useMemo(
    () =>
      availableSources
        .filter((source) => source.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [availableSources]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStatusesUpdate = () => {
      setStatusSettings(getLeadStatusSettings({ includeInactive: false, skipCache: true }));
    };
    const handleSourcesUpdate = () => {
      setAvailableSources(getLeadSources({ includeInactive: false, skipCache: true }));
    };
    const handleDynamicFieldsUpdate = () => {
      setDynamicSchema(getLeadDynamicFieldSchema());
    };

    window.addEventListener(LEAD_STATUS_SETTINGS_UPDATED_EVENT, handleStatusesUpdate);
    window.addEventListener(LEAD_SOURCES_UPDATED_EVENT, handleSourcesUpdate);
    window.addEventListener(LEAD_DYNAMIC_FIELDS_UPDATED_EVENT, handleDynamicFieldsUpdate);

    return () => {
      window.removeEventListener(LEAD_STATUS_SETTINGS_UPDATED_EVENT, handleStatusesUpdate);
      window.removeEventListener(LEAD_SOURCES_UPDATED_EVENT, handleSourcesUpdate);
      window.removeEventListener(LEAD_DYNAMIC_FIELDS_UPDATED_EVENT, handleDynamicFieldsUpdate);
    };
  }, []);

  useEffect(() => {
    const allowedValues = statusOptions.map((status) => status.value);
    const currentValue = form.getValues("status");

    if (!allowedValues.includes(currentValue as LeadStatus)) {
      const fallback = allowedValues[0] ?? LEAD_STATUSES[0];
      form.setValue("status", fallback, { shouldDirty: true });
    }
  }, [statusOptions, form]);

  useEffect(() => {
    if (!dynamicSchema) {
      form.setValue("extra_fields", {});
      return;
    }

    const allowedNames = new Set(dynamicSchema.fields.map((field) => field.name));
    const currentExtraFields = form.getValues("extra_fields") ?? {};
    const sanitizedEntries = Object.entries(currentExtraFields).filter(([key]) =>
      allowedNames.has(key)
    );

    form.setValue("extra_fields", Object.fromEntries(sanitizedEntries));
  }, [dynamicSchema, form]);

  const productType = form.watch("product_type");

  useEffect(() => {
    if (!productType) return;
    form.setValue("extra_fields", {});
  }, [productType, form]);

  useEffect(() => {
    if (!form.getValues("product_type") && productTypes?.length === 1) {
      form.setValue("product_type", productTypes[0].name);
    }
  }, [productTypes, form]);

  const createLead = useCreateLead(orgId);

  const isSubmitting = createLead.isPending;

  const onSubmit = async (values: LeadFormValues) => {
    if (!user?.id || !orgId) {
      toast({
        title: "Authentification requise",
        description: "Connectez-vous pour créer un lead",
        variant: "destructive",
      });
      return;
    }

    form.clearErrors();

    const normalizedSiren = values.siren?.replace(/\s+/g, "").trim() || null;
    const fullName = `${values.first_name} ${values.last_name}`.replace(/\s+/g, " ").trim();
    const selectedProductType = values.product_type.trim();
    const parseDimension = (input?: string) => {
      if (!input || input.trim() === "") return null;
      const normalized = input.replace(/,/g, ".").trim();
      const parsed = Number(normalized);
      return Number.isNaN(parsed) ? null : parsed;
    };
    const buildingLength = parseDimension(values.building_length);
    const buildingWidth = parseDimension(values.building_width);
    const buildingHeight = parseDimension(values.building_height);

    try {
      const extraFields = { ...values.extra_fields };
      const drivePhotoMetadata = drivePhoto
        ? {
            id: drivePhoto.id,
            name: drivePhoto.name,
            webViewLink: drivePhoto.webViewLink ?? null,
            webContentLink: drivePhoto.webContentLink ?? null,
          }
        : null;

      if (drivePhotoMetadata) {
        (extraFields as Record<string, unknown>).drive_photo = drivePhotoMetadata;
      } else if ("drive_photo" in extraFields) {
        delete (extraFields as Record<string, unknown>).drive_photo;
      }

      // Store first_name, last_name, building dimensions, and remarks in extra_fields
      const enrichedExtraFields = {
        ...extraFields,
        first_name: values.first_name,
        last_name: values.last_name,
        building_length: buildingLength,
        building_width: buildingWidth,
        building_height: buildingHeight,
        remarks: values.remarks?.trim() || null,
      };

      const payload = {
        full_name: fullName,
        email: values.email,
        phone_raw: values.phone_raw,
        address: values.address,
        city: values.city,
        postal_code: values.postal_code,
        status: values.status,
        company: values.company?.trim() ? values.company : null,
        siren: normalizedSiren,
        product_name: selectedProductType,
        utm_source: values.utm_source?.trim() ? values.utm_source : null,
        commentaire: values.commentaire?.trim() ? values.commentaire : null,
        photo_previsite_url: drivePhotoMetadata?.webViewLink ?? drivePhotoMetadata?.webContentLink ?? null,
        extra_fields: enrichedExtraFields,
        user_id: user.id,
        org_id: orgId,
        assigned_to: values.assigned_to || user.id,
        created_by: user.id,
      } as TablesInsert<"leads">;

      await createLead.mutateAsync(payload);

      toast({
        title: "Lead créé",
        description: "Le lead a été ajouté avec succès",
      });

      const resetStatus = statusOptions[0]?.value ?? LEAD_STATUSES[0];

      form.reset({
        first_name: "",
        last_name: "",
        company: "",
        siren: "",
        email: "",
        phone_raw: "",
        address: "",
        city: "",
        postal_code: "",
        product_type: productTypes?.length === 1 ? productTypes[0].name : "",
        utm_source: "",
        status: resetStatus,
        commentaire: "",
        remarks: "",
        building_length: "",
        building_width: "",
        building_height: "",
        assigned_to: user.id,
        extra_fields: {},
      });
      setDrivePhoto(null);
      setIsManualAddress(false);
      setOpen(false);
      await onCreated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  };

  const assignedOptions = useMemo(() => {
    const base: { user_id: string; label: string; role: string }[] = (members ?? [])
      .map((member) => ({
        user_id: member.user_id,
        role: member.role,
        label: member.profile?.full_name ?? member.user_id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (user?.id && !base.some((member) => member.user_id === user.id)) {
      base.push({
        user_id: user.id,
        role: currentMemberRole ?? "member",
        label:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          user.id,
      });
    }

    return base;
  }, [members, user?.id, user?.email, user?.user_metadata, currentMemberRole]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      const resetStatus = statusOptions[0]?.value ?? LEAD_STATUSES[0];

      form.reset({
        first_name: "",
        last_name: "",
        company: "",
        siren: "",
        email: "",
        phone_raw: "",
        address: "",
        city: "",
        postal_code: "",
        product_type: productTypes?.length === 1 ? productTypes[0].name : "",
        utm_source: "",
        status: resetStatus,
        commentaire: "",
        remarks: "",
        building_length: "",
        building_width: "",
        building_height: "",
        assigned_to: user?.id ?? "",
        extra_fields: {},
      });
      setDrivePhoto(null);
      setIsManualAddress(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajouter un lead</DialogTitle>
          <DialogDescription>
            Renseignez les informations du prospect et les détails produit
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entreprise</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="siren"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro SIREN *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isSubmitting}
                        placeholder="000000000"
                        maxLength={11}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse e-mail *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone_raw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse *</FormLabel>
                  <FormControl>
                    <AddressAutocomplete
                      value={field.value}
                      onChange={(address, city, postalCode, options) => {
                        const isManual = options?.manual ?? false;
                        setIsManualAddress(isManual);
                        field.onChange(address);
                        form.setValue("city", city, { shouldDirty: true, shouldValidate: true });
                        form.setValue("postal_code", postalCode, { shouldDirty: true, shouldValidate: true });
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isSubmitting}
                        readOnly={!isManualAddress}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isSubmitting}
                        readOnly={!isManualAddress}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de produit *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value}
                      disabled={isSubmitting || !productTypes?.length}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type de produit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(productTypes ?? []).map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!productTypes?.length ? (
                      <p className="text-xs text-muted-foreground">
                        Aucun type de produit disponible. Ajoutez des types dans les paramètres des leads.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigné à</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value ?? ""}
                      disabled={!canAssignOthers || isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un membre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignedOptions.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.label}
                            {member.role === "owner" || member.role === "admin" ? " (Admin)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canAssignOthers ? (
                      <p className="text-xs text-muted-foreground">Assigné automatiquement à vous-même</p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Mesures du bâtiment</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="building_length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longueur (m)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="building_width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Largeur (m)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="building_height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hauteur (m)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>



            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="utm_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value ?? ""}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadSourceOptions.length > 0 ? (
                          leadSourceOptions.map((source) => (
                            <SelectItem key={source.id} value={source.name}>
                              {source.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__empty" disabled>
                            Aucune source configurée
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut *</FormLabel>
                    <Select
                      onValueChange={(value: LeadStatus) => field.onChange(value)}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {getLeadStatusLabel(status.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DynamicFields form={form} schema={dynamicSchema} disabled={isSubmitting} />

            <div className="space-y-2">
              <FormLabel>Photo pré-visite</FormLabel>
              <DriveFileUploader
                orgId={orgId}
                value={drivePhoto}
                onChange={setDrivePhoto}
                accept="image/*"
                maxSizeMb={10}
                entityType="lead"
                description="Photo pré-visite enregistrée via Ecoprorenov"
                emptyLabel="Glissez-déposez votre photo ou cliquez pour sélectionner"
                helperText="Formats acceptés : JPG, PNG – taille maximale 10 Mo"
              />
            </div>

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarques supplémentaires</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commentaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commentaire</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting || !productTypes?.length}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer le lead"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

type MembersResult = Awaited<ReturnType<typeof getOrganizationMembers>>;

const useQueryOrganizationMembers = (orgId: string | null) =>
  useQuery<MembersResult, Error>({
    queryKey: ["memberships", orgId],
    queryFn: () => getOrganizationMembers(orgId as string),
    enabled: Boolean(orgId),
  });
