import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  format,
  formatISO,
  isSameMonth,
  parseISO,
  setDate,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Calculator,
  CalendarClock,
  CheckCircle2,
  DownloadCloud,
  FileSpreadsheet,
  FileText,
  NotebookPen,
  Receipt,
  TrendingUp,
} from "lucide-react";
import {
  ExportFormat,
  generateBalanceExport,
  generateFECExport,
  generateJournalExport,
} from "@/features/accounting/exports";

const STORAGE_KEY = "accountingDeclarations";
const DUE_DAY = 19;

type DeclarationStatus = "pending" | "submitted";

type DeclarationRecord = {
  period: string;
  dueDate: string;
  status: DeclarationStatus;
  submittedAt?: string;
};

type AccountingExportType = "fec" | "balance" | "journal";

type SampleEntry = {
  id: string;
  amountHT: number;
  vatRate?: number;
};

const sampleSales: SampleEntry[] = [
  { id: "FAC-2025-001", amountHT: 12500, vatRate: 0.2 },
  { id: "FAC-2025-002", amountHT: 8400 },
  { id: "FAC-2025-003", amountHT: 2100, vatRate: 0.055 },
];

const samplePurchases: SampleEntry[] = [
  { id: "ACH-2025-01", amountHT: 3200, vatRate: 0.2 },
  { id: "ACH-2025-02", amountHT: 540, vatRate: 0.1 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const formatDisplayDate = (isoDate: string) =>
  format(parseISO(isoDate), "dd MMMM yyyy", { locale: fr });

const formatPeriodLabel = (date: Date) => {
  const formatted = format(date, "LLLL yyyy", { locale: fr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const sortDeclarations = (records: DeclarationRecord[]) =>
  [...records].sort(
    (a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime(),
  );

const createInitialDeclarations = (): DeclarationRecord[] => {
  const today = new Date();
  const previousPeriodDate = subMonths(today, 1);
  const previousDueDate = setDate(new Date(today.getFullYear(), today.getMonth(), 1), DUE_DAY);
  const currentDueDate = setDate(addMonths(today, 1), DUE_DAY);

  return sortDeclarations([
    {
      period: formatPeriodLabel(previousPeriodDate),
      dueDate: formatISO(previousDueDate),
      status: "submitted",
      submittedAt: formatISO(addDays(previousDueDate, -2)),
    },
    {
      period: formatPeriodLabel(today),
      dueDate: formatISO(currentDueDate),
      status: "pending",
    },
  ]);
};

const Accounting = () => {
  const { toast } = useToast();
  const [declarations, setDeclarations] = useState<DeclarationRecord[]>(() => {
    if (typeof window === "undefined") {
      return createInitialDeclarations();
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DeclarationRecord[];
        return sortDeclarations(parsed);
      } catch (error) {
        console.warn("Unable to parse stored declarations", error);
      }
    }

    return createInitialDeclarations();
  });
  const [fallbackVatRateInput, setFallbackVatRateInput] = useState("20");
  const [exporting, setExporting] = useState<{ type: AccountingExportType; format: ExportFormat } | null>(
    null,
  );

  const fallbackVatRatePercent = useMemo(() => {
    const sanitized = fallbackVatRateInput.replace(",", ".");
    const parsed = Number.parseFloat(sanitized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return 20;
  }, [fallbackVatRateInput]);

  const fallbackVatRate = fallbackVatRatePercent / 100;

  const sortedDeclarations = useMemo(
    () => sortDeclarations(declarations),
    [declarations],
  );

  const nextDeclaration = sortedDeclarations.find((record) => record.status === "pending");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedDeclarations));
  }, [sortedDeclarations]);

  const collectedVAT = useMemo(
    () =>
      sampleSales.reduce((total, sale) => {
        const rate = sale.vatRate ?? fallbackVatRate;
        return total + sale.amountHT * rate;
      }, 0),
    [fallbackVatRate],
  );

  const deductibleVAT = useMemo(
    () =>
      samplePurchases.reduce((total, purchase) => {
        const rate = purchase.vatRate ?? fallbackVatRate;
        return total + purchase.amountHT * rate;
      }, 0),
    [fallbackVatRate],
  );

  const vatBalance = collectedVAT - deductibleVAT;

  const handleMarkSubmitted = (record: DeclarationRecord) => {
    setDeclarations((current) => {
      const updated = current.map((item) =>
        item.period === record.period
          ? {
              ...item,
              status: "submitted" as const,
              submittedAt: new Date().toISOString(),
            }
          : item,
      );

      const currentDueDate = parseISO(record.dueDate);
      const periodDate = addMonths(currentDueDate, -1);
      const nextPeriodDate = addMonths(periodDate, 1);
      const nextDueDate = setDate(addMonths(currentDueDate, 1), currentDueDate.getDate());

      const hasNext = updated.some((item) => isSameMonth(parseISO(item.dueDate), nextDueDate));

      if (!hasNext) {
        updated.push({
          period: formatPeriodLabel(nextPeriodDate),
          dueDate: formatISO(nextDueDate),
          status: "pending",
        });
      }

      return sortDeclarations(updated);
    });

    toast({
      title: "Déclaration clôturée",
      description: `La période ${record.period} est marquée comme déposée.`,
    });
  };

  const handleExport = async (type: AccountingExportType, format: ExportFormat) => {
    setExporting({ type, format });

    try {
      let result;
      switch (type) {
        case "balance":
          result = await generateBalanceExport(format);
          break;
        case "journal":
          result = await generateJournalExport(format);
          break;
        default:
          result = await generateFECExport(format);
          break;
      }

      toast({
        title: result.success ? "Export lancé" : "Export indisponible",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Export error", error);
      toast({
        title: "Erreur lors de l'export",
        description: "Veuillez réessayer ou contacter votre administrateur.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const isExporting = (type: AccountingExportType, format: ExportFormat) =>
    exporting?.type === type && exporting?.format === format;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
          <p className="text-muted-foreground">
            Gestion comptable et fiscale de votre activité
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 €</div>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">TVA Collectée</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(collectedVAT)}</div>
              <p className="text-xs text-muted-foreground">Total simulé</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">TVA Déductible</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(deductibleVAT)}</div>
              <p className="text-xs text-muted-foreground">Achats & charges</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solde TVA</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(vatBalance)}</div>
              <p className="text-xs text-muted-foreground">Collectée - Déductible</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                TVA & Déclarations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {nextDeclaration ? (
                <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Prochaine échéance</p>
                    <p className="text-lg font-semibold">{nextDeclaration.period}</p>
                    <p className="text-sm text-muted-foreground">
                      Déclaration à déposer avant le {formatDisplayDate(nextDeclaration.dueDate)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleMarkSubmitted(nextDeclaration)}
                    variant="default"
                    className="w-full sm:w-auto"
                  >
                    Marquer comme déposée
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Toutes les déclarations sont à jour.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">TVA collectée</p>
                  <p className="text-xl font-semibold">{formatCurrency(collectedVAT)}</p>
                  <p className="text-xs text-muted-foreground">Calculée depuis les factures de vente</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">TVA déductible</p>
                  <p className="text-xl font-semibold">{formatCurrency(deductibleVAT)}</p>
                  <p className="text-xs text-muted-foreground">Basée sur vos achats et charges</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Solde estimé</p>
                  <p className="text-xl font-semibold">{formatCurrency(vatBalance)}</p>
                  <Badge variant={vatBalance >= 0 ? "default" : "secondary"} className="mt-2">
                    {vatBalance >= 0 ? "TVA à payer" : "Crédit de TVA"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="fallback-vat-rate">Taux par défaut</Label>
                  <Input
                    id="fallback-vat-rate"
                    type="text"
                    inputMode="decimal"
                    value={fallbackVatRateInput}
                    onChange={(event) => setFallbackVatRateInput(event.target.value)}
                    aria-describedby="vat-rate-help"
                  />
                  <p id="vat-rate-help" className="text-xs text-muted-foreground">
                    Factures sans taux renseigné utiliseront {fallbackVatRatePercent}%.
                  </p>
                </div>
                <div className="rounded-md border p-3 text-xs text-muted-foreground">
                  Ajustez ce taux en attendant la synchronisation complète avec vos factures et dépenses réelles.
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-lg font-semibold">Historique des déclarations</h3>
                  <Badge variant="outline">Stockage local temporaire</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Les statuts sont conservés dans le localStorage en attendant la création de la table Supabase « accounting_declarations ».
                </p>
                <div className="rounded-md border">
                  <div className="hidden grid-cols-[1.3fr,1fr,1fr,auto] gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                    <div>Période</div>
                    <div>Échéance</div>
                    <div>Statut</div>
                    <div>Action</div>
                  </div>
                  <div className="divide-y">
                    {sortedDeclarations.map((record) => (
                      <div
                        key={`${record.period}-${record.dueDate}`}
                        className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.3fr,1fr,1fr,auto] md:items-center"
                      >
                        <div>
                          <p className="font-medium">{record.period}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            Échéance le {formatDisplayDate(record.dueDate)}
                          </p>
                        </div>
                        <div className="hidden md:block">
                          {formatDisplayDate(record.dueDate)}
                        </div>
                        <div>
                          <Badge
                            variant={record.status === "submitted" ? "default" : "secondary"}
                            className="mb-1"
                          >
                            {record.status === "submitted" ? "Déposée" : "À soumettre"}
                          </Badge>
                          {record.submittedAt && (
                            <p className="text-xs text-muted-foreground">
                              Déposée le {formatDisplayDate(record.submittedAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">
                          {record.status === "pending" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkSubmitted(record)}
                            >
                              Marquer comme déposée
                            </Button>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DownloadCloud className="h-5 w-5" />
                Exports comptables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Fichier des écritures comptables</p>
                      <p className="text-xs text-muted-foreground">
                        Générer le FEC au format requis par l'administration.
                      </p>
                    </div>
                    <FileSpreadsheet className="hidden h-5 w-5 text-muted-foreground sm:block" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleExport("fec", "csv")}
                      disabled={isExporting("fec", "csv")}
                    >
                      CSV
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleExport("fec", "pdf")}
                      disabled={isExporting("fec", "pdf")}
                    >
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Balance comptable</p>
                      <p className="text-xs text-muted-foreground">
                        Exporter la balance générale pour votre expert-comptable.
                      </p>
                    </div>
                    <NotebookPen className="hidden h-5 w-5 text-muted-foreground sm:block" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleExport("balance", "csv")}
                      disabled={isExporting("balance", "csv")}
                    >
                      CSV
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleExport("balance", "pdf")}
                      disabled={isExporting("balance", "pdf")}
                    >
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Journaux de vente</p>
                      <p className="text-xs text-muted-foreground">
                        Extraire le journal détaillé des écritures de vente.
                      </p>
                    </div>
                    <FileText className="hidden h-5 w-5 text-muted-foreground sm:block" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleExport("journal", "csv")}
                      disabled={isExporting("journal", "csv")}
                    >
                      CSV
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleExport("journal", "pdf")}
                      disabled={isExporting("journal", "pdf")}
                    >
                      PDF
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Les boutons ci-dessus appellent les fonctions Supabase dédiées lorsqu'elles sont disponibles et reviennent sur un export simulé tant que le backend est en cours d'implémentation.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Fonctionnalités comptables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">Module comptabilité en développement</p>
              <div className="text-sm space-y-1">
                <p>• Gestion TVA et déclarations</p>
                <p>• Suivi des paiements et relances</p>
                <p>• Exports comptables pour expert-comptable</p>
                <p>• Journaux de vente et grand livre</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Accounting;
