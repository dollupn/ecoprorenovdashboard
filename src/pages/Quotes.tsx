import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuotePreview } from "@/components/quotes/QuotePreview";
import { AddQuoteDialog, type QuoteFormValues } from "@/components/quotes/AddQuoteDialog";
import { QuoteDetailsDrawer } from "@/components/quotes/QuoteDetailsDrawer";
import { QuoteActions } from "@/components/quotes/QuoteActions";
import { parseQuoteMetadata, formatQuoteCurrency } from "@/components/quotes/utils";
import type { QuoteRecord } from "@/components/quotes/types";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { withDefaultProductCeeConfig } from "@/lib/prime-cee-unified";

import {
  Search,
  Filter,
  PlusCircle,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  Timer,
  Send,
  Eye,
  AlertCircle,
  Loader2,
  UserPlus,
  FolderKanban,
  FileText,
  HardHat,
  PhoneCall,
  Receipt,
  ArrowRight,
} from "lucide-react";

/** ---- Status & Types ---- */
const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const statusMeta: Record<QuoteStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Brouillon",
    className: "bg-gray-500/10 text-gray-700 border-gray-200",
  },
  SENT: {
    label: "Envoyé",
    className: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  ACCEPTED: {
    label: "Accepté",
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  REJECTED: {
    label: "Refusé",
    className: "bg-red-500/10 text-red-700 border-red-200",
  },
  EXPIRED: {
    label: "Expiré",
    className: "bg-orange-500/10 text-orange-700 border-orange-200",
  },
};

/** ---- Utils ---- */
const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
};

const normalizeProductCode = (code: string) => code.trim().toUpperCase();

const filterUniqueProductCodes = (codes: (string | null | undefined)[]) => {
  const seen = new Set<string>();
  const filtered: string[] = [];

  codes.forEach((rawCode) => {
    if (!rawCode) return;
    const normalized = normalizeProductCode(rawCode);

    if (!normalized) return;
    if (normalized.startsWith("ECO")) return;
    if (normalized.includes(" ")) return;

    const hasDigit = /\d/.test(normalized);
    const hasSeparator = normalized.includes("-") || normalized.includes("_") || normalized.includes("/");

    if (!hasDigit && !hasSeparator) return;
    if (seen.has(normalized)) return;

    seen.add(normalized);
    filtered.push(normalized);
  });

  return filtered;
};

const splitPotentialCodes = (value?: string | null) => {
  if (!value) {
    return [] as string[];
  }

  return value
    .split(/[\n,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+-\s+/)[0]?.trim() ?? "")
    .filter(Boolean);
};

const computeQuoteProductCodes = (quote: QuoteRecord) => {
  const projectCodes = filterUniqueProductCodes(
    (quote.projects?.project_products ?? []).map((item) => item.product?.code)
  );

  if (projectCodes.length > 0) {
    return projectCodes;
  }

  const metadata = parseQuoteMetadata(quote);
  const metadataCodes = filterUniqueProductCodes(
    (metadata.lineItems ?? []).map((item) => item.reference ?? undefined)
  );

  if (metadataCodes.length > 0) {
    return metadataCodes;
  }

  const fallbackCandidates = [
    ...splitPotentialCodes(quote.product_name),
    ...splitPotentialCodes(quote.projects?.product_name ?? null),
  ];

  return filterUniqueProductCodes(fallbackCandidates);
};

/** ---- Data ---- */
const fetchQuotes = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId?: string | null;
}): Promise<QuoteRecord[]> => {
  let query = supabase
    .from("quotes")
    .select(
      "*, projects(project_ref, client_name, product_name, project_products(product:product_catalog(code, cee_config, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac))))"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching quotes", error);
    throw error;
  }

  const sanitized = (data ?? []).map((quote) => {
    if (!quote.projects?.project_products) {
      return quote;
    }

    return {
      ...quote,
      projects: {
        ...quote.projects,
        project_products: quote.projects.project_products.map((projectProduct) => {
          if (!projectProduct?.product) {
            return projectProduct;
          }

          return {
            ...projectProduct,
            product: withDefaultProductCeeConfig(projectProduct.product),
          };
        }),
      },
    } satisfies QuoteRecord;
  });

  return sanitized as QuoteRecord[];
};

