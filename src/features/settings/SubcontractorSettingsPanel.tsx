import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/form/RichTextEditor";
import { isRichTextEmpty } from "@/lib/rich-text";
import { Loader2, Pencil, Trash2, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Subcontractor = Tables<"subcontractors">;

const sanitizeDescription = (value: string) => {
  if (!value) return null;
  return isRichTextEmpty(value) ? null : value;
};

interface EditSubcontractorDialogProps {
  subcontractor: Subcontractor;
  onSubmit: (payload: { id: string; name: string; description: string | null }) => Promise<void>;
  isSubmitting: boolean;
}

function EditSubcontractorDialog({ subcontractor, onSubmit, isSubmitting }: EditSubcontractorDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subcontractor.name);
  const [description, setDescription] = useState(subcontractor.description ?? "");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setName(subcontractor.name);
      setDescription(subcontractor.description ?? "");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await onSubmit({
        id: subcontractor.id,
        name: name.trim(),
        description: sanitizeDescription(description),
      });
      setOpen(false);
    } catch (error) {
      // The parent mutation will surface the error via toast.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="h-4 w-4" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le sous-traitant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-subcontractor-name-${subcontractor.id}`}>Nom</Label>
            <Input
              id={`edit-subcontractor-name-${subcontractor.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Entreprise Dupont"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-subcontractor-description-${subcontractor.id}`}>Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Spécialiste en isolation thermique"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubcontractorSettingsPanel() {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();

  const [newSubcontractor, setNewSubcontractor] = useState({ name: "", description: "" });

  const { data: subcontractors = [], isLoading } = useQuery({
    queryKey: ["subcontractors", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, name, description, is_default, is_active, org_id")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Subcontractor[];
    },
    enabled: !!currentOrgId,
  });

  const createSubcontractor = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      if (!currentOrgId) throw new Error("missing-organization");
      const { error } = await supabase.from("subcontractors").insert({
        org_id: currentOrgId,
        name: payload.name,
        description: sanitizeDescription(payload.description),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", currentOrgId] });
      setNewSubcontractor({ name: "", description: "" });
      toast({ title: "Sous-traitant créé" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le sous-traitant.",
        variant: "destructive",
      });
    },
  });

  const updateSubcontractor = useMutation({
    mutationFn: async (payload: { id: string; name: string; description: string | null }) => {
      const { error } = await supabase
        .from("subcontractors")
        .update({ name: payload.name, description: payload.description })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", currentOrgId] });
      toast({ title: "Sous-traitant mis à jour" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le sous-traitant.",
        variant: "destructive",
      });
    },
  });

  const deleteSubcontractor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subcontractors").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", currentOrgId] });
      toast({ title: "Sous-traitant supprimé" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le sous-traitant.",
        variant: "destructive",
      });
    },
  });

  const setDefaultSubcontractor = useMutation({
    mutationFn: async ({ id, makeDefault }: { id: string; makeDefault: boolean }) => {
      if (!currentOrgId) throw new Error("missing-organization");

      if (makeDefault) {
        const { error: resetError } = await supabase
          .from("subcontractors")
          .update({ is_default: false })
          .eq("org_id", currentOrgId);
        if (resetError) throw resetError;
      }

      const { error } = await supabase
        .from("subcontractors")
        .update({ is_default: makeDefault })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", currentOrgId] });
      toast({ title: "Sous-traitant mis à jour" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le sous-traitant par défaut.",
        variant: "destructive",
      });
    },
  });

  const orderedSubcontractors = useMemo(
    () => [...subcontractors].sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    [subcontractors],
  );

  const handleCreate = () => {
    if (!newSubcontractor.name.trim()) return;
    createSubcontractor.mutate({
      name: newSubcontractor.name.trim(),
      description: newSubcontractor.description,
    });
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Paramètres sous-traitant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subcontractor-name">Nom du sous-traitant</Label>
            <Input
              id="subcontractor-name"
              placeholder="Entreprise Dupont"
              value={newSubcontractor.name}
              onChange={(event) => setNewSubcontractor((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subcontractor-description">Description</Label>
            <RichTextEditor
              value={newSubcontractor.description}
              onChange={(html) => setNewSubcontractor((prev) => ({ ...prev, description: html }))}
              placeholder="Spécialiste en isolation thermique"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} className="gap-2" disabled={!newSubcontractor.name.trim() || createSubcontractor.isPending}>
              {createSubcontractor.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter un sous-traitant
            </Button>
          </div>
        </div>

        <Separator />

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : orderedSubcontractors.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            Aucun sous-traitant configuré pour le moment.
          </p>
        ) : (
          <div className="space-y-4">
            {orderedSubcontractors.map((subcontractor) => (
              <div
                key={subcontractor.id}
                className="flex flex-col gap-4 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{subcontractor.name}</p>
                    {subcontractor.is_default ? <Badge variant="secondary">Par défaut</Badge> : null}
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{
                      __html: subcontractor.description ?? "<p>Aucune description fournie.</p>",
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:w-52">
                  <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Sous-traitant par défaut</p>
                      <p className="text-xs text-muted-foreground">Utilisé automatiquement dans les devis.</p>
                    </div>
                    <Switch
                      checked={Boolean(subcontractor.is_default)}
                      onCheckedChange={(checked) =>
                        setDefaultSubcontractor.mutate({ id: subcontractor.id, makeDefault: checked })
                      }
                      disabled={setDefaultSubcontractor.isPending}
                      aria-label="Définir comme sous-traitant par défaut"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <EditSubcontractorDialog
                      subcontractor={subcontractor}
                      onSubmit={(payload) => updateSubcontractor.mutateAsync(payload)}
                      isSubmitting={updateSubcontractor.isPending}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start gap-2 text-destructive sm:justify-center"
                      onClick={() => deleteSubcontractor.mutate(subcontractor.id)}
                      disabled={deleteSubcontractor.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
