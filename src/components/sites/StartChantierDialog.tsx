import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Camera,
  FileImage,
  Loader2,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organizations/OrgContext";
import {
  useDriveConnectionStatus,
  useDriveUpload,
  type DriveUploadResult,
} from "@/integrations/googleDrive";
import { serializeSiteNotes } from "@/lib/sites";

const MAX_PHOTO_COUNT = 12;

const startChantierSchema = z.object({
  startDate: z
    .string({ required_error: "La date de début est requise" })
    .min(1, "La date de début est requise"),
  endDate: z.string().optional(),
  subcontractorId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000, "La note interne est trop longue").optional(),
});

type StartChantierFormValues = z.infer<typeof startChantierSchema>;

type SubcontractorOption = {
  id: string;
  name: string;
};

type StartChantierDialogProps = {
  projectId: string;
  projectRef?: string | null;
  projectName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type StartChantierResponse = {
  chantier: {
    id: string;
    site_ref: string;
    notes: string | null;
    project_id: string | null;
    org_id: string | null;
  };
  project: Record<string, unknown> | null;
};

const formatDateLabel = (value: string | undefined) => {
  if (!value) return "Choisir une date";
  try {
    return format(new Date(value), "PPP", { locale: fr });
  } catch (error) {
    return "Choisir une date";
  }
};

const normalizeDriveMetadata = (uploads: DriveUploadResult[]) => {
  const seen = new Set<string>();
  return uploads.reduce<DriveUploadResult[]>((acc, file) => {
    const identifier = file.id ?? file.webViewLink ?? file.webContentLink ?? file.name;
    if (!identifier || seen.has(identifier)) {
      return acc;
    }

    seen.add(identifier);
    acc.push(file);
    return acc;
  }, []);
};

export const StartChantierDialog = ({
  projectId,
  projectRef,
  projectName,
  open,
  onOpenChange,
}: StartChantierDialogProps) => {
  const { currentOrgId } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const driveConnection = useDriveConnectionStatus(currentOrgId ?? null);
  const driveUpload = useDriveUpload();

  const form = useForm<StartChantierFormValues>({
    resolver: zodResolver(startChantierSchema),
    defaultValues: {
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      subcontractorId: null,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: "",
        subcontractorId: null,
        notes: "",
      });
      setSelectedPhotos([]);
      setPhotoPreviews([]);
      setIsSubmitting(false);
    }
  }, [open, form]);

  useEffect(() => {
    const nextPreviews = selectedPhotos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews((previous) => {
      previous.forEach((url) => URL.revokeObjectURL(url));
      return nextPreviews;
    });

    return () => {
      nextPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedPhotos]);

  const handlePhotoSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) {
        event.target.value = "";
        return;
      }

      setSelectedPhotos((current) => {
        const availableSlots = Math.max(0, MAX_PHOTO_COUNT - current.length);
        const accepted = availableSlots === files.length ? files : files.slice(0, availableSlots);

        if (availableSlots === 0) {
          toast({
            title: "Limite atteinte",
            description: `Vous pouvez ajouter jusqu'à ${MAX_PHOTO_COUNT} photos.`,
            variant: "destructive",
          });
          return current;
        }

        if (accepted.length < files.length) {
          toast({
            title: "Photos supplémentaires ignorées",
            description: `Seules ${accepted.length} photos ont été ajoutées (limite ${MAX_PHOTO_COUNT}).`,
          });
        }

        return [...current, ...accepted];
      });

      event.target.value = "";
    },
    [toast],
  );

  const removePhoto = useCallback((index: number) => {
    setSelectedPhotos((current) => current.filter((_, idx) => idx !== index));
  }, []);

  const { data: subcontractors = [], isLoading: subcontractorsLoading } = useQuery<SubcontractorOption[]>({
    queryKey: ["subcontractors", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];

      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, name")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data ?? []) as SubcontractorOption[];
    },
    enabled: Boolean(open && currentOrgId),
  });

  const creationMutation = useMutation<StartChantierResponse, Error, StartChantierFormValues>({
    mutationFn: async (values) => {
      if (!currentOrgId) {
        throw new Error("Organisation non trouvée");
      }

      // Fetch project data
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("org_id", currentOrgId)
        .single();

      if (projectError || !project) {
        throw new Error("Projet introuvable");
      }

      // Create chantier directly
      const siteRef = `${project.project_ref}-CHANTIER`;
      
      const { data: chantier, error: chantierError } = await supabase
        .from("sites")
        .insert([{
          project_id: project.id,
          org_id: project.org_id,
          user_id: project.user_id,
          project_ref: project.project_ref,
          site_ref: siteRef,
          client_name: project.client_name,
          client_first_name: project.client_first_name,
          client_last_name: project.client_last_name,
          product_name: project.product_name,
          address: project.address || "",
          city: project.city,
          postal_code: project.postal_code,
          date_debut: values.startDate,
          date_fin_prevue: values.endDate?.trim() || null,
          subcontractor_id: values.subcontractorId,
          notes: serializeSiteNotes(values.notes, null, []),
          team_members: [],
        }])
        .select()
        .single();

      if (chantierError || !chantier) {
        throw new Error(chantierError?.message || "Impossible de créer le chantier");
      }

      return { chantier, project };
    },
  });

  const canSubmit = !creationMutation.isPending && !isSubmitting;

  const uploadPhotos = useCallback(
    async (chantier: StartChantierResponse["chantier"], internalNotes: string | undefined) => {
      if (selectedPhotos.length === 0) {
        return [] as DriveUploadResult[];
      }

      if (!currentOrgId) {
        toast({
          title: "Organisation introuvable",
          description: "Impossible de téléverser les photos sans organisation.",
          variant: "destructive",
        });
        return [] as DriveUploadResult[];
      }

      const connection = driveConnection.data;
      if (!connection || connection.status !== "connected") {
        toast({
          title: "Google Drive non connecté",
          description: "Connectez Google Drive dans les paramètres pour téléverser les photos.",
          variant: "destructive",
        });
        return [] as DriveUploadResult[];
      }

      const uploads: DriveUploadResult[] = [];

      for (const photo of selectedPhotos) {
        try {
          const result = await driveUpload.mutateAsync({
            orgId: currentOrgId,
            file: photo,
            entityType: "site",
            entityId: chantier.site_ref,
            description: `Photo chantier ${chantier.site_ref}`,
          });
          uploads.push(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Impossible de téléverser une photo sur Google Drive.";
          toast({ title: "Téléversement incomplet", description: message, variant: "destructive" });
        }
      }

      if (uploads.length > 0) {
        const normalized = normalizeDriveMetadata(uploads);
        const serializedNotes = serializeSiteNotes(internalNotes, normalized[0] ?? null, normalized);
        const { error } = await supabase
          .from("sites")
          .update({ notes: serializedNotes })
          .eq("id", chantier.id)
          .eq("org_id", chantier.org_id ?? currentOrgId);

        if (error) {
          toast({
            title: "Association des photos incomplète",
            description: "Les photos ont été envoyées sur Drive mais n'ont pas pu être liées au chantier.",
            variant: "destructive",
          });
          return [] as DriveUploadResult[];
        }

        return normalized;
      }

      return uploads;
    },
    [currentOrgId, driveConnection.data, driveUpload, selectedPhotos, toast],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await creationMutation.mutateAsync(values);
      const uploaded = await uploadPhotos(result.chantier, values.notes);

      const targetProjectId = result.chantier.project_id ?? projectId;
      queryClient.invalidateQueries({ queryKey: ["project-sites", targetProjectId] });
      queryClient.invalidateQueries({ queryKey: ["project", targetProjectId] });
      queryClient.invalidateQueries({ queryKey: ["project-status-events", targetProjectId] });

      const uploadsCount = uploaded.length;
      toast({
        title: "Chantier démarré",
        description:
          uploadsCount > 0
            ? `${result.chantier.site_ref} est planifié. ${uploadsCount} photo(s) ont été ajoutées.`
            : `${result.chantier.site_ref} est planifié et visible dans la liste des chantiers.`,
      });

      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de démarrer le chantier. Veuillez réessayer.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  });


  const remainingPhotos = MAX_PHOTO_COUNT - selectedPhotos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Démarrer le chantier</DialogTitle>
          <DialogDescription>
            Initialisez un chantier pour {projectRef ? `le projet ${projectRef}` : "ce projet"}.
            {projectName ? ` (${projectName})` : ""}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => {
                  const selectedDate = field.value ? new Date(field.value) : undefined;
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date de début</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {formatDateLabel(field.value)}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => {
                  const selectedDate = field.value ? new Date(field.value) : undefined;
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fin prévisionnelle</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value?.trim()
                                ? formatDateLabel(field.value)
                                : "Choisir une date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="subcontractorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sous-traitant</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                    value={field.value ?? "__none__"}
                    disabled={subcontractorsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            subcontractorsLoading
                              ? "Chargement..."
                              : subcontractors.length === 0
                                ? "Aucun sous-traitant configuré"
                                : "Sélectionner un sous-traitant"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {subcontractors.map((option) => (
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
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes internes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ajoutez des consignes ou informations internes pour l'équipe chantier."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Photos du chantier</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {remainingPhotos > 0
                    ? `${remainingPhotos} photo(s) supplémentaires possibles`
                    : "Limite atteinte"}
                </span>
              </div>

              <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center">
                <input
                  id="chantier-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelection}
                  disabled={remainingPhotos <= 0}
                />
                <label
                  htmlFor="chantier-photos"
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 text-sm",
                    remainingPhotos <= 0 && "cursor-not-allowed opacity-60",
                  )}
                >
                  <FileImage className="h-10 w-10 text-muted-foreground" />
                  <span className="font-medium">
                    {remainingPhotos <= 0
                      ? "Nombre maximal de photos atteint"
                      : "Glissez-déposez ou cliquez pour ajouter"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Formats JPG, PNG. Téléversement direct vers Google Drive après création.
                  </span>
                </label>
              </div>

              {photoPreviews.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {photoPreviews.map((previewUrl, index) => (
                    <div key={previewUrl} className="group relative overflow-hidden rounded-lg border bg-background">
                      <img src={previewUrl} alt={`Photo ${index + 1}`} className="h-40 w-full object-cover" />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute right-2 top-2 h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removePhoto(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Démarrage...
                    </>
                  ) : (
                    "Démarrer le chantier"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

