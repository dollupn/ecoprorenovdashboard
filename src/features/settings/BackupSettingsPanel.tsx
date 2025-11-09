import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Download, Save, Send } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { exportProjectsNow, testBackupWebhook } from "@/integrations/backups";

const formatTimeForInput = (time: string | null | undefined) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  if (!hours || !minutes) return "";
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const normalizeTimeForStorage = (time: string) => {
  if (!time) return null;
  const [hours, minutes] = time.split(":");
  if (!hours || !minutes) return null;
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
};

type BackupSettings = Pick<
  Tables<"settings">,
  "backup_webhook_url" | "backup_daily_enabled" | "backup_time"
>;

export function BackupSettingsPanel() {
  const { toast } = useToast();
  const { session } = useAuth();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [backupTime, setBackupTime] = useState("09:00");
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["backup-settings", currentOrgId],
    enabled: Boolean(currentOrgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings" as any)
        .select("backup_webhook_url, backup_daily_enabled, backup_time")
        .eq("org_id", currentOrgId!)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data ? (data as unknown as BackupSettings) : null;
    },
  });

  useEffect(() => {
    if (!settingsData) {
      setWebhookUrl("");
      setDailyEnabled(false);
      setBackupTime("09:00");
      return;
    }

    const settings = settingsData as any;
    setWebhookUrl(settings?.backup_webhook_url ?? "");
    const isDailyEnabled = Boolean(settings?.backup_daily_enabled);
    setDailyEnabled(isDailyEnabled);
    const formattedTime = formatTimeForInput(settings?.backup_time);
    setBackupTime(formattedTime || "09:00");
  }, [settingsData]);

  const initialValues = useMemo(
    () => {
      const settings = settingsData as any;
      return {
        webhook: settings?.backup_webhook_url?.trim() ?? "",
        daily: Boolean(settings?.backup_daily_enabled),
        time: formatTimeForInput(settings?.backup_time) || "09:00",
      };
    },
    [settingsData],
  );

  const validateWebhook = (value: string) => {
    if (!value.trim()) {
      return null;
    }

    try {
      // Automatically prepend https:// if missing
      const hasProtocol = /^https?:\/\//i.test(value.trim());
      const url = new URL(hasProtocol ? value.trim() : `https://${value.trim()}`);
      if (!url.hostname) {
        return "L'URL doit contenir un nom de domaine valide";
      }
    } catch (error) {
      return "URL de webhook invalide";
    }

    return null;
  };

  const handleWebhookChange = (value: string) => {
    setWebhookUrl(value);
    setWebhookError(validateWebhook(value));
  };

  const handleWebhookBlur = () => {
    if (!webhookUrl.trim()) {
      return;
    }

    const hasProtocol = /^https?:\/\//i.test(webhookUrl.trim());
    const formatted = hasProtocol ? webhookUrl.trim() : `https://${webhookUrl.trim()}`;
    setWebhookUrl(formatted);
    setWebhookError(validateWebhook(formatted));
  };

  const handleToggleDaily = (checked: boolean) => {
    setDailyEnabled(checked);
    if (checked && !backupTime) {
      setBackupTime("09:00");
    }
  };

  const handleTimeChange = (value: string) => {
    setBackupTime(value);
  };

  const isDirty = useMemo(() => {
    return (
      webhookUrl.trim() !== initialValues.webhook.trim() ||
      dailyEnabled !== initialValues.daily ||
      (dailyEnabled ? backupTime : "") !== (initialValues.daily ? initialValues.time : "")
    );
  }, [webhookUrl, dailyEnabled, backupTime, initialValues]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) {
        throw new Error("Aucune organisation active");
      }

      const formattedUrl = webhookUrl.trim()
        ? webhookUrl.trim().startsWith("http")
          ? webhookUrl.trim()
          : `https://${webhookUrl.trim()}`
        : null;
      const urlError = validateWebhook(formattedUrl ?? "");

      if (urlError) {
        setWebhookError(urlError);
        throw new Error(urlError);
      }

      if (dailyEnabled && !backupTime) {
        throw new Error("Définissez une heure d'exécution pour la synchronisation quotidienne");
      }

      const payload: Partial<Tables<"settings">> & { org_id: string } = {
        org_id: currentOrgId,
        backup_webhook_url: formattedUrl,
        backup_daily_enabled: dailyEnabled,
        backup_time: dailyEnabled ? normalizeTimeForStorage(backupTime) : null,
      };

      const { data, error } = await supabase
        .from("settings" as any)
        .upsert(payload, { onConflict: "org_id" })
        .select("backup_webhook_url, backup_daily_enabled, backup_time")
        .single();

      if (error) {
        throw error;
      }

      return data ? (data as unknown as BackupSettings) : null;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["backup-settings", currentOrgId], data);
      toast({ title: "Paramètres sauvegardés", description: "Les préférences de sauvegarde ont été mises à jour." });
    },
    onError: (error) => {
      toast({
        title: "Impossible d'enregistrer",
        description: error instanceof Error ? error.message : "Une erreur inattendue est survenue.",
        variant: "destructive",
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error("Session invalide");
      }
      if (!currentOrgId) {
        throw new Error("Aucune organisation active");
      }
      if (!webhookUrl.trim() || webhookError) {
        throw new Error("Configurez un webhook valide avant de tester");
      }

      await testBackupWebhook({ 
        accessToken: session.access_token, 
        orgId: currentOrgId,
        webhookUrl: webhookUrl.trim()
      });
    },
    onSuccess: () => {
      toast({ title: "Webhook testé", description: "Un appel de test a été envoyé au webhook de sauvegarde." });
    },
    onError: (error) => {
      toast({
        title: "Échec du test",
        description: error instanceof Error ? error.message : "Impossible de tester le webhook.",
        variant: "destructive",
      });
    },
  });

  const exportProjectsMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error("Session invalide");
      }
      if (!currentOrgId) {
        throw new Error("Aucune organisation active");
      }
      if (!webhookUrl.trim() || webhookError) {
        throw new Error("Définissez un webhook valide avant l'export");
      }

      await exportProjectsNow({ 
        accessToken: session.access_token, 
        orgId: currentOrgId,
        webhookUrl: webhookUrl.trim()
      });
    },
    onSuccess: () => {
      toast({
        title: "Export lancé",
        description: "Tous les projets ont été envoyés au webhook de sauvegarde.",
      });
    },
    onError: (error) => {
      toast({
        title: "Échec de l'export",
        description: error instanceof Error ? error.message : "Impossible de lancer l'export des projets.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!isDirty) {
      toast({ title: "Aucun changement", description: "Aucune modification à enregistrer." });
      return;
    }

    setWebhookError(validateWebhook(webhookUrl));
    saveMutation.mutate();
  };

  const actionDisabled = !webhookUrl.trim() || Boolean(webhookError) || !currentOrgId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cloud className="h-5 w-5" />
          Sauvegardes automatiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="backup-webhook">URL du webhook de sauvegarde</Label>
          <Input
            id="backup-webhook"
            value={webhookUrl}
            onChange={(event) => handleWebhookChange(event.target.value)}
            onBlur={handleWebhookBlur}
            placeholder="https://example.com/webhook"
            disabled={isLoading || saveMutation.isPending || !currentOrgId}
          />
          {webhookError ? (
            <p className="text-sm text-destructive">{webhookError}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Saisissez l'URL à appeler pour exporter vos données de projets. Le protocole HTTPS est recommandé.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">Synchronisation quotidienne</p>
            <p className="text-sm text-muted-foreground">
              Activez l'export automatique des projets chaque jour à l'heure définie.
            </p>
          </div>
          <Switch
            checked={dailyEnabled}
            onCheckedChange={handleToggleDaily}
            disabled={isLoading || saveMutation.isPending || !currentOrgId}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="backup-time">Heure d'exécution</Label>
            <Input
              id="backup-time"
              type="time"
              step={60}
              value={dailyEnabled ? backupTime : ""}
              onChange={(event) => handleTimeChange(event.target.value)}
              disabled={!dailyEnabled || isLoading || saveMutation.isPending || !currentOrgId}
            />
            <p className="text-sm text-muted-foreground">
              Heure d'envoi quotidienne (format 24h). Par défaut 09:00.
            </p>
          </div>

          <div className="flex items-end justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                isLoading ||
                saveMutation.isPending ||
                !currentOrgId ||
                Boolean(webhookError) ||
                !isDirty
              }
            >
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => testWebhookMutation.mutate()}
            disabled={
              actionDisabled ||
              testWebhookMutation.isPending ||
              saveMutation.isPending ||
              isLoading
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {testWebhookMutation.isPending ? "Test en cours..." : "Tester le webhook"}
          </Button>
          <Button
            type="button"
            onClick={() => exportProjectsMutation.mutate()}
            disabled={
              actionDisabled ||
              exportProjectsMutation.isPending ||
              saveMutation.isPending ||
              isLoading
            }
          >
            <Download className="mr-2 h-4 w-4" />
            {exportProjectsMutation.isPending ? "Export en cours..." : "Exporter tous les projets"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
