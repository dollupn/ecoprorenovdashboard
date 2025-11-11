import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import {
  clearDriveAuthState,
  decodeDriveAuthStatePayload,
  retrieveDriveAuthState,
  resolveDriveRedirectUri,
  useDriveAuthExchange,
} from "@/integrations/googleDrive";

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
  const hasExchangeStarted = useRef(false);

  const code = searchParams.get("code");
  const authError = searchParams.get("error");
  const stateParam = searchParams.get("state");
  const fallbackOrgId = searchParams.get("orgId");

  const decodedState = useMemo(() => decodeDriveAuthStatePayload(stateParam), [stateParam]);
  const storageTokens = useMemo(
    () =>
      Array.from(
        new Set(
          [decodedState?.nonce, stateParam].filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          ),
        ),
      ),
    [decodedState?.nonce, stateParam],
  );

  const storedAuthState = useMemo(() => {
    let storedOrgId: string | null = null;
    let storedRedirectUri: string | undefined;

    for (const token of storageTokens) {
      const stored = retrieveDriveAuthState(token);
      if (!storedOrgId && stored?.orgId) {
        storedOrgId = stored.orgId;
      }
      if (!storedRedirectUri && stored?.redirectUri) {
        storedRedirectUri = stored.redirectUri;
      }
    }

    return { orgId: storedOrgId, redirectUri: storedRedirectUri };
  }, [storageTokens]);

  const redirectUri = useMemo(() => {
    if (typeof storedAuthState.redirectUri === "string" && storedAuthState.redirectUri) {
      return storedAuthState.redirectUri;
    }

    if (typeof window === "undefined") {
      return resolveDriveRedirectUri();
    }

    return resolveDriveRedirectUri(undefined, {
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }, [storedAuthState.redirectUri]);

  useEffect(() => {
    // Prevent multiple exchange attempts
    if (hasExchangeStarted.current) {
      console.log("[Drive] Callback - Exchange already started, skipping");
      return;
    }

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

    for (const token of storageTokens) {
      clearDriveAuthState(token);
    }

    const resolvedOrgId =
      decodedState?.orgId ?? storedAuthState.orgId ?? fallbackOrgId ?? currentOrgId;

    if (!resolvedOrgId) {
      console.error("[Drive] Callback - No org ID resolved:", {
        decodedStateOrgId: decodedState?.orgId,
        storedStateOrgId: storedAuthState.orgId,
        urlParamOrgId: fallbackOrgId,
        currentOrgId: currentOrgId,
      });
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

    console.log("[Drive] Callback - Starting exchange:", {
      code: code?.substring(0, 20) + "...",
      redirectUri,
      orgId: resolvedOrgId,
      state: stateParam,
    });

    hasExchangeStarted.current = true;
    setStatus("processing");
    const payload = redirectUri
      ? { orgId: resolvedOrgId, code, redirectUri }
      : { orgId: resolvedOrgId, code };

    exchangeAuth
      .mutateAsync(payload)
      .then((summary) => {
        console.log("[Drive] Callback - Exchange successful:", summary);
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
        console.error("[Drive] Callback - Exchange failed:", {
          error: error,
          message: error?.message,
          response: error?.response?.data,
        });
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
    decodedState,
    exchangeAuth,
    fallbackOrgId,
    navigate,
    redirectUri,
    setCurrentOrgId,
    storageTokens,
    storedAuthState.orgId,
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
