/**
 * Utility functions for Google Drive OAuth state management
 */

export type DriveAuthStatePayload = {
  nonce: string;
  orgId: string;
};

type StoredDriveAuthState = {
  orgId: string;
  nonce?: string;
};

/**
 * Generates a random state token for OAuth CSRF protection
 */
export const createDriveStateToken = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Encodes the Drive auth state payload for the OAuth state parameter
 */
export const encodeDriveAuthStatePayload = (payload: DriveAuthStatePayload): string => {
  return encodeURIComponent(JSON.stringify(payload));
};

/**
 * Attempts to decode a Drive auth state payload from the OAuth state parameter
 */
export const decodeDriveAuthStatePayload = (state?: string | null): DriveAuthStatePayload | null => {
  if (!state) return null;

  try {
    const decoded = JSON.parse(decodeURIComponent(state));

    if (
      decoded &&
      typeof decoded === "object" &&
      typeof decoded.nonce === "string" &&
      decoded.nonce &&
      typeof decoded.orgId === "string" &&
      decoded.orgId
    ) {
      return { nonce: decoded.nonce, orgId: decoded.orgId };
    }
  } catch {
    // Ignore malformed payloads and fall back to legacy behaviour
  }

  return null;
};

/**
 * Builds the storage key for Drive auth state
 */
export const buildDriveAuthStateKey = (state: string): string => {
  return `drive-auth:${state}`;
};

/**
 * Stores the organization ID in session storage for the OAuth callback
 */
export const storeDriveAuthState = (stateToken: string, orgId: string): void => {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(
      buildDriveAuthStateKey(stateToken),
      JSON.stringify({ orgId, nonce: stateToken } satisfies StoredDriveAuthState),
    );
  }
};

/**
 * Retrieves the organization ID from session storage
 */
export const retrieveDriveAuthState = (stateToken: string): StoredDriveAuthState | null => {
  if (typeof window === "undefined") return null;

  const stored = sessionStorage.getItem(buildDriveAuthStateKey(stateToken));
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<StoredDriveAuthState> | null;
    if (!parsed || typeof parsed.orgId !== "string" || !parsed.orgId) {
      return null;
    }

    return {
      orgId: parsed.orgId,
      nonce: typeof parsed.nonce === "string" ? parsed.nonce : undefined,
    } satisfies StoredDriveAuthState;
  } catch {
    return null;
  }
};

/**
 * Clears the Drive auth state from session storage
 */
export const clearDriveAuthState = (stateToken: string): void => {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(buildDriveAuthStateKey(stateToken));
  }
};
