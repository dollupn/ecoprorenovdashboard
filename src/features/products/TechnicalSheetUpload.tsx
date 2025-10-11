import { useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orgId) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Format invalide",
        description: "Seuls les fichiers PDF sont acceptés",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10 Mo",
        variant: "destructive",
      });
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
      setUploading(false);
    }
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
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={disabled || uploading}
            className="flex-1"
          />
          {uploading && (
            <Upload className="h-4 w-4 animate-pulse text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
};
