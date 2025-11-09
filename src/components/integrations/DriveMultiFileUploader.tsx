import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CloudOff,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useDriveConnectionStatus,
  useDriveUpload,
  type DriveFileMetadata,
} from "@/integrations/googleDrive";
import { createSiteNoteAttachment, type SiteNoteAttachment } from "@/lib/sites";

const getFileKey = (file: DriveFileMetadata | null | undefined) =>
  file?.id ?? file?.webViewLink ?? file?.webContentLink ?? file?.name ?? null;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const parseTagInput = (value: string): string[] =>
  value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

interface DriveMultiFileUploaderProps {
  orgId?: string | null;
  value?: SiteNoteAttachment[];
  onChange?: (attachments: SiteNoteAttachment[]) => void;
  disabled?: boolean;
  accept?: string;
  maxSizeMb?: number;
  maxItems?: number;
  entityType?: "lead" | "site" | "quote" | "invoice" | "product";
  entityId?: string;
  description?: string;
  helperText?: string;
  emptyLabel?: string;
  className?: string;
}

export const DriveMultiFileUploader = ({
  orgId,
  value,
  onChange,
  disabled,
  accept,
  maxSizeMb = 35,
  maxItems = 12,
  entityType,
  entityId,
  description,
  helperText,
  emptyLabel = "Déposez ou sélectionnez des fichiers",
  className,
}: DriveMultiFileUploaderProps) => {
  const [items, setItems] = useState<SiteNoteAttachment[]>(value ?? []);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();
  const uploadMutation = useDriveUpload(session?.access_token);
  const { data: connection, isLoading: connectionLoading } = useDriveConnectionStatus(orgId ?? null);

  useEffect(() => {
    setItems(value ?? []);
  }, [value]);

  const uploading = uploadMutation.isPending || isBulkUploading;
  const isDisabled = disabled || uploading || !orgId;
  const isAtCapacity = maxItems > 0 && items.length >= maxItems;

  const acceptLabel = useMemo(() => {
    if (!accept) return "Tous les fichiers";
    return accept
      .split(",")
      .map((token) => token.trim().replace(/^\./, ""))
      .filter(Boolean)
      .join(", ");
  }, [accept]);

  const updateItems = useCallback(
    (next: SiteNoteAttachment[]) => {
      setItems(next);
      onChange?.(next);
    },
    [onChange],
  );

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

  const handleUpload = async (files: File[]) => {
    if (!ensureConnected()) return;
    if (isAtCapacity) {
      toast({
        title: "Limite atteinte",
        description: "Supprimez un document avant d'en ajouter un nouveau.",
        variant: "destructive",
      });
      return;
    }

    setIsBulkUploading(true);
    let currentItems = [...items];

    try {
      for (const file of files) {
        const errorMessage = validateFile(file);
        if (errorMessage) {
          toast({ title: "Fichier invalide", description: errorMessage, variant: "destructive" });
          continue;
        }

        if (maxItems > 0 && currentItems.length >= maxItems) {
          toast({
            title: "Limite atteinte",
            description: `Vous pouvez associer jusqu'à ${maxItems} documents.`,
            variant: "destructive",
          });
          break;
        }

        try {
          const result = await uploadMutation.mutateAsync({
            orgId: orgId!,
            file,
            entityType,
            entityId,
            description,
          });

          const nextAttachment = createSiteNoteAttachment(result, {
            title: result.name,
            thumbnailUrl: result.thumbnailLink ?? null,
          });

          const fileKey = getFileKey(nextAttachment.file);

          const filtered = currentItems.filter((attachment) => getFileKey(attachment.file) !== fileKey);
          let next = [nextAttachment, ...filtered];
          if (maxItems > 0) {
            next = next.slice(0, maxItems);
          }
          currentItems = next;
          updateItems(currentItems);

          toast({
            title: "Fichier envoyé",
            description: "Le document est désormais disponible dans votre Drive.",
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Impossible d'uploader le fichier vers Google Drive";
          toast({ title: "Erreur d'upload", description: message, variant: "destructive" });
        }
      }
    } finally {
      setIsBulkUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    void handleUpload(files);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (isDisabled) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;
    void handleUpload(files);
  };

  const handleRemove = (index: number) => {
    updateItems(items.filter((_, idx) => idx !== index));
  };

  const handleTitleChange = (index: number, title: string) => {
    const next = items.map((item, idx) => (idx === index ? { ...item, title } : item));
    updateItems(next);
  };

  const handleTagsChange = (index: number, rawValue: string) => {
    const tags = parseTagInput(rawValue);
    const next = items.map((item, idx) => (idx === index ? { ...item, tags } : item));
    updateItems(next);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3">
        {items.length === 0 ? null : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const link = item.file.webViewLink ?? item.file.webContentLink ?? null;
              const tagInputValue = item.tags.join(", ");
              return (
                <div
                  key={item.id || getFileKey(item.file) || index}
                  className="rounded-md border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-20 w-full max-w-[120px] items-center justify-center overflow-hidden rounded-md border border-border/40 bg-background sm:w-[120px]">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title || item.file.name || "Document"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <Input
                          value={item.title}
                          onChange={(event) => handleTitleChange(index, event.target.value)}
                          placeholder="Titre du document"
                          disabled={disabled}
                        />
                        <div className="flex items-center gap-2">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(index)}
                            disabled={disabled}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={tagInputValue}
                        onChange={(event) => handleTagsChange(index, event.target.value)}
                        placeholder="Tags (séparés par des virgules)"
                        disabled={disabled}
                      />
                      {item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <Badge key={`${item.id}-${tag}`} variant="secondary" className="bg-primary/10 text-primary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                          <span>{item.file.mimeType || "Document"}</span>
                        </div>
                        {link ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="px-0 text-xs"
                            onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                          >
                            Ouvrir dans Drive
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors",
          isDisabled || isAtCapacity
            ? "cursor-not-allowed border-muted-foreground/20 bg-muted/30"
            : "cursor-pointer border-muted-foreground/40 hover:border-primary hover:bg-primary/5",
          isDragActive && !isDisabled ? "border-primary bg-primary/5" : null,
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isDisabled && !isAtCapacity) {
            setIsDragActive(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={handleDrop}
        onClick={() => {
          if (!isDisabled && !isAtCapacity) {
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
        ) : isAtCapacity ? (
          <Plus className="h-6 w-6 text-muted-foreground" />
        ) : (
          <Upload className="h-6 w-6 text-primary" />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {isAtCapacity ? "Limite de documents atteinte" : emptyLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {acceptLabel}
            {maxSizeMb ? ` • ${maxSizeMb} Mo max` : null}
          </p>
          {isAtCapacity ? (
            <p className="text-xs text-muted-foreground">
              Supprimez un document existant pour en ajouter un nouveau.
            </p>
          ) : connection?.status !== "connected" ? (
            <p className="text-xs text-destructive">
              Connectez votre organisation à Google Drive pour déposer des fichiers.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isDisabled || isAtCapacity}
          onClick={(event) => {
            event.stopPropagation();
            if (!isDisabled && !isAtCapacity) {
              inputRef.current?.click();
            }
          }}
        >
          {uploading ? "Upload en cours..." : "Choisir des fichiers"}
        </Button>
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          multiple
          disabled={isDisabled || isAtCapacity}
          onChange={handleFileSelection}
        />
      </div>

      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
};
