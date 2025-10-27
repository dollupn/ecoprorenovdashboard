import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Heading from "@tiptap/extension-heading";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import DOMPurify from "dompurify";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RichDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  onLengthChange?: (length: number) => void;
}

const allowedTags = [
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

const styleAllowedTags = new Set(["span", "p", "h1", "h2", "h3"]);

const styleValidators: Record<string, RegExp> = {
  "font-family": /^['"a-zA-Z0-9 ,\-]+$/,
  "font-size": /^\d+(\.\d+)?px$/,
  "font-weight": /^(normal|bold|[1-9]00)$/,
  "text-decoration": /^(none|underline|line-through|underline line-through)$/,
  "text-align": /^(left|center|right|justify)$/,
};

const sanitize = (html: string) => {
  if (!html || typeof window === "undefined") {
    return html;
  }

  const lowerAllowedAttrsByTag: Record<string, Set<string>> = {
    a: new Set(["href", "target", "rel"]),
    span: new Set(["style"]),
    p: new Set(["style"]),
    h1: new Set(["style"]),
    h2: new Set(["style"]),
    h3: new Set(["style"]),
  };

  DOMPurify.addHook("uponSanitizeElement", (_node, data) => {
    if (data.tagName === "div") {
      data.tagName = "p";
    }
  });

  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    const tag = (node as Element).tagName?.toLowerCase();
    const attr = data.attrName?.toLowerCase();

    if (!tag || !attr) {
      return;
    }

    if (attr === "style") {
      if (!styleAllowedTags.has(tag)) {
        data.keepAttr = false;
        return;
      }

      const sanitizedStyle = data.attrValue
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [property, value] = part.split(":").map((item) => item.trim());
          if (!property || !value) {
            return null;
          }
          const validator = styleValidators[property as keyof typeof styleValidators];
          return validator && validator.test(value) ? `${property}: ${value}` : null;
        })
        .filter((value): value is string => Boolean(value))
        .join("; ");

      if (sanitizedStyle) {
        data.attrValue = sanitizedStyle;
      } else {
        data.keepAttr = false;
      }
      return;
    }

    const allowedAttrs = lowerAllowedAttrsByTag[tag];
    if (!allowedAttrs) {
      if (["href", "target", "rel"].includes(attr)) {
        data.keepAttr = false;
      }
      return;
    }

    if (!allowedAttrs.has(attr)) {
      data.keepAttr = false;
    }
  });

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName.toLowerCase() === "a") {
      if (!node.getAttribute("rel")) {
        node.setAttribute("rel", "noopener noreferrer");
      }
      if (!node.getAttribute("target")) {
        node.setAttribute("target", "_blank");
      }
    }
  });

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ["href", "target", "rel", "style"],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });

  DOMPurify.removeHook("uponSanitizeElement");
  DOMPurify.removeHook("uponSanitizeAttribute");
  DOMPurify.removeHook("afterSanitizeAttributes");

  return sanitized;
};

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

const fontFamilies = [
  { label: "Par défaut", value: "default" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Serif", value: "serif" },
];

const fontSizes = [
  { label: "12 px", value: "12px" },
  { label: "14 px", value: "14px" },
  { label: "16 px", value: "16px" },
  { label: "18 px", value: "18px" },
];

const ToolbarButton = ({
  onClick,
  isActive,
  icon: Icon,
  label,
  disabled,
}: {
  onClick: () => void;
  isActive?: boolean;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
}) => (
  <Button
    type="button"
    variant={isActive ? "secondary" : "ghost"}
    size="icon"
    onClick={onClick}
    aria-label={label}
    className="h-8 w-8"
    disabled={disabled}
  >
    <Icon className="h-4 w-4" />
  </Button>
);

export const RichDescription = ({
  value,
  onChange,
  onBlur,
  maxLength,
  className,
  disabled,
  onLengthChange,
}: RichDescriptionProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: "Décrivez le produit, ajoutez les arguments clés, etc.",
      }),
    ],
    content: value && value.trim().length > 0 ? value : "",
    editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      const sanitized = sanitize(html);
      const trimmed = instance.isEmpty ? "" : sanitized;
      onChange(trimmed);
      onLengthChange?.(trimmed.length);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const sanitized = sanitize(value ?? "");
    const normalized = sanitized || "";
    if (editor.isEmpty && !normalized) return;
    if (current === normalized) return;
    editor.commands.setContent(normalized, { emitUpdate: false });
  }, [editor, value]);

  const activeFontFamily = useMemo(() => editor?.getAttributes("textStyle")?.fontFamily ?? "", [editor]);
  const activeFontSize = useMemo(() => editor?.getAttributes("textStyle")?.fontSize ?? "", [editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Ajouter un lien", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.commands.unsetLink();
      return;
    }
    editor.commands.setLink({ href: url, target: "_blank" });
  };

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          label="Gras"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={Italic}
          label="Italique"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={UnderlineIcon}
          label="Souligné"
          disabled={disabled}
        />
        <Select
          value={editor.isActive("heading", { level: 1 })
            ? "h1"
            : editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "paragraph"}
          onValueChange={(value) => {
            editor.chain().focus();
            if (value === "paragraph") {
              editor.chain().setParagraph().run();
            } else {
              const level = Number(value.replace("h", ""));
              editor.chain().toggleHeading({ level: level as 1 | 2 | 3 }).run();
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue placeholder="Paragraphe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Paragraphe</SelectItem>
            <SelectItem value="h1">Titre 1</SelectItem>
            <SelectItem value="h2">Titre 2</SelectItem>
            <SelectItem value="h3">Titre 3</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={activeFontSize || ""}
          onValueChange={(value) => {
            if (!value) {
              editor.chain().focus();
              editor.commands.unsetFontSize?.();
              return;
            }
            editor.chain().focus();
            editor.commands.setFontSize?.(value);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-24">
            <SelectValue placeholder="Taille" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Taille</SelectItem>
            {fontSizes.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={activeFontFamily || "default"}
          onValueChange={(value) => {
            editor.chain().focus();
            if (value === "default") {
              editor.commands.unsetFontFamily?.();
              return;
            }
            editor.commands.setFontFamily?.(value);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Police" />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((family) => (
              <SelectItem key={family.value} value={family.value}>
                {family.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          icon={List}
          label="Liste"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          icon={ListOrdered}
          label="Liste numérotée"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          icon={LinkIcon}
          label="Lien"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          icon={AlignLeft}
          label="Aligner à gauche"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          icon={AlignCenter}
          label="Centrer"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          icon={AlignRight}
          label="Aligner à droite"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo2}
          label="Annuler"
          disabled={!editor.can().undo() || disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo2}
          label="Refaire"
          disabled={!editor.can().redo() || disabled}
        />
      </div>
      <EditorContent
        editor={editor}
        onBlur={onBlur}
        className="prose max-w-none min-h-[200px] px-3 py-2 focus-visible:outline-none"
      />
      {maxLength ? (
        <div className="flex justify-end px-3 pb-2 text-xs text-muted-foreground">
          {value.length}/{maxLength} caractères
        </div>
      ) : null}
    </div>
  );
};
