import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "br",
  "span",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  span: ["style"],
  p: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
};

const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    "font-family": [/^['"a-zA-Z0-9 ,\-]+$/],
    "font-size": [/^\d+(\.\d+)?px$/],
    "font-weight": [/^(normal|bold|[1-9]00)$/],
    "text-decoration": [/^(none|underline|line-through|underline line-through)$/],
    "text-align": [/^(left|center|right|justify)$/],
  },
};

export const PRODUCT_DESCRIPTION_STYLES = `
.product-description {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  max-height: 620px;
  overflow: hidden;
}
.product-description h1 { font-size: 18px; }
.product-description h2 { font-size: 16px; }
.product-description h3 { font-size: 14px; }
.product-description b,
.product-description strong { font-weight: 700; }
.product-description i,
.product-description em { font-style: italic; }
.product-description u { text-decoration: underline; }
`;

export const renderProductDescription = (descriptionHtml: string | null | undefined) => {
  if (!descriptionHtml) {
    return "";
  }

  const sanitized = sanitizeHtml(descriptionHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: attribs.rel ?? "noopener noreferrer",
          target: attribs.target ?? "_blank",
        },
      }),
    },
  });

  if (!sanitized || sanitized.trim().length === 0) {
    return "";
  }

  return `<div class="product-description">${sanitized}</div>`;
};
