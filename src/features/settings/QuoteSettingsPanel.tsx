import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/form/RichTextEditor";
import { isRichTextEmpty } from "@/lib/rich-text";
import { Plus, Trash2, FileText, Users, Building2 } from "lucide-react";

interface Delegate {
  id: string;
  name: string;
  description: string | null;
  price_eur_per_mwh: number | null;
}

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function QuoteSettingsPanel() {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [newDelegate, setNewDelegate] = useState({ name: "", description: "", priceEurPerMwh: "" });

  const { data: delegates = [] } = useQuery({
    queryKey: ["delegates", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("delegates")
        .select("*")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Delegate[];
    },
    enabled: !!currentOrgId,
  });

  const createDelegate = useMutation({
    mutationFn: async (data: { name: string; description: string; priceEurPerMwh: string }) => {
      const sanitizedPrice = data.priceEurPerMwh.trim();
      const priceValue = sanitizedPrice === "" ? null : Number.parseFloat(sanitizedPrice.replace(/,/g, "."));

      if (priceValue !== null && Number.isNaN(priceValue)) {
        throw new Error("invalid-price");
      }

      const { error } = await supabase.from("delegates").insert({
        org_id: currentOrgId!,
        name: data.name,
        description: isRichTextEmpty(data.description) ? null : data.description,
        price_eur_per_mwh: priceValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegates", currentOrgId] });
      setNewDelegate({ name: "", description: "", priceEurPerMwh: "" });
      toast({ title: "Délégataire créé avec succès" });
    },
    onError: (error) => {
      const isInvalidPrice = error instanceof Error && error.message === "invalid-price";
      toast({
        title: "Erreur",
        description: isInvalidPrice
          ? "Veuillez saisir un tarif valide en euros par MWh."
          : "Impossible de créer le délégataire",
        variant: "destructive",
      });
    },
  });

  const deleteDelegate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delegates").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegates", currentOrgId] });
      toast({ title: "Délégataire supprimé" });
    },
  });

  const handleNavigateToSubcontractors = () => {
    navigate({
      pathname: location.pathname,
      search: `?section=subcontractors`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Paramètres Devis</h2>
        <p className="text-muted-foreground">
          Gérez vos modèles, prestataires et délégataires utilisés dans les devis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modèles de devis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Personnalisez le contenu et la mise en page de vos devis pour chaque type de prestation.
            </p>
            <div className="space-y-2">
              <Label>Titre du modèle</Label>
              <Input placeholder="Devis rénovation globale" />
            </div>
            <div className="space-y-2">
              <Label>Contenu par défaut</Label>
              <RichTextEditor value="<p>Décrivez ici votre prestation...</p>" onChange={() => {}} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost">Annuler</Button>
              <Button>Enregistrer le modèle</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sous-traitants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La gestion des sous-traitants se fait désormais depuis un panneau dédié afin de proposer la création,
              la modification et la définition d'un sous-traitant par défaut.
            </p>
            <Button variant="secondary" className="gap-2 self-start" onClick={handleNavigateToSubcontractors}>
              Ouvrir les paramètres sous-traitant
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Délégataires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delegate-name">Nom du délégataire</Label>
                <Input
                  id="delegate-name"
                  placeholder="Société partenaire"
                  value={newDelegate.name}
                  onChange={(e) => setNewDelegate((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delegate-price">Tarif (€/MWh)</Label>
                <Input
                  id="delegate-price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0,00"
                  value={newDelegate.priceEurPerMwh}
                  onChange={(e) => setNewDelegate((prev) => ({ ...prev, priceEurPerMwh: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="delegate-description">Contenu par défaut</Label>
                <RichTextEditor
                  value={newDelegate.description}
                  onChange={(html) => setNewDelegate((prev) => ({ ...prev, description: html }))}
                  placeholder="Décrivez ici votre prestation..."
                />
              </div>
            </div>
            <Button
              onClick={() =>
                newDelegate.name.trim() &&
                createDelegate.mutate({
                  name: newDelegate.name.trim(),
                  description: newDelegate.description,
                  priceEurPerMwh: newDelegate.priceEurPerMwh,
                })
              }
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter un délégataire
            </Button>

            <div className="space-y-3">
              {delegates.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  Aucun délégataire configuré.
                </p>
              ) : (
                delegates.map((delegate) => (
                  <div
                    key={delegate.id}
                    className="flex items-start justify-between rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{delegate.name}</p>
                      {delegate.price_eur_per_mwh !== null ? (
                        <p className="text-sm text-primary">
                          Tarif&nbsp;: {priceFormatter.format(delegate.price_eur_per_mwh)} €/MWh
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Tarif non renseigné</p>
                      )}
                      <div
                        className="prose prose-sm mt-1 max-w-none text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: delegate.description ?? "<p>Aucune description</p>" }}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteDelegate.mutate(delegate.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
