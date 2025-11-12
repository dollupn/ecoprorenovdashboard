import { FormEvent } from "react";
import { AlertCircle, KeyRound, Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Integration } from "./types";
import type { DriveConnectionStatus } from "@/integrations/googleDrive/types";

interface IntegrationsCardProps {
  integrations: Integration[];
  driveConnection: DriveConnectionStatus | undefined;
  driveConnectionLoading: boolean;
  driveErrorMessage: string | null;
  isAdmin: boolean;
  hasActiveOrg: boolean;
  driveClientId: string;
  driveClientSecret: string;
  driveRedirectUri: string;
  driveRootFolderId: string;
  driveSharedDriveId: string;
  onDriveClientIdChange: (value: string) => void;
  onDriveClientSecretChange: (value: string) => void;
  onDriveRedirectUriChange: (value: string) => void;
  onDriveRootFolderChange: (value: string) => void;
  onDriveSharedDriveChange: (value: string) => void;
  onDriveSettingsSubmit: (event: FormEvent<HTMLFormElement>) => void;
  driveSettingsSaving: boolean;
  driveConnectLoading: boolean;
  driveRefreshLoading: boolean;
  driveDisconnectLoading: boolean;
  onDriveConnect: () => void;
  onDriveRefresh: () => void;
  onDriveDisconnect: () => void;
  onIntegrationAction: (integration: Integration) => void;
}

export const IntegrationsCard = ({
  integrations,
  driveConnection,
  driveConnectionLoading,
  driveErrorMessage,
  isAdmin,
  hasActiveOrg,
  driveClientId,
  driveClientSecret,
  driveRedirectUri,
  driveRootFolderId,
  driveSharedDriveId,
  onDriveClientIdChange,
  onDriveClientSecretChange,
  onDriveRedirectUriChange,
  onDriveRootFolderChange,
  onDriveSharedDriveChange,
  onDriveSettingsSubmit,
  driveSettingsSaving,
  driveConnectLoading,
  driveRefreshLoading,
  driveDisconnectLoading,
  onDriveConnect,
  onDriveRefresh,
  onDriveDisconnect,
  onIntegrationAction,
}: IntegrationsCardProps) => {
  const integrationStatusStyles: Record<Integration["status"], string> = {
    connected: "border-emerald-200/60 bg-emerald-500/10 text-emerald-700",
    pending: "border-amber-200/60 bg-amber-500/10 text-amber-700",
    disconnected: "border-red-200/60 bg-red-500/10 text-red-700",
  };

  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Plug className="h-5 w-5 text-primary" />
          Intégrations & API
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connectez vos outils métiers pour fluidifier vos process commerciaux et opérationnels.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrations.map((integration) => {
          const isDrive = integration.id === "google-drive";
          const badgeLabel = isDrive && driveConnectionLoading
            ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Vérification
                </span>
              )
            : integration.status === "connected"
            ? "Connecté"
            : integration.status === "pending"
            ? "En attente"
            : "Déconnecté";

          return (
            <div key={integration.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{integration.name}</p>
                    <Badge className={integrationStatusStyles[integration.status]} variant="outline">
                      {badgeLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
                {isDrive ? (
                  <div className="flex w-full flex-col gap-4 md:min-w-[320px] md:max-w-[420px] md:items-end">
                    {isAdmin ? (
                      <form
                        onSubmit={onDriveSettingsSubmit}
                        className="w-full space-y-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm"
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="drive-client-id">Client ID</Label>
                            <Input
                              id="drive-client-id"
                              value={driveClientId}
                              onChange={(event) => onDriveClientIdChange(event.target.value)}
                              placeholder="google-client-id.apps.googleusercontent.com"
                              autoComplete="off"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="drive-client-secret">Client secret</Label>
                            <Input
                              id="drive-client-secret"
                              type="password"
                              value={driveClientSecret}
                              onChange={(event) => onDriveClientSecretChange(event.target.value)}
                              placeholder="Client secret Google"
                              autoComplete="new-password"
                              required
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="drive-redirect-uri">Redirect URI</Label>
                            <Input
                              id="drive-redirect-uri"
                              value={driveRedirectUri}
                              onChange={(event) => onDriveRedirectUriChange(event.target.value)}
                              placeholder="https://<votre-domaine>/integrations/google-drive/callback"
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="drive-root-folder-id">Dossier racine</Label>
                            <Input
                              id="drive-root-folder-id"
                              value={driveRootFolderId}
                              onChange={(event) => onDriveRootFolderChange(event.target.value)}
                              placeholder="ID du dossier Drive"
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="drive-shared-drive-id">Drive partagé (optionnel)</Label>
                            <Input
                              id="drive-shared-drive-id"
                              value={driveSharedDriveId}
                              onChange={(event) => onDriveSharedDriveChange(event.target.value)}
                              placeholder="ID du drive partagé"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <p className="text-xs text-muted-foreground">
                            Ces identifiants restent privés et permettent de générer l&apos;URL d&apos;authentification Drive.
                          </p>
                          <Button
                            type="submit"
                            variant="secondary"
                            className="gap-2 md:w-auto"
                            disabled={
                              driveSettingsSaving ||
                              !driveClientId.trim() ||
                              !driveClientSecret.trim() ||
                              !hasActiveOrg
                            }
                          >
                            {driveSettingsSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
                            Enregistrer
                          </Button>
                        </div>
                      </form>
                    ) : null}
                    <div className="flex flex-col gap-2 md:items-end">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={driveConnection?.connected ? "outline" : "secondary"}
                          onClick={() =>
                            driveConnection?.connected ? onDriveRefresh() : onDriveConnect()
                          }
                          disabled={
                            driveConnectLoading ||
                            driveRefreshLoading ||
                            driveSettingsSaving ||
                            (!hasActiveOrg && !driveConnection?.connected)
                          }
                          className="gap-2"
                        >
                          {driveConnectLoading || driveRefreshLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : driveConnection?.connected ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : (
                            <Plug className="h-4 w-4" />
                          )}
                          {driveConnection?.connected ? "Actualiser l'accès" : "Connecter"}
                        </Button>
                        {driveConnection?.connected ? (
                          <Button
                            variant="ghost"
                            onClick={onDriveDisconnect}
                            disabled={driveDisconnectLoading}
                            className="gap-2"
                          >
                            {driveDisconnectLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Déconnecter
                          </Button>
                        ) : null}
                      </div>
                      {driveConnection?.rootFolderId ? (
                        <p className="text-xs text-muted-foreground">
                          Dossier racine : {driveConnection.rootFolderId}
                        </p>
                      ) : null}
                      {driveConnection?.sharedDriveId ? (
                        <p className="text-xs text-muted-foreground">
                          Drive partagé : {driveConnection.sharedDriveId}
                        </p>
                      ) : null}
                      {driveErrorMessage ? (
                        <p className="flex items-center gap-2 text-xs text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {driveErrorMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <Button
                    variant={integration.status === "connected" ? "ghost" : "secondary"}
                    onClick={() => onIntegrationAction(integration)}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {integration.status === "connected" ? "Désactiver" : "Connecter"}
                  </Button>
                )}
              </div>
              <Separator className="bg-border/60" />
              <p className="text-xs text-muted-foreground">
                Dernière synchronisation : {integration.lastSync}
              </p>
            </div>
          );
        })}
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
          Besoin d&apos;une intégration personnalisée ? Contactez notre équipe pour accéder à l&apos;API et aux webhooks sécurisés.
        </div>
      </CardContent>
    </Card>
  );
};
