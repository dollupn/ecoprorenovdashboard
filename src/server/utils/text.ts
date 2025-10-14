const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const convertMultilineTextToHtml = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const cleaned = value
    .split(/\r?\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!cleaned.length) {
    return null;
  }

  return cleaned.map((segment) => `<p>${escapeHtml(segment)}</p>`).join("\n");
};
