import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatQuoteCurrency, parseQuoteMetadata, computeLineItemsTotal } from "./utils";
import type { QuoteRecord } from "./types";
import { CalendarDays, FileText, FolderOpen, Mail, Phone, User, MapPin, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface QuoteDetailsDrawerProps {
  quote: QuoteRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
};

export const QuoteDetailsDrawer = ({ quote, open, onOpenChange }: QuoteDetailsDrawerProps) => {
  const metadata = useMemo(() => (quote ? parseQuoteMetadata(quote) : undefined), [quote]);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleSendEmail = () => {
    if (!quote || !metadata?.clientEmail) {
      return;
    }

    const subject = encodeURIComponent(`Devis ${quote.quote_ref}`);
    const body = encodeURIComponent(
      metadata.emailMessage ??
        `Bonjour,\n\nVeuillez trouver ci-joint le devis ${quote.quote_ref}.\nMontant HT : ${formatQuoteCurrency(
          Number(quote.amount || 0)
        )}\n\nRestant à votre disposition.\n`
    );

    if (typeof window !== "undefined") {
      window.open(`mailto:${metadata.clientEmail}?subject=${subject}&body=${body}`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote) {
      return;
    }

    try {
      setIsDownloadingPdf(true);
      const response = await fetch(`/api/quotes/${quote.id}/pdf`, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
        },
        credentials: "include",
      });

      if (!response.ok) {
        let message = "Le PDF n'a pas pu être généré.";
        const contentType = response.headers.get("Content-Type") ?? "";

        if (contentType.includes("application/json")) {
          try {
            const payload = await response.json();
            if (typeof payload?.message === "string" && payload.message.trim()) {
              message = payload.message;
            }
          } catch (error) {
            console.warn("Impossible de lire la réponse d'erreur", error);
          }
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const reference = quote.quote_ref ? quote.quote_ref.replace(/\s+/g, "-") : quote.id;
      link.href = url;
      link.download = `Devis-${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Devis généré",
        description: `Le PDF du devis ${quote.quote_ref ?? ""} est en cours de téléchargement`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Le PDF n'a pas pu être généré.";
      toast({
        title: "Erreur lors du téléchargement",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-left">
            {quote ? `Devis ${quote.quote_ref}` : "Devis"}
          </SheetTitle>
          <SheetDescription className="text-left">
            {quote?.client_name ? `Client : ${quote.client_name}` : "Consultez les informations détaillées du devis."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-full pb-8">
          {!quote ? (
            <div className="py-10 text-sm text-muted-foreground">
              Sélectionnez un devis pour afficher ses informations.
            </div>
          ) : (
            <div className="space-y-6 py-6">
              <section className="grid grid-cols-1 gap-3 rounded-lg border bg-background/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge>{statusLabels[quote.status as keyof typeof statusLabels] ?? quote.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Montant HT</span>
                  <span className="font-semibold text-primary">
                    {formatQuoteCurrency(Number(quote.amount || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Validité</span>
                  <span className="font-medium">{quote.valid_until ? quote.valid_until : "Non précisée"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Projet</span>
                  <span className="font-medium">
                    {quote.projects?.project_ref ?? "Sans projet"}
                  </span>
                </div>
                <Button
                  className="mt-2"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloadingPdf ? "Génération du PDF..." : "Télécharger le devis (PDF)"}
                </Button>
              </section>

              <section className="space-y-4 rounded-lg border bg-background/60 p-4 text-sm">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Informations client
                </h3>
                <div className="space-y-2">
                  <p className="font-medium">{quote.client_name}</p>
                  {metadata?.clientEmail ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {metadata.clientEmail}
                    </p>
                  ) : null}
                  {metadata?.clientPhone ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {metadata.clientPhone}
                    </p>
                  ) : null}
                  {metadata?.siteAddress ? (
                    <p className="text-muted-foreground whitespace-pre-line">{metadata.siteAddress}</p>
                  ) : null}
                  {metadata?.siteCity || metadata?.sitePostalCode ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {metadata.sitePostalCode ? `${metadata.sitePostalCode} ` : ""}
                        {metadata.siteCity ?? ""}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={!metadata?.clientEmail}>
                    <Mail className="mr-2 h-4 w-4" />
                    Contacter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (metadata?.driveFolderUrl && typeof window !== "undefined") {
                        window.open(metadata.driveFolderUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    disabled={!metadata?.driveFolderUrl}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Ouvrir Drive
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (metadata?.driveFileUrl && typeof window !== "undefined") {
                        window.open(metadata.driveFileUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    disabled={!metadata?.driveFileUrl}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Ouvrir le document
                  </Button>
                </div>
              </section>

              {metadata?.lineItems?.length ? (
                <section className="space-y-4 rounded-lg border bg-background/60 p-4 text-sm">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Détail des prestations
                  </h3>
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Référence</th>
                          <th className="px-3 py-2 text-left font-medium">Description</th>
                          <th className="px-3 py-2 text-right font-medium">Quantité</th>
                          <th className="px-3 py-2 text-right font-medium">PU HT</th>
                          <th className="px-3 py-2 text-right font-medium">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metadata.lineItems.map((item, index) => (
                          <tr key={`${item.reference ?? "item"}-${index}`} className="border-t">
                            <td className="px-3 py-2 align-top text-muted-foreground">
                              {item.reference ?? "—"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <p className="font-medium">{item.description}</p>
                            </td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatQuoteCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatQuoteCurrency(item.quantity * item.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/60">
                        <tr>
                          <td className="px-3 py-2 text-right font-medium" colSpan={4}>
                            Sous-total
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatQuoteCurrency(computeLineItemsTotal(metadata.lineItems))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              ) : null}

              {metadata?.paymentTerms ? (
                <section className="space-y-3 rounded-lg border bg-background/60 p-4 text-sm">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Modalités
                  </h3>
                  <p className="whitespace-pre-line text-muted-foreground">{metadata.paymentTerms}</p>
                </section>
              ) : null}

              {metadata?.emailMessage ? (
                <section className="space-y-3 rounded-lg border bg-background/60 p-4 text-sm">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Message email
                  </h3>
                  <p className="whitespace-pre-line text-muted-foreground">{metadata.emailMessage}</p>
                </section>
              ) : null}

              {metadata?.internalNotes ? (
                <section className="space-y-3 rounded-lg border bg-background/60 p-4 text-sm">
                  <h3 className="text-base font-semibold">Notes internes</h3>
                  <p className="whitespace-pre-line text-muted-foreground">{metadata.internalNotes}</p>
                </section>
              ) : null}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
