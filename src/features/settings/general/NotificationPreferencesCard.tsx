import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { NotificationSettings } from "./types";

interface NotificationPreferencesCardProps {
  settings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings) => void;
  onSave: () => void;
}

export const NotificationPreferencesCard = ({
  settings,
  onToggle,
  onSave,
}: NotificationPreferencesCardProps) => {
  const options: Array<{ key: keyof NotificationSettings; title: string; description: string }> = [
    {
      key: "commercialEmails",
      title: "Suivi commercial",
      description: "Alertes sur les nouveaux leads, rappels de relance et devis en attente.",
    },
    {
      key: "operationalEmails",
      title: "Opérations & chantiers",
      description: "Notifications de planification, pointages d'équipes et suivi de chantier.",
    },
    {
      key: "smsReminders",
      title: "SMS automatiques",
      description: "Rappels de rendez-vous clients et confirmations d'interventions.",
    },
    {
      key: "pushNotifications",
      title: "Notifications mobiles",
      description: "Alertes en temps réel sur mobile pour les demandes critiques.",
    },
    {
      key: "weeklyDigest",
      title: "Rapport hebdomadaire",
      description: "Synthèse des indicateurs clés envoyée chaque lundi matin.",
    },
  ];

  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Bell className="h-5 w-5 text-primary" />
          Préférences de notifications
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personnalisez les canaux de communication pour chaque événement métier important.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {options.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch checked={settings[item.key]} onCheckedChange={() => onToggle(item.key)} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end">
          <Button onClick={onSave}>Sauvegarder les préférences</Button>
        </div>
      </CardContent>
    </Card>
  );
};
