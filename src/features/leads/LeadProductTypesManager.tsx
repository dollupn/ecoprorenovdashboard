import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import {
  useCreateLeadProductType,
  useDeleteLeadProductType,
  useLeadProductTypes,
  type LeadProductTypeRecord,
} from "./api";

export const LeadProductTypesManager = () => {
  const { currentOrgId } = useOrg();
  const { toast } = useToast();
  const [newType, setNewType] = useState("");
  const [pendingDelete, setPendingDelete] = useState<LeadProductTypeRecord | null>(null);

  const {
    data: productTypes = [],
    isLoading,
    isError,
    error,
  } = useLeadProductTypes(currentOrgId);

  const createType = useCreateLeadProductType(currentOrgId);
  const deleteType = useDeleteLeadProductType(currentOrgId);

  const normalizedTypeNames = useMemo(
    () => productTypes.map((type) => type.name.trim().toLowerCase()),
    [productTypes]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentOrgId) {
      toast({
        title: "Organisation requise",
        description: "Vous devez appartenir à une organisation pour ajouter des types de produit.",
        variant: "destructive",
      });
      return;
    }

    const trimmed = newType.trim();

    if (!trimmed) {
      toast({
        title: "Type invalide",
        description: "Veuillez saisir un nom de type de produit.",
        variant: "destructive",
      });
      return;
    }

    if (normalizedTypeNames.includes(trimmed.toLowerCase())) {
      toast({
        title: "Type existant",
        description: `${trimmed} est déjà disponible dans votre organisation.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await createType.mutateAsync({ name: trimmed });
      toast({
        title: "Type ajouté",
        description: `${trimmed} est désormais disponible lors de la création de leads.`,
      });
      setNewType("");
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible d'ajouter le type de produit";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteType.mutateAsync(pendingDelete.id);
      toast({
        title: "Type supprimé",
        description: `${pendingDelete.name} ne sera plus proposé dans le formulaire de lead.`,
      });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de supprimer le type de produit";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setPendingDelete(null);
    }
  };

  if (!currentOrgId) {
    return (
      <p className="text-sm text-muted-foreground">
        Sélectionnez une organisation pour gérer vos types de produit.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={newType}
          onChange={(event) => setNewType(event.target.value)}
          placeholder="Ajouter un type (ex. Isolation, Led)"
          disabled={createType.isPending}
        />
        <Button type="submit" disabled={createType.isPending}>
          {createType.isPending ? "Ajout..." : "Ajouter"}
        </Button>
      </form>

      {isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Impossible de charger les types de produit."}
        </p>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : productTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun type de produit enregistré pour le moment. Ajoutez vos catégories principales ci-dessus.
        </p>
      ) : (
        <ul className="space-y-2">
          {productTypes.map((type) => (
            <li
              key={type.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="font-medium">{type.name}</span>
              <AlertDialog
                open={pendingDelete?.id === type.id}
                onOpenChange={(open) => {
                  if (!open) {
                    setPendingDelete((prev) => (prev?.id === type.id ? null : prev));
                  } else {
                    setPendingDelete(type);
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer le type {type.name} ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action retirera le type de la liste proposée lors de la création des leads.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteType.isPending}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleteType.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
