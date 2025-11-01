import type { DriveFileMetadata } from "@/integrations/googleDrive";

export interface SiteNoteAttachment {
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl?: string | null;
  file: DriveFileMetadata;
}

export type ParsedSiteNotes = {
  text: string;
  driveFile: DriveFileMetadata | null;
  attachments: SiteNoteAttachment[];
};

const DEFAULT_PARSED_NOTES: ParsedSiteNotes = {
  text: "",
  driveFile: null,
  attachments: [],
};

const randomId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `att-${Math.random().toString(36).slice(2, 10)}`;

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }

  return [];
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
        : typeof record.thumbnailUrl === "string"
          ? record.thumbnailUrl
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

export const createSiteNoteAttachment = (
  file: DriveFileMetadata,
  overrides?: Partial<Omit<SiteNoteAttachment, "file" | "tags">> & { tags?: string[] },
): SiteNoteAttachment => {
  const normalizedTitle = normalizeString(overrides?.title) ?? file.name ?? "Document chantier";
  const normalizedTags = Array.isArray(overrides?.tags)
    ? overrides!.tags
        .map((tag) => normalizeString(tag))
        .filter((tag): tag is string => Boolean(tag))
    : [];
  const normalizedThumbnail =
    normalizeString(overrides?.thumbnailUrl) ?? file.thumbnailLink ?? file.iconLink ?? null;

  const identifier =
    normalizeString(overrides?.id) ??
    file.id ??
    file.webViewLink ??
    file.webContentLink ??
    file.name ??
    randomId();

  return {
    id: identifier,
    title: normalizedTitle,
    tags: normalizedTags,
    thumbnailUrl: normalizedThumbnail,
    file: {
      ...file,
      thumbnailLink: normalizedThumbnail ?? file.thumbnailLink,
    },
  };
};

const parseAttachments = (value: unknown): SiteNoteAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const attachments: SiteNoteAttachment[] = [];

  value.forEach((entry) => {
    const metadata = toDriveFileMetadata(entry);
    if (!metadata) return;

    const record = (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}) ?? {};

    const titleCandidate =
      normalizeString(record.title) ??
      normalizeString(record.display_name) ??
      normalizeString(record.description) ??
      metadata.name ??
      "Document chantier";

    const thumbnailCandidate =
      normalizeString(record.thumbnailUrl) ??
      normalizeString(record.thumbnail_link) ??
      normalizeString(record.thumbnailURL) ??
      metadata.thumbnailLink ??
      metadata.iconLink ??
      null;

    const tagsCandidate = parseTags(record.tags ?? record.labels ?? record.tag_list ?? null);

    const attachmentId =
      normalizeString(record.attachmentId) ??
      normalizeString(record.id) ??
      metadata.id ??
      metadata.webViewLink ??
      metadata.webContentLink ??
      metadata.name ??
      randomId();

    if (seen.has(attachmentId)) {
      return;
    }

    seen.add(attachmentId);
    attachments.push(
      createSiteNoteAttachment(
        {
          ...metadata,
          thumbnailLink: thumbnailCandidate ?? metadata.thumbnailLink,
        },
        {
          id: attachmentId,
          title: titleCandidate,
          tags: tagsCandidate,
          thumbnailUrl: thumbnailCandidate,
        },
      ),
    );
  });

  return attachments;
};

