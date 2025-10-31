import type { DriveFileMetadata } from "@/integrations/googleDrive";

export type ParsedSiteNotes = {
  text: string;
  driveFile: DriveFileMetadata | null;
  attachments: DriveFileMetadata[];
};

const DEFAULT_PARSED_NOTES: ParsedSiteNotes = {
  text: "",
  driveFile: null,
  attachments: [],
};

const toDriveFileMetadata = (value: unknown): DriveFileMetadata | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return {
      id: trimmed,
      name: "Document chantier",
      webViewLink: trimmed,
    };
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : undefined;
  const name =
    typeof record.name === "string"
      ? record.name
      : typeof record.file_name === "string"
        ? record.file_name
        : typeof record.title === "string"
          ? record.title
          : undefined;
  const webViewLink =
    typeof record.webViewLink === "string"
      ? record.webViewLink
      : typeof record.webContentLink === "string"
        ? record.webContentLink
        : typeof record.url === "string"
          ? record.url
          : undefined;
  const webContentLink =
    typeof record.webContentLink === "string" ? record.webContentLink : undefined;
  const mimeType =
    typeof record.mimeType === "string"
      ? record.mimeType
      : typeof record.mime_type === "string"
        ? record.mime_type
        : undefined;
  const iconLink = typeof record.iconLink === "string" ? record.iconLink : undefined;
  const thumbnailLink =
    typeof record.thumbnailLink === "string"
      ? record.thumbnailLink
      : typeof record.thumbnail_url === "string"
        ? record.thumbnail_url
        : undefined;

  if (!id && !webViewLink && !name) {
    return null;
  }

  return {
    id: id ?? webViewLink ?? name ?? "drive-file",
    name: name ?? "Document chantier",
    webViewLink,
    webContentLink,
    mimeType,
    iconLink,
    thumbnailLink,
  };
};

const parseAttachments = (value: unknown): DriveFileMetadata[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const attachments: DriveFileMetadata[] = [];

  value.forEach((entry) => {
    const metadata = toDriveFileMetadata(entry);
    if (!metadata) return;

    const key = metadata.id ?? metadata.webViewLink ?? metadata.webContentLink ?? metadata.name;
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    attachments.push(metadata);
  });

  return attachments;
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

      const directDriveFile: DriveFileMetadata | null = driveUrl
        ? {
            id: driveId && String(driveId).trim() ? String(driveId) : driveUrl,
            name: driveName && String(driveName).trim() ? String(driveName) : "Document chantier",
            webViewLink: driveUrl,
          }
        : null;

      const attachmentsSource =
        record.driveFiles ?? record.attachments ?? record.files ?? record.documents ?? [];
      const attachments = parseAttachments(attachmentsSource);

      const normalizedAttachments = (() => {
        const seen = new Set<string>();
        const list: DriveFileMetadata[] = [];

        const addFile = (file: DriveFileMetadata | null | undefined) => {
          if (!file) return;
          const key = file.id ?? file.webViewLink ?? file.webContentLink ?? file.name;
          if (!key || seen.has(key)) {
            return;
          }
          seen.add(key);
          list.push(file);
        };

        attachments.forEach(addFile);
        addFile(directDriveFile);

        return list;
      })();

      const primaryAttachment = normalizedAttachments[0] ?? directDriveFile ?? null;

      return {
        text,
        driveFile: primaryAttachment,
        attachments: normalizedAttachments,
      };
    }
  } catch (error) {
    console.warn("Unable to parse site notes metadata", error);
  }

  return { text: rawNotes ?? "", driveFile: null, attachments: [] };
};

const normalizeAttachmentInput = (attachments: DriveFileMetadata[] | null | undefined) => {
  if (!attachments || attachments.length === 0) return [];
  const seen = new Set<string>();
  const normalized: DriveFileMetadata[] = [];

  attachments.forEach((file) => {
    if (!file) return;
    const key = file.id ?? file.webViewLink ?? file.webContentLink ?? file.name;
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push(file);
  });

  return normalized;
};

export const serializeSiteNotes = (
  text: string | null | undefined,
  driveFile: DriveFileMetadata | null,
  attachments?: DriveFileMetadata[] | null,
): string => {
  const metadata: Record<string, unknown> = {};

  const trimmedText = text?.trim();
  if (trimmedText) {
    metadata.internalNotes = trimmedText;
  }

  const normalizedDriveFile = driveFile ? toDriveFileMetadata(driveFile) : null;
  const normalizedAttachments = normalizeAttachmentInput(attachments ?? []);

  if (normalizedDriveFile) {
    const driveUrl =
      normalizedDriveFile.webViewLink ?? (normalizedDriveFile as Partial<DriveFileMetadata>).webContentLink;
    if (driveUrl) {
      metadata.driveFileUrl = driveUrl;
    }
    if (normalizedDriveFile.id) {
      metadata.driveFileId = normalizedDriveFile.id;
    }
    if (normalizedDriveFile.name) {
      metadata.driveFileName = normalizedDriveFile.name;
    }
  }

  const allAttachments = (() => {
    const combined = [...normalizedAttachments];
    if (normalizedDriveFile) {
      combined.unshift(normalizedDriveFile);
    }
    return normalizeAttachmentInput(combined);
  })();

  if (allAttachments.length > 0) {
    metadata.driveFiles = allAttachments.map((file) => ({
      id: file.id ?? null,
      name: file.name ?? null,
      webViewLink: file.webViewLink ?? null,
      webContentLink: file.webContentLink ?? null,
      mimeType: file.mimeType ?? null,
      iconLink: file.iconLink ?? null,
      thumbnailLink: (file as { thumbnailLink?: string }).thumbnailLink ?? null,
    }));
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : "";
};

