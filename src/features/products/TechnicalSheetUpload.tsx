import { useEffect, useState } from "react";
import { DriveFileUploader } from "@/components/integrations/DriveFileUploader";
import type { DriveFileMetadata } from "@/integrations/googleDrive";

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
  const [driveFile, setDriveFile] = useState<DriveFileMetadata | null>(() =>
    currentUrl
      ? {
          id: currentUrl,
          name: "Fiche technique",
          webViewLink: currentUrl,
        }
      : null,
  );

  useEffect(() => {
    if (currentUrl) {
      setDriveFile({
        id: currentUrl,
        name: "Fiche technique",
        webViewLink: currentUrl,
      });
    } else {
      setDriveFile(null);
    }
  }, [currentUrl]);

  const handleChange = (file: DriveFileMetadata | null) => {
    setDriveFile(file);
    onUrlChange(file?.webViewLink ?? file?.webContentLink ?? null);
  };

  return (
    <DriveFileUploader
      orgId={orgId}
      value={driveFile}
      onChange={handleChange}
      accept="application/pdf"
      maxSizeMb={15}
      entityType="product"
      entityId={productId}
      description={productId ? `Fiche technique produit ${productId}` : "Fiche technique produit"}
      emptyLabel="Glissez-déposez votre fiche technique ou cliquez pour sélectionner"
      helperText="Fichier PDF (max 15 Mo) stocké dans Google Drive"
      disabled={disabled}
    />
  );
};
