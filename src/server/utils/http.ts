export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ParsedResponseBody = {
  body: unknown;
  text: string;
};

export const parseResponseBody = async (response: Response): Promise<ParsedResponseBody> => {
  const text = await response.text();

  if (!text) {
    return { body: null, text: "" };
  }

  try {
    return { body: JSON.parse(text) as unknown, text };
  } catch {
    return { body: text, text };
  }
};

export const extractMessage = (payload: unknown, fallback: string): string => {
  if (!payload) {
    return fallback;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (isRecord(payload)) {
    const candidateKeys = ["message", "error", "detail"] as const;

    for (const key of candidateKeys) {
      const value = payload[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }

  return fallback;
};
