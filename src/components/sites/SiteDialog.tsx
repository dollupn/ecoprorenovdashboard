import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

const teamMemberSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
});

const additionalCostSchema = z.object({
  label: z.string().min(1, "Intitulé requis"),
  amount: z.coerce
    .number({ invalid_type_error: "Montant invalide" })
    .min(0, "Le montant doit être positif"),
});

const siteSchema = z.object({
  site_ref: z.string().min(3, "Référence requise"),
  project_ref: z.string().min(3, "Référence projet requise"),
  client_name: z.string().min(2, "Client requis"),
  product_name: z.string().min(2, "Produit requis"),
  address: z.string().min(3, "Adresse requise"),
  city: z.string().min(2, "Ville requise"),
  postal_code: z.string().min(4, "Code postal invalide"),
  status: z.enum([
    "PLANIFIE",
    "EN_PREPARATION",
    "EN_COURS",
    "SUSPENDU",
    "TERMINE",
    "LIVRE",
  ]),
  cofrac_status: z.enum([
    "EN_ATTENTE",
    "CONFORME",
    "NON_CONFORME",
    "A_PLANIFIER",
  ]),
  date_debut: z.string().min(1, "Date de début requise"),
  date_fin_prevue: z.string().optional(),
  progress_percentage: z.coerce
    .number({ invalid_type_error: "Avancement invalide" })
    .min(0)
    .max(100),
  revenue: z.coerce
    .number({ invalid_type_error: "CA invalide" })
    .min(0, "Le CA doit être positif"),
  profit_margin: z.coerce
    .number({ invalid_type_error: "Marge invalide" })
    .min(-100, "Marge invalide")
    .max(100, "Marge invalide"),
  surface_facturee: z.coerce
    .number({ invalid_type_error: "Surface invalide" })
    .min(0, "Surface invalide"),
  cout_main_oeuvre_m2_ht: z.coerce
    .number({ invalid_type_error: "Coût invalide" })
    .min(0, "Coût invalide"),
  cout_isolation_m2: z.coerce
    .number({ invalid_type_error: "Coût invalide" })
    .min(0, "Coût invalide"),
  isolation_utilisee_m2: z.coerce
    .number({ invalid_type_error: "Quantité invalide" })
    .min(0, "Quantité invalide"),
  montant_commission: z.coerce
    .number({ invalid_type_error: "Montant invalide" })
    .min(0, "Montant invalide"),
  valorisation_cee: z.coerce
    .number({ invalid_type_error: "Montant invalide" })
    .min(0, "Montant invalide"),
  notes: z.string().optional(),
  team_members: z.array(teamMemberSchema).min(1, "Ajoutez au moins un membre"),
  additional_costs: z
    .array(additionalCostSchema)
    .min(1, "Ajoutez au moins un coût supplémentaire"),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

interface SiteDialogProps {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SiteFormValues) => void;
  initialValues?: Partial<SiteFormValues>;
}

const defaultValues: SiteFormValues = {
  site_ref: "",
  project_ref: "",
  client_name: "",
  product_name: "",
  address: "",
  city: "",
  postal_code: "",
  status: "PLANIFIE",
  cofrac_status: "EN_ATTENTE",
  date_debut: "",
  date_fin_prevue: "",
  progress_percentage: 0,
  revenue: 0,
  profit_margin: 0,
  surface_facturee: 0,
  cout_main_oeuvre_m2_ht: 0,
  cout_isolation_m2: 0,
  isolation_utilisee_m2: 0,
  montant_commission: 0,
  valorisation_cee: 0,
  notes: "",
  team_members: [{ name: "" }],
  additional_costs: [{ label: "", amount: 0 }],
};

const statusOptions = [
  { value: "PLANIFIE", label: "Planifié" },
  { value: "EN_PREPARATION", label: "En préparation" },
  { value: "EN_COURS", label: "En cours" },
  { value: "SUSPENDU", label: "Suspendu" },
  { value: "TERMINE", label: "Terminé" },
  { value: "LIVRE", label: "Livré" },
] as const;

const cofracStatusOptions = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "CONFORME", label: "Conforme" },
  { value: "NON_CONFORME", label: "Non conforme" },
  { value: "A_PLANIFIER", label: "Audit à planifier" },
] as const;

