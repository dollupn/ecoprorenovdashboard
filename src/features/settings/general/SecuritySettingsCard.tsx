import {
  Clock,
  KeyRound,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SecuritySettings } from "./types";

interface ActiveSession {
  device: string;
  lastActive: string;
  browser: string;
  secure: boolean;
}

interface SessionOption {
  value: string;
  label: string;
}

interface SecuritySettingsCardProps {
  settings: SecuritySettings;
  onToggleSetting: (key: keyof SecuritySettings, value: boolean) => void;
  sessionOptions: SessionOption[];
  onSessionDurationChange: (value: string) => void;
  activeSessions: ActiveSession[];
  onSave: () => void;
}

export const SecuritySettingsCard = ({
  settings,
  onToggleSetting,
  sessionOptions,
  onSessionDurationChange,
  activeSessions,
  onSave,
}: SecuritySettingsCardProps) => {
  const toggles: Array<{
    key: keyof SecuritySettings;
    title: string;
    description: string;
    icon: typeof KeyRound;
  }> = [
    {
      key: "twoFactor",
      title: "Double authentification",
      description: "Obliger l&apos;activation de la double authentification pour tous les comptes.",
      icon: KeyRound,
    },
    {
      key: "passwordRotation",
      title: "Rotation des mots de passe",
      description: "Demander un renouvellement de mot de passe tous les 90 jours.",
      icon: RefreshCw,
    },
    {
      key: "loginAlerts",
      title: "Alertes de connexion",
      description: "Notifier l&apos;équipe sécurité des connexions depuis de nouveaux appareils.",
      icon: MonitorSmartphone,
    },
  ];

  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Sécurité & conformité
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Définissez des politiques de sécurité avancées pour protéger vos données sensibles.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          {toggles.map((setting) => (
            <div
              key={setting.key}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <setting.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{setting.title}</p>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
              </div>
              <Switch
                checked={settings[setting.key]}
                onCheckedChange={(checked) => onToggleSetting(setting.key, checked)}
              />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Durée des sessions</p>
                <p className="text-sm text-muted-foreground">
                  Limitez la durée des sessions inactives avant déconnexion automatique.
                </p>
              </div>
            </div>
            <Select value={settings.sessionDuration} onValueChange={onSessionDurationChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Durée" />
              </SelectTrigger>
              <SelectContent>
                {sessionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
          <p className="text-sm font-medium text-foreground">Sessions actives</p>
          <div className="space-y-3 text-sm text-muted-foreground">
            {activeSessions.map((session) => (
              <div
                key={session.device}
                className="flex flex-col gap-1 rounded-xl border border-border/50 bg-background p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{session.device}</p>
                  <p>{session.browser}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      session.secure
                        ? "border-emerald-200/60 bg-emerald-500/10 text-emerald-700"
                        : "border-amber-200/60 bg-amber-500/10 text-amber-700"
                    }
                  >
                    {session.secure ? "Sécurisé" : "Non vérifié"}
                  </Badge>
                  <span>{session.lastActive}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={onSave}>Appliquer les règles de sécurité</Button>
        </div>
      </CardContent>
    </Card>
  );
};
