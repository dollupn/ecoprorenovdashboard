/**
 * Utility functions for Google Drive OAuth state management
 */

/**
 * Generates a random state token for OAuth CSRF protection
 */
export const createDriveStateToken = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
      JSON.stringify({ orgId }),
    );
  }
};

/**
 * Retrieves the organization ID from session storage
 */
export const retrieveDriveAuthState = (stateToken: string): { orgId: string } | null => {
  if (typeof window === "undefined") return null;
  
  const stored = sessionStorage.getItem(buildDriveAuthStateKey(stateToken));
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as { orgId: string };
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
