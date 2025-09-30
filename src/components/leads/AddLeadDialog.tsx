import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";
import { leadStatusEnum } from "./status";
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
import { Plus } from "lucide-react";

const leadSchema = z.object({
  full_name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  company: z.string().optional(),
  email: z.string().email("Email invalide"),
  phone_raw: z.string().min(10, "Numéro de téléphone invalide"),
  city: z.string().min(2, "La ville est requise"),
  postal_code: z.string().min(5, "Code postal invalide"),
  product_name: z.string().optional(),
  surface_m2: z.coerce.number().optional(),
  utm_source: z.string().optional(),
  status: leadStatusEnum,
  commentaire: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface AddLeadDialogProps {
  onLeadAdded?: () => void | Promise<void>;
}

export const AddLeadDialog = ({ onLeadAdded }: AddLeadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      full_name: "",
      company: "",
      email: "",
      phone_raw: "",
      city: "",
      postal_code: "",
      product_name: "",
      surface_m2: undefined,
      utm_source: "",
      status: "NEW",
      commentaire: "",
    },
  });

  const onSubmit = async (data: LeadFormValues) => {
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
      const { error } = await supabase.from("leads").insert([{
        user_id: user.id,
        full_name: data.full_name,
        email: data.email,
        phone_raw: data.phone_raw,
        city: data.city,
        postal_code: data.postal_code,
        status: data.status,
        company: data.company || undefined,
        product_name: data.product_name || undefined,
        surface_m2: data.surface_m2 || undefined,
        utm_source: data.utm_source || undefined,
        commentaire: data.commentaire || undefined,
      }]);

      if (error) throw error;

      toast({
        title: "Lead créé",
        description: "Le lead a été ajouté avec succès",
      });

      form.reset();
      setOpen(false);
      await onLeadAdded?.();
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
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau lead</DialogTitle>
          <DialogDescription>
            Remplissez les informations du prospect
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet *</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
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
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produit</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surface_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="utm_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                        <SelectItem value="NEW">Nouveau</SelectItem>
                        <SelectItem value="QUALIFIED">Qualifié</SelectItem>
                        <SelectItem value="RDV_PLANIFIE">RDV Planifié</SelectItem>
                        <SelectItem value="CONVERTED">Converti</SelectItem>
                        <SelectItem value="ARCHIVED">Archivé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="commentaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commentaire</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
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
                {loading ? "Création..." : "Créer le lead"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
