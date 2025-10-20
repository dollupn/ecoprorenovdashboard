import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Calendar, Check, Mail } from "lucide-react";

interface AppointmentType {
  id: string;
  name: string;
  is_default: boolean;
  email_template_id: string | null;
}

const EMAIL_TEMPLATES = [
  { id: "confirmation", label: "Email de confirmation" },
  { id: "reminder_24h", label: "Rappel 24h avant" },
  { id: "reminder_1h", label: "Rappel 1h avant" },
  { id: "followup", label: "Email de suivi" },
];

const DEFAULT_APPOINTMENT_TYPES = [
  "Pré-visite",
  "Visite technique",
  "Signature devis",
  "Signature AH",
  "Travaux",
];

export function AppointmentSettingsPanel() {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeEmailTemplate, setNewTypeEmailTemplate] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState(false);

  const { data: appointmentTypes = [], isLoading } = useQuery({
    queryKey: ["appointmentTypes", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("appointment_types")
        .select("*")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as AppointmentType[];
    },
    enabled: !!currentOrgId,
  });

  useEffect(() => {
    const initializeDefaults = async () => {
      if (!currentOrgId || isLoading || isInitializing) return;
      if (appointmentTypes.length > 0) return;

      setIsInitializing(true);
      try {
        const defaultTypes = DEFAULT_APPOINTMENT_TYPES.map((name) => ({
          org_id: currentOrgId,
          name,
          is_default: true,
        }));

        const { error } = await supabase.from("appointment_types").insert(defaultTypes);
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["appointmentTypes", currentOrgId] });
      } catch (error) {
        console.error("Error initializing default appointment types:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    void initializeDefaults();
  }, [currentOrgId, appointmentTypes.length, isLoading, isInitializing, queryClient]);

  const createAppointmentType = useMutation({
    mutationFn: async (data: { name: string; email_template_id: string | null }) => {
      const { error } = await supabase.from("appointment_types").insert({
        org_id: currentOrgId!,
        name: data.name,
        email_template_id: data.email_template_id,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointmentTypes", currentOrgId] });
      setNewTypeName("");
      setNewTypeEmailTemplate("");
      toast({ title: "Type de RDV créé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le type de RDV", variant: "destructive" });
    },
  });

  const deleteAppointmentType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointment_types")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointmentTypes", currentOrgId] });
      toast({ title: "Type de RDV supprimé" });
    },
  });

  const updateAppointmentType = useMutation({
    mutationFn: async (data: { id: string; email_template_id: string | null }) => {
      const { error } = await supabase
        .from("appointment_types")
        .update({ email_template_id: data.email_template_id })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointmentTypes", currentOrgId] });
      toast({ title: "Automation mise à jour" });
    },
  });

  const handleCreateType = () => {
    if (!newTypeName.trim()) return;
    createAppointmentType.mutate({
      name: newTypeName.trim(),
      email_template_id: newTypeEmailTemplate || null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Types de rendez-vous</h2>
        <p className="text-muted-foreground">
          Gérez les types de rendez-vous disponibles pour votre planning.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Types de RDV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-type">Nouveau type de rendez-vous</Label>
              <Input
                id="new-type"
                placeholder="Ex: Réunion de chantier"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateType();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-template">Automation email (optionnel)</Label>
              <Select value={newTypeEmailTemplate} onValueChange={setNewTypeEmailTemplate}>
                <SelectTrigger id="email-template">
                  <SelectValue placeholder="Sélectionner un template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {EMAIL_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreateType} disabled={!newTypeName.trim() || createAppointmentType.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>

          <div className="space-y-2 border-t pt-4">
            {isLoading || isInitializing ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Chargement des types de RDV...
              </p>
            ) : appointmentTypes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun type de RDV configuré
              </p>
            ) : (
              appointmentTypes.map((type) => (
                <div
                  key={type.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">{type.name}</span>
                      {type.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="mr-1 h-3 w-3" />
                          Par défaut
                        </Badge>
                      )}
                    </div>
                    {!type.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => deleteAppointmentType.mutate(type.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={`template-${type.id}`} className="text-sm text-muted-foreground">
                      Automation:
                    </Label>
                    <Select
                      value={type.email_template_id || "none"}
                      onValueChange={(value) =>
                        updateAppointmentType.mutate({
                          id: type.id,
                          email_template_id: value === "none" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger id={`template-${type.id}`} className="h-8 w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {EMAIL_TEMPLATES.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>

          {appointmentTypes.some((t) => t.is_default) && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Les types par défaut sont fournis lors de l'initialisation de votre organisation et ne peuvent pas être supprimés.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
