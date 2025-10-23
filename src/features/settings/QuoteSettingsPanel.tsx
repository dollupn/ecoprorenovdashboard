import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, FileText, Users, Building2, Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

interface Subcontractor {
  id: string;
  name: string;
  description: string | null;
}

interface Delegate {
  id: string;
  name: string;
  description: string | null;
  price_eur_per_mwh: number;
}

const RichTextEditor = ({ content, onChange }: { content: string; onChange: (html: string) => void }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border">
      <div className="flex gap-1 border-b bg-muted/30 p-2">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("underline") ? "secondary" : "ghost"}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <div className="mx-1 w-px bg-border" />
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm min-h-[120px] max-w-none p-3" />
    </div>
  );
};

export function QuoteSettingsPanel() {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();

  const [newSubcontractor, setNewSubcontractor] = useState({ name: "", description: "" });
  const [newDelegate, setNewDelegate] = useState({ name: "", description: "", price_eur_per_mwh: "" });

  const { data: subcontractors = [] } = useQuery({
    queryKey: ["subcontractors", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("*")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Subcontractor[];
    },
    enabled: !!currentOrgId,
  });

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

  const createSubcontractor = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const { error } = await supabase.from("subcontractors").insert({
        org_id: currentOrgId!,
        name: data.name,
        description: data.description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", currentOrgId] });
      setNewSubcontractor({ name: "", description: "" });
      toast({ title: "Sous-traitant créé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le sous-traitant", variant: "destructive" });
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
  });

  const createDelegate = useMutation({
    mutationFn: async (data: { name: string; description: string; price_eur_per_mwh: number }) => {
      if (!Number.isFinite(data.price_eur_per_mwh) || data.price_eur_per_mwh < 0) {
        throw new Error("INVALID_PRICE");
      }

      const { error } = await supabase.from("delegates").insert({
        org_id: currentOrgId!,
        name: data.name,
        description: data.description,
        price_eur_per_mwh: data.price_eur_per_mwh,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegates", currentOrgId] });
      setNewDelegate({ name: "", description: "", price_eur_per_mwh: "" });
      toast({ title: "Délégataire créé avec succès" });
    },
    onError: (error) => {
      const description =
        error instanceof Error && error.message === "INVALID_PRICE"
          ? "Le prix €/MWh doit être un nombre positif."
          : "Impossible de créer le délégataire";

      toast({ title: "Erreur", description, variant: "destructive" });
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
              <RichTextEditor content="<p>Décrivez ici votre prestation...</p>" onChange={() => {}} />
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
            <div className="space-y-2">
              <Label htmlFor="subcontractor-name">Nom du sous-traitant</Label>
              <Input
                id="subcontractor-name"
                placeholder="Entreprise Dupont"
                value={newSubcontractor.name}
                onChange={(e) => setNewSubcontractor((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcontractor-description">Description</Label>
              <Textarea
                id="subcontractor-description"
                placeholder="Spécialiste en isolation thermique"
                value={newSubcontractor.description}
                onChange={(e) => setNewSubcontractor((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <Button
              onClick={() =>
                newSubcontractor.name.trim() &&
                createSubcontractor.mutate({
                  name: newSubcontractor.name.trim(),
                  description: newSubcontractor.description.trim(),
                })
              }
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter un sous-traitant
            </Button>

            <div className="space-y-3">
              {subcontractors.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  Aucun sous-traitant configuré.
                </p>
              ) : (
                subcontractors.map((subcontractor) => (
                  <div
                    key={subcontractor.id}
                    className="flex items-start justify-between rounded-lg border border-border/60 p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{subcontractor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {subcontractor.description ?? "Aucune description"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubcontractor.mutate(subcontractor.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
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
            <div className="grid gap-4 md:grid-cols-3">
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
                <Label htmlFor="delegate-price">Prix (€/MWh)</Label>
                <Input
                  id="delegate-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={newDelegate.price_eur_per_mwh}
                  onChange={(e) =>
                    setNewDelegate((prev) => ({ ...prev, price_eur_per_mwh: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="delegate-description">Contenu par défaut</Label>
                <RichTextEditor
                  content={newDelegate.description || "<p>Décrivez ici votre prestation...</p>"}
                  onChange={(html) => setNewDelegate((prev) => ({ ...prev, description: html }))}
                />
              </div>
            </div>
            <Button
              onClick={() => {
                const name = newDelegate.name.trim();
                if (!name) {
                  toast({
                    title: "Nom requis",
                    description: "Veuillez renseigner le nom du délégataire.",
                    variant: "destructive",
                  });
                  return;
                }

                const priceValue = Number.parseFloat(
                  newDelegate.price_eur_per_mwh.toString().replace(/,/g, "."),
                );

                if (!Number.isFinite(priceValue) || priceValue < 0) {
                  toast({
                    title: "Prix invalide",
                    description: "Veuillez saisir un prix €/MWh valide.",
                    variant: "destructive",
                  });
                  return;
                }

                createDelegate.mutate({
                  name,
                  description: newDelegate.description.trim(),
                  price_eur_per_mwh: priceValue,
                });
              }}
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
                      <p className="text-sm text-muted-foreground">
                        Prix: {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(delegate.price_eur_per_mwh)}
                        /MWh
                      </p>
                      <div
                        className="prose prose-sm mt-1 max-w-none text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: delegate.description ?? "<p>Aucune description</p>" }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDelegate.mutate(delegate.id)}
                    >
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
