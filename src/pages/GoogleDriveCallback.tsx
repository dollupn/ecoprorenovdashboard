import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import { useDriveAuthExchange, buildDriveAuthStateKey } from "@/integrations/googleDrive";

const getRedirectUri = () =>
  typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;

type CallbackStatus = "idle" | "processing" | "success" | "error";

type DriveAuthLocationState = { driveAuth: "connected" | "error"; driveOrgId?: string };

const statusCopy: Record<CallbackStatus, { title: string; description: string }> = {
  idle: {
    title: "Initialisation de Google Drive",
    description: "Analyse des paramètres d'authentification en cours...",
  },
  processing: {
    title: "Connexion à Google Drive",
    description: "Nous échangeons le code d'autorisation pour activer l'intégration.",
  },
  success: {
    title: "Google Drive connecté",
    description: "La connexion a été établie avec succès. Vous allez être redirigé vers les paramètres.",
  },
  error: {
    title: "Erreur d'authentification",
    description: "Impossible de finaliser la connexion Google Drive.",
  },
};

const GoogleDriveCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { currentOrgId, setCurrentOrgId } = useOrg();
  const exchangeAuth = useDriveAuthExchange();

  const [status, setStatus] = useState<CallbackStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const code = searchParams.get("code");
  const authError = searchParams.get("error");
  const stateParam = searchParams.get("state");
  const fallbackOrgId = searchParams.get("orgId");

  const redirectUri = useMemo(() => getRedirectUri(), []);

  useEffect(() => {
    if (authError) {
      const message =
        authError === "access_denied"
          ? "L'autorisation Google Drive a été refusée. Réessayez en acceptant les permissions demandées."
          : "Google a renvoyé une erreur pendant l'authentification.";
      setStatus("error");
      setErrorMessage(message);
      toast({
        title: "Connexion Google Drive refusée",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (!code) {
      const message =
        "Code d'autorisation absent. Fermez cette fenêtre et relancez la connexion depuis les paramètres.";
      setStatus("error");
      setErrorMessage(message);
      toast({
        title: "Code Google Drive manquant",
        description: message,
        variant: "destructive",
      });
      return;
    }

    let storedOrgId: string | null = null;

    if (stateParam) {
      const storageKey = buildDriveAuthStateKey(stateParam);
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { orgId?: string };
          if (parsed?.orgId) {
            storedOrgId = parsed.orgId;
          }
        } catch (error) {
          console.warn("Unable to parse stored Google Drive auth state", error);
        } finally {
          sessionStorage.removeItem(storageKey);
        }
      }
    }

    const resolvedOrgId = storedOrgId ?? fallbackOrgId ?? currentOrgId;

    if (!resolvedOrgId) {
      const message =
        "Impossible d'identifier l'organisation associée. Reprenez l'opération depuis votre espace Ecoprorenov.";
      setStatus("error");
      setErrorMessage(message);
      toast({
        title: "Organisation introuvable",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setStatus("processing");
    exchangeAuth
      .mutateAsync({ orgId: resolvedOrgId, code, redirectUri })
      .then((summary) => {
        setStatus("success");
        setErrorMessage(null);
        if (summary.orgId && summary.orgId !== currentOrgId) {
          setCurrentOrgId(summary.orgId);
        }
        toast({
          title: "Google Drive connecté",
          description: "La connexion est active. Retour aux paramètres dans un instant...",
        });
        const locationState: DriveAuthLocationState = { driveAuth: "connected", driveOrgId: summary.orgId };
        setTimeout(() => {
          navigate("/settings", { replace: true, state: locationState });
        }, 1200);
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de l'échange du code Google Drive.";
        setStatus("error");
        setErrorMessage(message);
        toast({
          title: "Connexion Google Drive échouée",
          description: message,
          variant: "destructive",
        });
      });
  }, [
    authError,
    code,
    currentOrgId,
    exchangeAuth,
    fallbackOrgId,
    navigate,
    redirectUri,
    setCurrentOrgId,
    stateParam,
    toast,
  ]);

  const copy = statusCopy[status];

  return (
    <div className="min-h-screen w-full bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Card className="border-border/70 shadow-lg">
          <CardHeader className="space-y-3 text-center">
            {status === "processing" ? (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            ) : status === "success" ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            ) : status === "error" ? (
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            ) : (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            )}
            <CardTitle className="text-2xl font-semibold text-foreground">{copy.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{copy.description}</p>
            {status === "error" && errorMessage ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => navigate("/settings", { replace: true })}>
                Retourner aux paramètres
              </Button>
              {status === "processing" ? (
                <p className="text-xs text-muted-foreground">
                  Vous pouvez fermer cette page une fois la redirection automatique effectuée.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GoogleDriveCallback;
