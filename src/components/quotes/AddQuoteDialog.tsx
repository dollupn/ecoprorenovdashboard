import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import * as z from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useToast } from "@/hooks/use-toast";

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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const quoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

const quoteSchema = z.object({
  quote_ref: z.string().min(3, "La référence est requise"),
  client_name: z.string().min(2, "Le nom du client est requis"),
  product_name: z.string().min(2, "Le nom du produit est requis"),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  status: z.enum(quoteStatuses),
  project_id: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

type ProjectOption = Pick<Tables<"projects">, "id" | "project_ref" | "client_name">;

export interface AddQuoteDialogProps {
  onQuoteAdded?: () => void | Promise<void>;
  trigger?: ReactNode;
  initialValues?: Partial<QuoteFormValues>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const baseDefaultValues: QuoteFormValues = {
  quote_ref: "",
  client_name: "",
  product_name: "",
  amount: "" as unknown as number,
  status: "DRAFT",
  project_id: undefined,
  valid_until: "",
  notes: "",
};

const generateQuoteReference = () => {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DEV-${year}-${random}`;
};

export const AddQuoteDialog = ({
  onQuoteAdded,
  trigger,
  initialValues,
  open,
  onOpenChange,
}: AddQuoteDialogProps) => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { toast } = useToast();

  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;

  const setDialogOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [onOpenChange]
  );

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: baseDefaultValues,
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["projects", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("projects")
        .select("id, project_ref, client_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.project_ref,
        description: project.client_name,
      })),
    [projects]
  );

  useEffect(() => {
    if (!dialogOpen) {
      form.reset(baseDefaultValues);
      return;
    }

    const values: QuoteFormValues = {
      ...baseDefaultValues,
      ...initialValues,
    } as QuoteFormValues;

    if (typeof initialValues?.amount === "number") {
      values.amount = initialValues.amount.toString() as unknown as number;
    }

    if (!values.quote_ref) {
      values.quote_ref = generateQuoteReference();
    }

    form.reset(values);
  }, [dialogOpen, initialValues, form]);

  const handleSubmit = async (data: QuoteFormValues) => {
    if (!user) {
      toast({
        title: "Authentification requise",
        description: "Veuillez vous connecter pour créer un devis.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("quotes").insert([
        {
          user_id: user.id,
          org_id: currentOrgId ?? null,
          quote_ref: data.quote_ref,
          client_name: data.client_name,
          product_name: data.product_name,
          amount: data.amount,
          status: data.status,
          project_id: data.project_id || null,
          valid_until: data.valid_until || null,
          notes: data.notes || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Devis créé",
        description: "Le devis a été ajouté avec succès.",
      });

      setDialogOpen(false);
      form.reset(baseDefaultValues);
      await onQuoteAdded?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue lors de la création du devis.";

      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau devis</DialogTitle>
          <DialogDescription>
            Renseignez les informations du devis à créer.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quote_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence *</FormLabel>
                    <FormControl>
                      <Input placeholder="DEV-2024-001" {...field} />
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
                          <SelectValue placeholder="Sélectionner un statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {quoteStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
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
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <FormControl>
                      <Input placeholder="Société Martin" {...field} />
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
                    <FormLabel>Solution proposée *</FormLabel>
                    <FormControl>
                      <Input placeholder="Isolation toiture" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant HT *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="15000"
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validité</FormLabel>
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
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projet associé</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value || undefined)}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un projet" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Aucun projet</SelectItem>
                      {projectOptions.length === 0 ? (
                        <SelectItem value="no-project" disabled>
                          Aucun projet disponible
                        </SelectItem>
                      ) : (
                        projectOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
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
                      placeholder="Conditions particulières, informations complémentaires..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <PlusCircle className="w-4 h-4 mr-2" />
                Créer le devis
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuoteDialog;
