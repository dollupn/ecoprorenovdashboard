import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const projectSchema = z.object({
  project_ref: z.string().min(3, "La référence est requise"),
  client_name: z.string().min(2, "Le nom du client est requis"),
  company: z.string().optional(),
  product_name: z.string().min(2, "Le produit est requis"),
  city: z.string().min(2, "La ville est requise"),
  postal_code: z.string().min(5, "Code postal invalide"),
  surface_batiment_m2: z.coerce.number().optional(),
  surface_isolee_m2: z.coerce.number().optional(),
  status: z.enum(["PROSPECTION", "ETUDE", "DEVIS_ENVOYE", "ACCEPTE", "A_PLANIFIER", "EN_COURS", "LIVRE", "CLOTURE"]),
  assigned_to: z.string().min(2, "Assignation requise"),
  date_debut_prevue: z.string().optional(),
  date_fin_prevue: z.string().optional(),
  estimated_value: z.coerce.number().optional(),
  lead_id: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

interface AddProjectDialogProps {
  onProjectAdded?: () => void | Promise<void>;
  trigger?: ReactNode;
  initialValues?: Partial<ProjectFormValues>;
}

const baseDefaultValues: ProjectFormValues = {
  project_ref: "",
  client_name: "",
  company: "",
  product_name: "",
  city: "",
  postal_code: "",
  surface_batiment_m2: undefined,
  surface_isolee_m2: undefined,
  status: "PROSPECTION",
  assigned_to: "",
  date_debut_prevue: "",
  date_fin_prevue: "",
  estimated_value: undefined,
  lead_id: undefined,
};

export const AddProjectDialog = ({
  onProjectAdded,
  trigger,
  initialValues,
}: AddProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      ...baseDefaultValues,
      ...initialValues,
    },
  });

  const resetWithInitialValues = useCallback(() => {
    form.reset({
      ...baseDefaultValues,
      ...initialValues,
    });
  }, [form, initialValues]);

  useEffect(() => {
    if (open) {
      resetWithInitialValues();
    }
  }, [open, resetWithInitialValues]);

  const onSubmit = async (data: ProjectFormValues) => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("projects").insert([{
        user_id: user.id,
        project_ref: data.project_ref,
        client_name: data.client_name,
        product_name: data.product_name,
        city: data.city,
        postal_code: data.postal_code,
        status: data.status,
        assigned_to: data.assigned_to,
        company: data.company || undefined,
        surface_batiment_m2: data.surface_batiment_m2 || undefined,
        surface_isolee_m2: data.surface_isolee_m2 || undefined,
        date_debut_prevue: data.date_debut_prevue || undefined,
        date_fin_prevue: data.date_fin_prevue || undefined,
        estimated_value: data.estimated_value || undefined,
        lead_id: data.lead_id || undefined,
      }]);

      if (error) throw error;

      toast({
        title: "Projet créé",
        description: "Le projet a été ajouté avec succès",
      });

      resetWithInitialValues();
      setOpen(false);
      await onProjectAdded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Projet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau projet</DialogTitle>
          <DialogDescription>
            Remplissez les informations du projet
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence *</FormLabel>
                    <FormControl>
                      <Input placeholder="PRJ-2024-XXXX" {...field} />
                    </FormControl>
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
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PROSPECTION">Prospection</SelectItem>
                        <SelectItem value="ETUDE">Étude</SelectItem>
                        <SelectItem value="DEVIS_ENVOYE">Devis Envoyé</SelectItem>
                        <SelectItem value="ACCEPTE">Accepté</SelectItem>
                        <SelectItem value="A_PLANIFIER">À Planifier</SelectItem>
                        <SelectItem value="EN_COURS">En Cours</SelectItem>
                        <SelectItem value="LIVRE">Livré</SelectItem>
                        <SelectItem value="CLOTURE">Clôturé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du client *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entreprise</FormLabel>
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
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produit *</FormLabel>
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
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville *</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="surface_batiment_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface bâtiment (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surface_isolee_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface isolée (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigné à *</FormLabel>
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
                name="date_debut_prevue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début prévue</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_fin_prevue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin prévue</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="estimated_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant estimé (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Création..." : "Créer le projet"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
