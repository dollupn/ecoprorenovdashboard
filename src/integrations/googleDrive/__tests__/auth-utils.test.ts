import { describe, expect, it } from "vitest";

import { resolveDriveRedirectUri } from "@/integrations/googleDrive";

describe("resolveDriveRedirectUri", () => {
  it("returns the stored redirect URI when provided", () => {
    const stored = "https://app.example.com/integrations/google-drive/callback/?withSlash=true";

    expect(
      resolveDriveRedirectUri(stored, {
        origin: "https://app.example.com",
        pathname: "/integrations/google-drive/callback/",
        search: "?code=foo&state=bar",
      }),
    ).toBe(stored);
  });

  it("preserves trailing slashes when reconstructing from the current location", () => {
    const location = {
      origin: "https://app.example.com",
      pathname: "/integrations/google-drive/callback/",
      search: "?code=foo&scope=email%20profile",
    };

    expect(resolveDriveRedirectUri(undefined, location)).toBe(
      "https://app.example.com/integrations/google-drive/callback/",
    );
  });

  it("retains static query parameters while removing OAuth response parameters", () => {
    const location = {
      origin: "https://app.example.com",
      pathname: "/integrations/google-drive/callback",
      search: "?tenant=ecopro&code=foo&scope=email&state=nonce&prompt=consent",
    };

    expect(resolveDriveRedirectUri("", location)).toBe(
      "https://app.example.com/integrations/google-drive/callback?tenant=ecopro",
    );
  });
});