const Quotes = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] = useState<Partial<QuoteFormValues>>({});
  const [quoteIdToEdit, setQuoteIdToEdit] = useState<string | null>(null);
  const openEditDialog = useCallback(
    (quote: QuoteRecord) => {
      const metadata = parseQuoteMetadata(quote);

      setQuoteInitialValues({
        quote_ref: quote.quote_ref ?? "",
        client_name: quote.client_name ?? "",
        product_name: quote.product_name ?? "",
        amount: Number(quote.amount ?? 0),
        status: (quote.status ?? "DRAFT") as QuoteFormValues["status"],
        project_id: quote.project_id ?? undefined,
        valid_until: quote.valid_until ?? undefined,
        notes: quote.notes ?? undefined,
        client_email: metadata.clientEmail ?? "",
        client_phone: metadata.clientPhone ?? "",
        site_address: metadata.siteAddress ?? "",
        site_city: metadata.siteCity ?? "",
        site_postal_code: metadata.sitePostalCode ?? "",
        payment_terms: metadata.paymentTerms ?? "",
        drive_folder_url: metadata.driveFolderUrl ?? "",
        email_message: metadata.emailMessage ?? "",
        line_items: metadata.lineItems
          ? metadata.lineItems.map((item) => ({
              reference: item.reference ?? "",
              description: item.description ?? "",
              quantity: item.quantity ?? 0,
              unit_price: item.unitPrice ?? 0,
              tax_rate: item.taxRate ?? undefined,
            }))
          : undefined,
      });

      setQuoteIdToEdit(quote.id);
      setQuoteDialogOpen(true);
      setSelectedQuote(quote);
      setDetailsOpen(false);
    },
    [],
  );
  const processSteps = [
    {
      label: "Lead",
      description: "Qualification commerciale",
      icon: UserPlus,
    },
    {
      label: "Projet",
      description: "Structure et estimation",
      icon: FolderKanban,
    },
    {
      label: "Devis",
      description: "Validation offre client",
      icon: FileText,
    },
    {
      label: "Chantier",
      description: "Pilotage d'exécution",
      icon: HardHat,
    },
    {
      label: "Appel à facture",
      description: "Préparation facturation",
      icon: PhoneCall,
    },
    {
      label: "Facture",
      description: "Transformation du devis",
      icon: Receipt,
    },
  ];

  const {
    data: quotes = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["quotes", user?.id, currentOrgId],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      return fetchQuotes({ userId: user.id, orgId: currentOrgId });
    },
  });

  const metrics = useMemo(() => {
    const totalAmount = quotes.reduce((total, quote) => total + Number(quote.amount || 0), 0);
    const accepted = quotes.filter((q) => q.status === "ACCEPTED");
    const sent = quotes.filter((q) => q.status === "SENT");
    const draft = quotes.filter((q) => q.status === "DRAFT");
    const rejected = quotes.filter((q) => q.status === "REJECTED");
    const expired = quotes.filter((q) => q.status === "EXPIRED");

    const upcomingExpiry = quotes.filter((q) => {
      if (!q.valid_until) return false;
      const validityDate = new Date(q.valid_until);
      const now = new Date();
      const diffInDays = Math.ceil((validityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffInDays >= 0 && diffInDays <= 7;
    });

    const conversionRate = quotes.length ? Math.round((accepted.length / quotes.length) * 100) : 0;

    return {
      totalAmount,
      accepted: accepted.length,
      sent: sent.length,
      draft: draft.length,
      rejected: rejected.length,
      expired: expired.length,
      upcomingExpiry: upcomingExpiry.length,
      conversionRate,
    };
  }, [quotes]);

  const productCodesByQuote = useMemo(() => {
    const map = new Map<string, string[]>();

    quotes.forEach((quote) => {
      map.set(quote.id, computeQuoteProductCodes(quote));
    });

    return map;
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return quotes;
    }

    return quotes.filter((quote) => {
      const projectRef = quote.projects?.project_ref ?? "";
      const productName = quote.product_name ?? quote.projects?.product_name ?? "";
      const productCodes = productCodesByQuote.get(quote.id) ?? [];

      const searchable = [
        quote.quote_ref,
        quote.client_name,
        projectRef,
        productName,
        productCodes.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [quotes, searchTerm, productCodesByQuote]);

  const renderStatus = (status: string) => {
    const normalized = (status?.toUpperCase() as QuoteStatus) || "DRAFT";
    const meta = statusMeta[normalized] ?? statusMeta.DRAFT;
    return <Badge className={meta.className}>{meta.label}</Badge>;
  };

  const handleDownloadQuotePdf = async (value: QuoteRecord) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const response = await fetch(`/api/quotes/${value.id}/pdf`, {
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
      const reference = value.quote_ref ? value.quote_ref.replace(/\s+/g, "-") : value.id;
      link.href = url;
      link.download = `Devis-${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Téléchargement du devis",
        description: `Le PDF du devis ${value.quote_ref ?? ""} est en cours de téléchargement.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Le PDF n'a pas pu être généré.";

      toast({
        title: "Erreur lors du téléchargement",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Devis
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi des propositions commerciales avec données Supabase en temps réel
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importer CSV
            </Button>
            <Button variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <AddQuoteDialog
              onQuoteAdded={async () => {
                await refetch();
              }}
              trigger={
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Nouveau Devis
                </Button>
              }
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Total pipeline</CardTitle>
            </CardHeader>
              <CardContent className="text-2xl font-semibold">
              {formatQuoteCurrency(metrics.totalAmount)}
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Taux de conversion</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-semibold">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              {metrics.conversionRate}%
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Devis envoyés</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              {metrics.sent}
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle>Expiration prochaine</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold flex items-center gap-2">
              <Timer className="w-5 h-5 text-orange-500" />
              {metrics.upcomingExpiry}
            </CardContent>
          </Card>
        </div>

        {/* Search / Filters */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par client, référence, projet ou solution"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres avancés
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Error state */}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Impossible de charger les devis</AlertTitle>
            <AlertDescription>
              {error?.message || "Vérifiez votre connexion Supabase puis réessayez."}
            </AlertDescription>
            <div className="mt-4">
              <Button variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          </Alert>
        )}

        {/* Table */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  Devis ({filteredQuotes.length}
                  {searchTerm ? ` / ${quotes.length}` : ""})
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dernière mise à jour {formatDate(new Date().toISOString())}
                </p>
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              {filteredQuotes.length === 0 && !isLoading ? (
                searchTerm ? (
                  <div className="text-center py-12">
                    <Eye className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-4 text-muted-foreground">
                      Aucun devis ne correspond à votre recherche.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Eye className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-4 text-muted-foreground">
                      Aucun devis n'est encore enregistré dans Supabase. Créez votre premier devis pour suivre votre pipeline.
                    </p>
                  </div>
                )
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                       <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Projet</TableHead>
                        <TableHead>Solution</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Validité</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map((quote) => {
                        const productCodes = productCodesByQuote.get(quote.id) ?? [];

                        return (
                          <TableRow key={quote.id}>
                            <TableCell className="font-medium">{quote.quote_ref}</TableCell>
                            <TableCell>{quote.client_name}</TableCell>
                            <TableCell>{quote.projects?.project_ref ?? "—"}</TableCell>
                            <TableCell>
                              {productCodes.length > 0 ? productCodes.join(", ") : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatQuoteCurrency(Number(quote.amount || 0))}
                            </TableCell>
                            <TableCell>{renderStatus(quote.status || "DRAFT")}</TableCell>
                            <TableCell>{formatDate(quote.valid_until)}</TableCell>
                            <TableCell className="text-right">
                              <QuoteActions
                                quote={quote}
                                onView={(value) => {
                                  setSelectedQuote(value);
                                  setDetailsOpen(true);
                                }}
                                onDownload={(value) => {
                                  void handleDownloadQuotePdf(value);
                                }}
                                onOpenDrive={(value) => {
                                  const metadata = parseQuoteMetadata(value);

                                  const targetUrl = metadata.driveFileUrl ?? metadata.driveFolderUrl;

                                  if (!targetUrl) {
                                    toast({
                                      title: "Lien indisponible",
                                      description: "Aucun document ou dossier Google Drive n'est associé à ce devis.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  if (typeof window !== "undefined") {
                                    window.open(targetUrl, "_blank", "noopener,noreferrer");
                                  }
                                }}
                                onSendEmail={(value) => {
                                  const metadata = parseQuoteMetadata(value);

                                  if (!metadata.clientEmail) {
                                    toast({
                                      title: "Email manquant",
                                      description: "Renseignez l'adresse email du client pour envoyer le devis.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  const subject = encodeURIComponent(`Devis ${value.quote_ref}`);
                                  const defaultBody = `Bonjour,\n\nVeuillez trouver ci-joint le devis ${value.quote_ref}.\nMontant HT : ${formatQuoteCurrency(Number(
                                    value.amount || 0
                                  ))}\n\n${metadata.emailMessage ?? "Restant à votre disposition."}`;
                                  const body = encodeURIComponent(defaultBody);

                                  if (typeof window !== "undefined") {
                                    window.open(`mailto:${metadata.clientEmail}?subject=${subject}&body=${body}`);
                                  }
                                }}
                                onEdit={openEditDialog}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <QuoteDetailsDrawer
        quote={selectedQuote}
        open={detailsOpen && Boolean(selectedQuote)}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedQuote(null);
          }
        }}
        onEdit={(quote) => {
          openEditDialog(quote);
        }}
      />

      <AddQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={(open) => {
          setQuoteDialogOpen(open);
          if (!open) {
            setQuoteIdToEdit(null);
            setQuoteInitialValues({});
          }
        }}
        initialValues={quoteInitialValues}
        mode="edit"
        quoteId={quoteIdToEdit ?? undefined}
        onQuoteAdded={async () => {
          await refetch();
        }}
      />
    </Layout>
  );
};

export default Quotes;
