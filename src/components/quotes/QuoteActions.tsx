import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { parseQuoteMetadata } from "./utils";
import type { QuoteRecord } from "./types";
import { Eye, Download, Mail, FolderOpen, MoreHorizontal, FileText, ListChecks } from "lucide-react";

interface QuoteActionsProps {
  quote: QuoteRecord;
  onView: (quote: QuoteRecord) => void;
  onDownload: (quote: QuoteRecord) => void;
  onOpenDrive: (quote: QuoteRecord) => void;
  onSendEmail: (quote: QuoteRecord) => void;
}

export const QuoteActions = ({
  quote,
  onView,
  onDownload,
  onOpenDrive,
  onSendEmail,
}: QuoteActionsProps) => {
  const metadata = useMemo(() => parseQuoteMetadata(quote), [quote]);

  const hasDriveFolder = Boolean(metadata.driveFolderUrl);
  const hasDriveFile = Boolean(metadata.driveFileUrl);
  const hasClientEmail = Boolean(metadata.clientEmail);
  const hasLineItems = Boolean(metadata.lineItems?.length);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDownload(quote)}
        className="gap-1"
      >
        <Download className="h-3.5 w-3.5" />
        Télécharger (PDF)
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Actions devis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onView(quote)}>
          <Eye className="mr-2 h-4 w-4" />
          Consulter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSendEmail(quote)} disabled={!hasClientEmail}>
          <Mail className="mr-2 h-4 w-4" />
          Envoyer par email
          {!hasClientEmail ? (
            <Badge variant="secondary" className="ml-auto">
              Email requis
            </Badge>
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenDrive(quote)} disabled={!hasDriveFolder}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Ouvrir dans Drive
          {!hasDriveFolder ? (
            <Badge variant="secondary" className="ml-auto">
              Lien manquant
            </Badge>
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (metadata.driveFileUrl && typeof window !== "undefined") {
              window.open(metadata.driveFileUrl, "_blank", "noopener,noreferrer");
            }
          }}
          disabled={!hasDriveFile}
        >
          <FileText className="mr-2 h-4 w-4" />
          Ouvrir le document
          {!hasDriveFile ? (
            <Badge variant="secondary" className="ml-auto">
              Document manquant
            </Badge>
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasLineItems}>
          <ListChecks className="mr-2 h-4 w-4" />
          {hasLineItems ? `${metadata.lineItems?.length ?? 0} lignes` : "Lignes non définies"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
};
