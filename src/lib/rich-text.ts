export const isRichTextEmpty = (html: string) => {
  if (!html) return true;
  const sanitized = html.replace(/<p><br><\/p>/g, "").replace(/<p>\s*<\/p>/g, "");
  return sanitized.trim().length === 0;
};
