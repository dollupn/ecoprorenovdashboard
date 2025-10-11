import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreateCategory } from "./api";

const categorySchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  description: z.string().max(255, "La description est trop longue").optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

type CategoryFormDialogProps = {
  orgId: string | null;
  trigger?: React.ReactNode;
};

export const CategoryFormDialog = ({ orgId, trigger }: CategoryFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createCategory = useCreateCategory(orgId);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const resetAndClose = () => {
    setOpen(false);
    form.reset();
  };

  const onSubmit = async (values: CategoryFormValues) => {
    if (!orgId) {
      toast({ 
        title: "Organisation manquante", 
        description: "Vous devez être membre d'une organisation pour créer des catégories", 
        variant: "destructive" 
      });
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
      });
      toast({ title: "Catégorie créée", description: `${values.name} a été ajoutée` });
      resetAndClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de créer la catégorie";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  // Afficher un message si pas d'organisation
  if (!orgId) {
    return trigger ? (
      <div className="relative">
        {trigger}
        <div className="absolute inset-0 cursor-not-allowed" onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toast({ 
            title: "Organisation manquante", 
            description: "Vous devez être membre d'une organisation. Contactez un administrateur.", 
            variant: "destructive" 
          });
        }} />
      </div>
    ) : null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle catégorie
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une catégorie</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Isolation, Chauffage..." autoFocus disabled={createCategory.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notes internes pour la catégorie"
                      rows={3}
                      disabled={createCategory.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose} disabled={createCategory.isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
