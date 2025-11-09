import { useEffect, useMemo, useRef, useState } from "react";
import { CloudOff, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useDriveConnectionStatus,
  useDriveUpload,
  type DriveFileMetadata,
} from "@/integrations/googleDrive";

interface DriveFileUploaderProps {
  orgId?: string | null;
  value?: DriveFileMetadata | null;
  onChange?: (value: DriveFileMetadata | null) => void;
  disabled?: boolean;
  accept?: string;
  maxSizeMb?: number;
  entityType?: "lead" | "site" | "quote" | "invoice" | "product";
  entityId?: string;
  description?: string;
  emptyLabel?: string;
  helperText?: string;
  className?: string;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export const DriveFileUploader = ({
  orgId,
  value,
  onChange,
  disabled,
  accept,
  maxSizeMb = 20,
  entityType,
  entityId,
  description,
  emptyLabel = "Glissez-déposez un fichier ou cliquez pour sélectionner",
  helperText,
  className,
}: DriveFileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [localFile, setLocalFile] = useState<DriveFileMetadata | null>(value ?? null);
  const { toast } = useToast();
  const { session } = useAuth();
  const uploadMutation = useDriveUpload(session?.access_token);
  const { data: connection, isLoading: connectionLoading } = useDriveConnectionStatus(orgId ?? null);

  const uploading = uploadMutation.isPending;
  const isDisabled = disabled || uploading || !orgId;

  useEffect(() => {
    setLocalFile(value ?? null);
  }, [value]);

  const acceptLabel = useMemo(() => {
    if (!accept) return "Tous les fichiers";
    return accept
      .split(",")
      .map((token) => token.trim().replace(/^\./, ""))
      .filter(Boolean)
      .join(", ");
  }, [accept]);

  const validateFile = (file: File) => {
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      return `La taille du fichier dépasse ${maxSizeMb} Mo (${formatBytes(file.size)}).`;
    }

    if (accept) {
      const allowed = accept.split(",").map((item) => item.trim().toLowerCase());
      const isAllowed = allowed.some((pattern) => {
        if (!pattern) return false;
        if (pattern === "*/*") return true;
        if (pattern.startsWith(".")) {
          return file.name.toLowerCase().endsWith(pattern);
        }
        return file.type.toLowerCase() === pattern;
      });

      if (!isAllowed) {
        return "Ce type de fichier n'est pas autorisé";
      }
    }

    return null;
  };

  const ensureConnected = () => {
    if (!orgId) {
      toast({
        title: "Organisation manquante",
        description: "Sélectionnez une organisation pour utiliser Google Drive.",
        variant: "destructive",
      });
      return false;
    }

    if (!connection || connection.status !== "connected") {
      toast({
        title: "Google Drive non connecté",
        description: "Connectez Google Drive dans les paramètres pour déposer des documents.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = async (file: File) => {
    if (!ensureConnected()) return;

    const errorMessage = validateFile(file);
    if (errorMessage) {
      toast({ title: "Fichier invalide", description: errorMessage, variant: "destructive" });
      return;
    }

    try {
      const result = await uploadMutation.mutateAsync({
        orgId: orgId!,
        file,
        entityType,
        entityId,
        description,
      });

      const metadata: DriveFileMetadata = {
        id: result.id,
        name: result.name,
        mimeType: result.mimeType,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
        iconLink: result.iconLink,
      };

      setLocalFile(metadata);
      onChange?.(metadata);

      toast({
        title: "Fichier envoyé",
        description: "Le document est désormais disponible dans votre Drive.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d'uploader le fichier vers Google Drive";
      toast({ title: "Erreur d'upload", description: message, variant: "destructive" });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (isDisabled) return;

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleRemove = () => {
    setLocalFile(null);
    onChange?.(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {localFile ? (
        <div className="flex items-start justify-between rounded-md border border-border/60 bg-muted/40 p-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{localFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {localFile.mimeType || "Document"}
                {connection?.rootFolderId ? " • Google Drive" : null}
              </p>
              {localFile.webViewLink ? (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-xs"
                  onClick={() => {
                    if (localFile.webViewLink) {
                      window.open(localFile.webViewLink, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  Ouvrir dans Drive
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            {!disabled ? (
              <Button type="button" variant="ghost" size="icon" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors",
            isDisabled
              ? "cursor-not-allowed border-muted-foreground/20 bg-muted/30"
              : "cursor-pointer border-muted-foreground/40 hover:border-primary hover:bg-primary/5",
            isDragActive && !isDisabled ? "border-primary bg-primary/5" : null,
          )}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isDisabled) {
              setIsDragActive(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={handleDrop}
          onClick={() => {
            if (!isDisabled) {
              inputRef.current?.click();
            }
          }}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : connectionLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : connection?.status !== "connected" ? (
            <CloudOff className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Upload className="h-6 w-6 text-primary" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{emptyLabel}</p>
            <p className="text-xs text-muted-foreground">
              {acceptLabel}
              {maxSizeMb ? ` • ${maxSizeMb} Mo max` : null}
            </p>
            {connection?.status !== "connected" ? (
              <p className="text-xs text-destructive">
                Connectez votre organisation à Google Drive pour déposer des fichiers.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isDisabled}
            onClick={(event) => {
              event.stopPropagation();
              if (!isDisabled) {
                inputRef.current?.click();
              }
            }}
          >
            {uploading ? "Upload en cours..." : "Choisir un fichier"}
          </Button>
          <Input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            disabled={isDisabled}
            onChange={handleInputChange}
          />
        </div>
      )}
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
};
