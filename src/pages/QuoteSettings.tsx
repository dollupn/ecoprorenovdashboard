import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, FileText, Users, Building2 } from "lucide-react";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

interface Subcontractor {
  id: string;
  name: string;
  description: string | null;
}

interface Delegate {
  id: string;
  name: string;
  description: string | null;
}

const RichTextEditor = ({ content, onChange }: { content: string; onChange: (html: string) => void }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-md">
      <div className="flex gap-1 p-2 border-b bg-muted/30">
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
        <div className="w-px bg-border mx-1" />
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
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 min-h-[120px]" />
    </div>
  );
};

const QuoteSettings = () => {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();

  const [newSubcontractor, setNewSubcontractor] = useState({ name: "", description: "" });
  const [newDelegate, setNewDelegate] = useState({ name: "", description: "" });

  // Fetch subcontractors
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

  // Fetch delegates
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

  // Create subcontractor
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

  // Delete subcontractor
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

  // Create delegate
  const createDelegate = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const { error } = await supabase.from("delegates").insert({
        org_id: currentOrgId!,
        name: data.name,
        description: data.description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegates", currentOrgId] });
      setNewDelegate({ name: "", description: "" });
      toast({ title: "Délégataire créé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le délégataire", variant: "destructive" });
    },
  });

  // Delete delegate
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
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres Devis</h1>
          <p className="text-muted-foreground">Configuration des sous-traitants et délégataires</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Subcontractors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Sous-traitants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Nom</Label>
                <Input
                  placeholder="Nom du sous-traitant"
                  value={newSubcontractor.name}
                  onChange={(e) => setNewSubcontractor({ ...newSubcontractor, name: e.target.value })}
                />
                
                <Label>Description</Label>
                <RichTextEditor
                  content={newSubcontractor.description}
                  onChange={(html) => setNewSubcontractor({ ...newSubcontractor, description: html })}
                />

                <Button
                  onClick={() => createSubcontractor.mutate(newSubcontractor)}
                  disabled={!newSubcontractor.name || createSubcontractor.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un sous-traitant
                </Button>
              </div>

              <div className="space-y-2 pt-4 border-t">
                {subcontractors.map((sub) => (
                  <div key={sub.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{sub.name}</p>
                      {sub.description && (
                        <div
                          className="text-sm text-muted-foreground prose prose-sm"
                          dangerouslySetInnerHTML={{ __html: sub.description }}
                        />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSubcontractor.mutate(sub.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {subcontractors.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Aucun sous-traitant configuré
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delegates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Délégataires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Nom</Label>
                <Input
                  placeholder="Nom du délégataire"
                  value={newDelegate.name}
                  onChange={(e) => setNewDelegate({ ...newDelegate, name: e.target.value })}
                />
                
                <Label>Description</Label>
                <RichTextEditor
                  content={newDelegate.description}
                  onChange={(html) => setNewDelegate({ ...newDelegate, description: html })}
                />

                <Button
                  onClick={() => createDelegate.mutate(newDelegate)}
                  disabled={!newDelegate.name || createDelegate.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un délégataire
                </Button>
              </div>

              <div className="space-y-2 pt-4 border-t">
                {delegates.map((del) => (
                  <div key={del.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{del.name}</p>
                      {del.description && (
                        <div
                          className="text-sm text-muted-foreground prose prose-sm"
                          dangerouslySetInnerHTML={{ __html: del.description }}
                        />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDelegate.mutate(del.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {delegates.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Aucun délégataire configuré
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default QuoteSettings;
