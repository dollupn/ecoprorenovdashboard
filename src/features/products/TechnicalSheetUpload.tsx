import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TechnicalSheetUploadProps = {
  orgId: string | null;
  productId?: string;
  currentUrl?: string | null;
  onUrlChange: (url: string | null) => void;
  disabled?: boolean;
};

export const TechnicalSheetUpload = ({
  orgId,
  productId,
  currentUrl,
  onUrlChange,
  disabled,
}: TechnicalSheetUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const processFile = async (file: File, input?: HTMLInputElement | null) => {
    if (!orgId) return;
    if (file.type !== "application/pdf") {
      toast({
        title: "Format invalide",
        description: "Seuls les fichiers PDF sont acceptés",
        variant: "destructive",
      });
      if (input) {
        input.value = "";
      }
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10 Mo",
        variant: "destructive",
      });
      if (input) {
        input.value = "";
      }
      return;
    }

    setUploading(true);
    try {
      const fileName = `${orgId}/${productId || Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from("technical-sheets")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("technical-sheets")
        .getPublicUrl(data.path);

      onUrlChange(urlData.publicUrl);
      toast({ title: "Fiche technique ajoutée", description: "Le fichier a été uploadé avec succès" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Impossible d'uploader le fichier",
        variant: "destructive",
      });
    } finally {
      if (input) {
        input.value = "";
      }
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file, event.target);
  };

  const handleRemove = async () => {
    if (!currentUrl) return;

    try {
      const path = currentUrl.split("/technical-sheets/")[1];
      if (path) {
        await supabase.storage.from("technical-sheets").remove([path]);
      }
      onUrlChange(null);
      toast({ title: "Fiche technique supprimée" });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le fichier",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm hover:underline truncate"
          >
            Fiche technique
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors",
            disabled || uploading
              ? "cursor-not-allowed border-muted-foreground/20 bg-muted/30"
              : "cursor-pointer border-muted-foreground/40 hover:border-primary hover:bg-primary/5",
            isDragActive && !disabled && !uploading ? "border-primary bg-primary/5" : null
          )}
          onClick={() => {
            if (disabled || uploading) return;
            fileInputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (disabled || uploading) return;
            setIsDragActive(true);
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (disabled || uploading) return;
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            if (disabled || uploading) return;
            setIsDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (!file) {
              return;
            }

            if (fileInputRef.current && typeof DataTransfer !== "undefined") {
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              fileInputRef.current.files = dataTransfer.files;
            }

            await processFile(file, fileInputRef.current);
          }}
        >
          <Upload className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-medium">Glissez-déposez votre fiche technique</p>
            <p className="text-xs text-muted-foreground">Format accepté : PDF (max 10 Mo)</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || uploading}
            onClick={(event) => {
              event.stopPropagation();
              if (disabled || uploading) return;
              fileInputRef.current?.click();
            }}
          >
            {uploading ? "Upload en cours..." : "Sélectionner un PDF"}
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={disabled || uploading}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};
