import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Calendar, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface AppointmentType {
  id: string;
  name: string;
  is_default: boolean;
}

const DEFAULT_APPOINTMENT_TYPES = [
  "Pré-visite",
  "Visite technique",
  "Signature devis",
  "Signature AH",
  "Travaux",
];

const AppointmentSettings = () => {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();
  const [newTypeName, setNewTypeName] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);

  // Fetch appointment types
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

  // Initialize default types for new organizations
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

    initializeDefaults();
  }, [currentOrgId, appointmentTypes.length, isLoading, isInitializing, queryClient]);

  // Create appointment type
  const createAppointmentType = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("appointment_types").insert({
        org_id: currentOrgId!,
        name,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointmentTypes", currentOrgId] });
      setNewTypeName("");
      toast({ title: "Type de RDV créé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le type de RDV", variant: "destructive" });
    },
  });

  // Delete appointment type
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Types de Rendez-vous</h1>
          <p className="text-muted-foreground">
            Gérez les types de rendez-vous disponibles pour votre planning
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
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="new-type">Nouveau type de rendez-vous</Label>
                <Input
                  id="new-type"
                  placeholder="Ex: Réunion de chantier"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTypeName.trim()) {
                      createAppointmentType.mutate(newTypeName.trim());
                    }
                  }}
                />
              </div>
              <Button
                onClick={() => createAppointmentType.mutate(newTypeName.trim())}
                disabled={!newTypeName.trim() || createAppointmentType.isPending}
                className="self-end"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              {isLoading || isInitializing ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Chargement des types de RDV...
                </p>
              ) : appointmentTypes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Aucun type de RDV configuré
                </p>
              ) : (
                appointmentTypes.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">{type.name}</span>
                      {type.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Par défaut
                        </Badge>
                      )}
                    </div>
                    {!type.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAppointmentType.mutate(type.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            {appointmentTypes.some((t) => t.is_default) && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  💡 Les types par défaut ne peuvent pas être supprimés mais vous pouvez en ajouter autant que
                  nécessaire.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AppointmentSettings;