export const SiteDialog = ({
  open,
  mode,
  onOpenChange,
  onSubmit,
  initialValues,
}: SiteDialogProps) => {
  const mergedDefaults = useMemo(() => {
    const values: SiteFormValues = {
      ...defaultValues,
      ...initialValues,
      team_members:
        initialValues?.team_members && initialValues.team_members.length > 0
          ? initialValues.team_members
          : defaultValues.team_members,
      additional_costs:
        initialValues?.additional_costs && initialValues.additional_costs.length > 0
          ? initialValues.additional_costs
          : defaultValues.additional_costs,
    } as SiteFormValues;

    return values;
  }, [initialValues]);

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: mergedDefaults,
  });

  useEffect(() => {
    if (open) {
      form.reset(mergedDefaults);
    }
  }, [open, mergedDefaults, form]);

  const {
    fields: teamMemberFields,
    append: appendTeamMember,
    remove: removeTeamMember,
  } = useFieldArray({
    control: form.control,
    name: "team_members",
  });

  const {
    fields: costFields,
    append: appendCost,
    remove: removeCost,
  } = useFieldArray({
    control: form.control,
    name: "additional_costs",
  });

  const handleSubmit = (values: SiteFormValues) => {
    const filteredTeamMembers = values.team_members.filter(
      (member) => member.name.trim().length > 0,
    );

    const filteredCosts = values.additional_costs.filter(
      (cost) => cost.label.trim().length > 0,
    );

    onSubmit({
      ...values,
      team_members: filteredTeamMembers,
      additional_costs: filteredCosts,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nouveau chantier" : "Modifier le chantier"}
          </DialogTitle>
          <DialogDescription>
            Renseignez les informations financières et opérationnelles du chantier.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="site_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence chantier</FormLabel>
                    <FormControl>
                      <Input placeholder="SITE-2024-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="project_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence projet</FormLabel>
                    <FormControl>
                      <Input placeholder="PRJ-2024-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du client" {...field} />
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
                      <Input placeholder="Type de prestation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Adresse complète du chantier" {...field} />
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
                      <Input placeholder="Ville" {...field} />
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
                    <FormLabel>Code postal</FormLabel>
                    <FormControl>
                      <Input placeholder="31000" {...field} />
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
                control={form.control}
                name="cofrac_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut COFRAC</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cofracStatusOptions.map((option) => (
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <FormField
                control={form.control}
                name="progress_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avancement (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} step={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surface_facturee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface facturée (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chiffre d'affaires (€)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="profit_margin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marge (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step={0.1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cout_main_oeuvre_m2_ht"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coût main d'œuvre HT (€/m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cout_isolation_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coût isolation (€/m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isolation_utilisee_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Isolation utilisée (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="montant_commission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant de la commission (€)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={50} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valorisation_cee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valorisation CEE (€)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={50} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Équipe chantier</FormLabel>
              <div className="space-y-3">
                {teamMemberFields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`team_members.${index}.name`}
                    render={({ field: memberField }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input placeholder="Nom du membre" {...memberField} />
                          </FormControl>
                          {teamMemberFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTeamMember(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => appendTeamMember({ name: "" })}
              >
                <Plus className="w-4 h-4 mr-1" /> Ajouter un membre
              </Button>
            </div>

            <div className="space-y-2">
              <FormLabel>Coûts supplémentaires</FormLabel>
              <div className="space-y-3">
                {costFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`additional_costs.${index}.label`}
                      render={({ field: labelField }) => (
                        <FormItem className="md:col-span-4">
                          <FormControl>
                            <Input placeholder="Intitulé du coût" {...labelField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`additional_costs.${index}.amount`}
                      render={({ field: amountField }) => (
                        <FormItem className="md:col-span-2">
                          <FormControl>
                            <Input type="number" min={0} step={10} {...amountField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {costFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCost(index)}
                        className="md:col-span-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => appendCost({ label: "", amount: 0 })}
              >
                <Plus className="w-4 h-4 mr-1" /> Ajouter un coût
              </Button>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes internes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Informations complémentaires" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {mode === "create" ? "Créer le chantier" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
