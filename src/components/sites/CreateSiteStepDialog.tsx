import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { ChevronLeft, ChevronRight, Upload, X, CheckCircle2 } from "lucide-react";
import type { SiteProjectOption } from "./SiteDialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organizations/OrgContext";

const siteStepSchema = z.object({
  // Step 1: Informations générales - All optional for navigation
  project_ref: z.string().optional().default(""),
  client_name: z.string().optional().default(""),
  product_name: z.string().optional().nullable(),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  postal_code: z.string().optional().default(""),
  date_debut: z.string().optional().default(""),
  
  // Step 2: Détails techniques
  surface_facturee: z.coerce.number().min(0).optional().default(0),
  subcontractor_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  
  // Step 3: Avant chantier (photos)
  photos_avant: z.array(z.instanceof(File)).optional().default([]),
});

export type CreateSiteStepValues = z.infer<typeof siteStepSchema>;

interface CreateSiteStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateSiteStepValues) => void;
  projects?: SiteProjectOption[];
  initialProjectId?: string;
}

const STEPS = [
  { id: 1, title: "Informations générales", description: "Projet et localisation" },
  { id: 2, title: "Détails techniques", description: "Surfaces et équipe" },
  { id: 3, title: "Avant chantier", description: "Photos et documents" },
  { id: 4, title: "Récapitulatif", description: "Validation finale" },
];

export const CreateSiteStepDialog = ({
  open,
  onOpenChange,
  onSubmit,
  projects = [],
  initialProjectId,
}: CreateSiteStepDialogProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [photosAvant, setPhotosAvant] = useState<File[]>([]);
  const { currentOrgId } = useOrg();

  const { data: subcontractors = [], isLoading: subcontractorsLoading } = useQuery({
    queryKey: ["subcontractors", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [] as { id: string; name: string }[];

      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, name")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!currentOrgId,
  });

  const form = useForm<CreateSiteStepValues>({
    resolver: zodResolver(siteStepSchema),
    defaultValues: {
      project_ref: "",
      client_name: "",
      product_name: "",
      address: "",
      city: "",
      postal_code: "",
      date_debut: new Date().toISOString().slice(0, 10),
      surface_facturee: 0,
      subcontractor_id: null,
      notes: "",
      photos_avant: [],
    },
  });

  // Handle initial project selection
  useEffect(() => {
    if (initialProjectId && projects.length > 0 && open) {
      const project = projects.find(p => p.id === initialProjectId);
      if (project) {
        handleProjectSelect(project.project_ref);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId, projects, open]);

  const selectedProject = useMemo(() => {
    const projectRef = form.watch("project_ref");
    return projects.find(p => p.project_ref === projectRef);
  }, [form.watch("project_ref"), projects]);

  const selectedSubcontractorId = form.watch("subcontractor_id");
  const selectedSubcontractor =
    subcontractors.find((option) => option.id === selectedSubcontractorId) ?? null;

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = async () => {
    // All fields are optional now, so users can navigate freely
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleProjectSelect = (projectRef: string) => {
    const project = projects.find(p => p.project_ref === projectRef);
    if (project) {
      form.setValue("project_ref", project.project_ref);
      form.setValue("client_name", project.client_name);
      form.setValue("product_name", project.product_name);
      form.setValue("address", project.address || "");
      form.setValue("city", project.city);
      form.setValue("postal_code", project.postal_code);
      if (typeof project.surface_facturee === "number") {
        form.setValue("surface_facturee", project.surface_facturee);
      }
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length + photosAvant.length > 6) {
      return; // Max 6 photos
    }
    setPhotosAvant([...photosAvant, ...files]);
    form.setValue("photos_avant", [...photosAvant, ...files]);
  };

  const removePhoto = (index: number) => {
    const updated = photosAvant.filter((_, i) => i !== index);
    setPhotosAvant(updated);
    form.setValue("photos_avant", updated);
  };

  const handleSubmitForm = form.handleSubmit((values) => {
    onSubmit({ ...values, photos_avant: photosAvant });
    form.reset();
    setPhotosAvant([]);
    setCurrentStep(1);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Créer un nouveau chantier</DialogTitle>
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Étape {currentStep} sur {STEPS.length}
              </span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-muted-foreground text-sm">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmitForm} className="space-y-6">
            {/* Step 1: Informations générales */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informations générales</h3>
                
                <FormField
                  control={form.control}
                  name="project_ref"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Projet associé *</FormLabel>
                      <Select onValueChange={handleProjectSelect} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un projet" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.project_ref} value={project.project_ref}>
                              {project.project_ref} - {project.client_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="product_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produit</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
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
                      <FormLabel>Adresse du chantier</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="date_debut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de début</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Détails techniques */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Détails techniques</h3>

                <FormField
                  control={form.control}
                  name="surface_facturee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surface facturée (m²)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subcontractor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sous-traitant</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "" ? null : value)}
                        value={field.value ?? ""}
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informations complémentaires..."
                          {...field}
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Avant chantier */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Photos avant chantier</h3>
                <p className="text-sm text-muted-foreground">
                  Ajoutez jusqu'à 6 photos de l'état initial du chantier
                </p>

                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                    disabled={photosAvant.length >= 6}
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`cursor-pointer ${photosAvant.length >= 6 ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {photosAvant.length >= 6
                        ? "Nombre maximum de photos atteint"
                        : "Cliquez pour ajouter des photos"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {photosAvant.length} / 6 photos
                    </p>
                  </label>
                </div>

                {photosAvant.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {photosAvant.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Récapitulatif */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Récapitulatif
                </h3>

                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <div>
                    <p className="text-sm text-muted-foreground">Projet</p>
                    <p className="font-medium">{form.getValues("project_ref")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{form.getValues("client_name")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">
                      {form.getValues("address")}, {form.getValues("postal_code")}{" "}
                      {form.getValues("city")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de début</p>
                    <p className="font-medium">
                      {new Date(form.getValues("date_debut")).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {form.getValues("surface_facturee") > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Surface</p>
                      <p className="font-medium">{form.getValues("surface_facturee")} m²</p>
                    </div>
                  )}
                  {selectedSubcontractor && (
                    <div>
                      <p className="text-sm text-muted-foreground">Sous-traitant</p>
                      <p className="font-medium">{selectedSubcontractor.name}</p>
                    </div>
                  )}
                  {photosAvant.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Photos avant chantier</p>
                      <p className="font-medium">{photosAvant.length} photo(s)</p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Statut initial:</strong> Planifié
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Le chantier sera créé avec le statut "Planifié" et sera synchronisé avec votre
                    planning.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Précédent
              </Button>

              {currentStep < STEPS.length ? (
                <Button type="button" onClick={handleNext}>
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit">Créer le chantier</Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