const mergeAttachments = (
  directAttachment: DriveFileMetadata | null,
  attachments: SiteNoteAttachment[],
): SiteNoteAttachment[] => {
  const normalized = [...attachments];

  if (directAttachment) {
    const directKey =
      directAttachment.id ??
      directAttachment.webViewLink ??
      directAttachment.webContentLink ??
      directAttachment.name;
    const alreadyPresent = normalized.some((attachment) => {
      const attachmentKey =
        attachment.file.id ??
        attachment.file.webViewLink ??
        attachment.file.webContentLink ??
        attachment.file.name;
      return Boolean(directKey) && attachmentKey === directKey;
    });

    if (!alreadyPresent) {
      normalized.unshift(createSiteNoteAttachment(directAttachment));
    }
  }

  return normalized;
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

      const attachmentsSource = record.attachments ?? record.driveFiles ?? record.files ?? record.documents ?? [];
      const parsedAttachments = parseAttachments(attachmentsSource);

      const normalizedAttachments = mergeAttachments(directDriveFile, parsedAttachments);

      const primaryAttachment =
        normalizedAttachments.length > 0 ? normalizedAttachments[0].file : directDriveFile ?? null;

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

const normalizeAttachmentInput = (attachments: SiteNoteAttachment[] | null | undefined) => {
  if (!attachments || attachments.length === 0) return [];
  const seen = new Set<string>();
  const normalized: SiteNoteAttachment[] = [];

  attachments.forEach((attachment) => {
    if (!attachment) return;
    const fileMetadata = toDriveFileMetadata(attachment.file ?? attachment);
    if (!fileMetadata) return;

    const prepared = createSiteNoteAttachment(fileMetadata, {
      id: attachment.id,
      title: attachment.title,
      tags: attachment.tags,
      thumbnailUrl: attachment.thumbnailUrl,
    });

    const key =
      prepared.id ??
      prepared.file.id ??
      prepared.file.webViewLink ??
      prepared.file.webContentLink ??
      prepared.file.name;
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push({ ...prepared, id: key });
  });

  return normalized;
};

export const serializeSiteNotes = (
  text: string | null | undefined,
  driveFile: DriveFileMetadata | null,
  attachments?: SiteNoteAttachment[] | null,
): string => {
  const metadata: Record<string, unknown> = {};

  const trimmedText = text?.trim();
  if (trimmedText) {
    metadata.internalNotes = trimmedText;
  }

  const normalizedDriveFile = driveFile ? toDriveFileMetadata(driveFile) : null;
  const normalizedAttachments = normalizeAttachmentInput(attachments ?? []);

  const combinedAttachments = (() => {
    if (!normalizedDriveFile) return normalizedAttachments;

    const primaryKey =
      normalizedDriveFile.id ??
      normalizedDriveFile.webViewLink ??
      normalizedDriveFile.webContentLink ??
      normalizedDriveFile.name;

    if (!primaryKey) return normalizedAttachments;

    const hasPrimary = normalizedAttachments.some((attachment) => {
      const attachmentKey =
        attachment.file.id ??
        attachment.file.webViewLink ??
        attachment.file.webContentLink ??
        attachment.file.name;
      return attachmentKey === primaryKey;
    });

    if (hasPrimary) {
      return normalizedAttachments;
    }

    return [createSiteNoteAttachment(normalizedDriveFile), ...normalizedAttachments];
  })();

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

  if (combinedAttachments.length > 0) {
    metadata.attachments = combinedAttachments.map((attachment) => ({
      id: attachment.id ?? null,
      title: attachment.title ?? null,
      tags: attachment.tags ?? [],
      thumbnailUrl: attachment.thumbnailUrl ?? attachment.file.thumbnailLink ?? null,
      driveFile: {
        id: attachment.file.id ?? null,
        name: attachment.file.name ?? null,
        webViewLink: attachment.file.webViewLink ?? null,
        webContentLink: attachment.file.webContentLink ?? null,
        mimeType: attachment.file.mimeType ?? null,
        iconLink: attachment.file.iconLink ?? null,
        thumbnailLink: attachment.file.thumbnailLink ?? null,
      },
    }));

    metadata.driveFiles = combinedAttachments.map((attachment) => ({
      id: attachment.file.id ?? null,
      name: attachment.file.name ?? attachment.title ?? null,
      webViewLink: attachment.file.webViewLink ?? null,
      webContentLink: attachment.file.webContentLink ?? null,
      mimeType: attachment.file.mimeType ?? null,
      iconLink: attachment.file.iconLink ?? null,
      thumbnailLink: attachment.file.thumbnailLink ?? null,
      title: attachment.title ?? null,
      tags: attachment.tags ?? [],
      attachmentId: attachment.id ?? null,
    }));
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : "";
};

