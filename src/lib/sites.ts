import type { DriveFileMetadata } from "@/integrations/googleDrive";

export type ParsedSiteNotes = {
  text: string;
  driveFile: DriveFileMetadata | null;
};

const DEFAULT_PARSED_NOTES: ParsedSiteNotes = {
  text: "",
  driveFile: null,
};

export const parseSiteNotes = (rawNotes: string | null | undefined): ParsedSiteNotes => {
  if (!rawNotes) {
    return DEFAULT_PARSED_NOTES;
  }

  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const text = typeof record.internalNotes === "string" ? record.internalNotes : "";
      const driveUrl = typeof record.driveFileUrl === "string" ? record.driveFileUrl : undefined;
      const driveId = typeof record.driveFileId === "string" ? record.driveFileId : undefined;
      const driveName = typeof record.driveFileName === "string" ? record.driveFileName : undefined;

      const driveFile: DriveFileMetadata | null = driveUrl
        ? {
            id: driveId && String(driveId).trim() ? String(driveId) : driveUrl,
            name: driveName && String(driveName).trim() ? String(driveName) : "Document chantier",
            webViewLink: driveUrl,
          }
        : null;

      return { text, driveFile };
    }
  } catch (error) {
    console.warn("Unable to parse site notes metadata", error);
  }

  return { text: rawNotes ?? "", driveFile: null };
};

export const serializeSiteNotes = (
  text: string | null | undefined,
  driveFile: DriveFileMetadata | null,
): string => {
  const metadata: Record<string, unknown> = {};

  const trimmedText = text?.trim();
  if (trimmedText) {
    metadata.internalNotes = trimmedText;
  }

  if (driveFile) {
    const driveUrl = driveFile.webViewLink ?? (driveFile as Partial<DriveFileMetadata>).webContentLink;
    if (driveUrl) {
      metadata.driveFileUrl = driveUrl;
    }
    if (driveFile.id) {
      metadata.driveFileId = driveFile.id;
    }
    if (driveFile.name) {
      metadata.driveFileName = driveFile.name;
    }
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : "";
};

