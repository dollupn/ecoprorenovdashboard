export interface DriveConnectionStatus {
  orgId: string;
  connected: boolean;
  status: "connected" | "disconnected" | "error" | "pending";
  expiresAt?: string | null;
  hasRefreshToken: boolean;
  rootFolderId?: string | null;
  sharedDriveId?: string | null;
  errorMessage?: string | null;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface DriveUploadOptions {
  orgId: string;
  file: File;
  parentFolderId?: string;
  entityType?: "lead" | "site" | "quote" | "invoice" | "product";
  entityId?: string;
  description?: string;
  accessToken?: string | null;
}

export interface DriveUploadResult extends DriveFileMetadata {
  parentFolderId?: string | null;
  entityType?: DriveUploadOptions["entityType"];
  entityId?: string;
}

export interface CreateAuthUrlParams {
  orgId: string;
  redirectUri?: string;
  state?: string;
  prompt?: "consent" | "none";
}

export interface CreateAuthUrlResponse {
  url: string;
  redirectUri: string | null;
}

export interface ExchangeAuthCodePayload {
  orgId: string;
  code: string;
  redirectUri?: string;
}

export interface DriveSettingsPayload {
  orgId: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  rootFolderId?: string;
  sharedDriveId?: string;
}

export interface UpdateDriveSettingsRequest extends DriveSettingsPayload {
  accessToken?: string | null;
}

export interface DriveConnectionMutationOptions {
  orgId: string;
  accessToken?: string | null;
}
