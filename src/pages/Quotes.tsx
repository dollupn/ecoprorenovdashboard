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
} from "lucide-react";

interface Quote {
  id: string;
  reference: string;
  client: string;
  project?: string;
  product: string;
  amount: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  validityDate: string;
  createdAt: string;
  ceeEligible: boolean;
  notes?: string;
}

const mockQuotes: Quote[] = [
  {
    id: "q1",
    reference: "DEV-2024-0152",
    client: "Sophie Bernard",
    project: "Isolation Façade",
    product: "Isolation Thermique Extérieure",
    amount: 18500,
    status: "ACCEPTED",
    validityDate: "2024-04-05",
    createdAt: "2024-03-01",
    ceeEligible: true,
    notes: "Prime CEE estimée à 5 200€"
  },
  {
    id: "q2",
    reference: "DEV-2024-0153",
    client: "Jean Martin",
    project: "Pompe à chaleur",
    product: "Pompe à chaleur air/eau",
    amount: 14200,
    status: "SENT",
    validityDate: "2024-03-28",
    createdAt: "2024-03-05",
    ceeEligible: true,
  },
  {
    id: "q3",
    reference: "DEV-2024-0154",
    client: "Marie Dupont",
    project: "Isolation combles",
    product: "Isolation combles perdus",
    amount: 6200,
    status: "DRAFT",
    validityDate: "2024-04-12",
    createdAt: "2024-03-10",
    ceeEligible: false,
  },
  {
    id: "q4",
    reference: "DEV-2024-0155",
    client: "SARL Les Halles",
    project: "Rénovation éclairage",
    product: "LED Haute performance",
    amount: 9800,
    status: "REJECTED",
    validityDate: "2024-03-15",
    createdAt: "2024-02-28",
    ceeEligible: false,
    notes: "Budget non validé par le client"
  }
];

const statusMeta: Record<Quote["status"], { label: string; className: string }> = {
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
};

const getConversionRate = () => {
  const accepted = mockQuotes.filter((quote) => quote.status === "ACCEPTED").length;
  return Math.round((accepted / mockQuotes.length) * 100);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const Quotes = () => {
  const totals = {
    draft: mockQuotes.filter((quote) => quote.status === "DRAFT").length,
    sent: mockQuotes.filter((quote) => quote.status === "SENT").length,
    accepted: mockQuotes.filter((quote) => quote.status === "ACCEPTED").length,
    rejected: mockQuotes.filter((quote) => quote.status === "REJECTED").length,
    cee: mockQuotes.filter((quote) => quote.ceeEligible).length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Devis
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi complet des propositions commerciales et conformité Factur-X
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
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Nouveau Devis
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="shadow-card border-0 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Devis en brouillon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{totals.draft}</p>
              <p className="text-xs text-muted-foreground">À finaliser avant envoi</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Devis envoyés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{totals.sent}</p>
              <p className="text-xs text-muted-foreground">En attente de réponse</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Devis acceptés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{totals.accepted}</p>
              <p className="text-xs text-muted-foreground">Taux de conversion {getConversionRate()}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Eligibles CEE</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-500">{totals.cee}</p>
              <p className="text-xs text-muted-foreground">Suivi des primes en cours</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher par client, référence ou solution" className="pl-10" />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres avancés
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="shadow-card bg-gradient-card border-0 xl:col-span-2">
            <CardHeader>
              <CardTitle>Liste des devis ({mockQuotes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Solution</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{quote.reference}</span>
                          <span className="text-xs text-muted-foreground">Créé le {quote.createdAt}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{quote.client}</span>
                          {quote.project && (
                            <span className="text-xs text-muted-foreground">{quote.project}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{quote.product}</span>
                          {quote.ceeEligible && (
                            <Badge variant="outline" className="w-fit bg-emerald-500/10 text-emerald-700 border-emerald-200">
                              CEE
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(quote.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <span>{quote.validityDate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta[quote.status].className}>
                          {statusMeta[quote.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader>
              <CardTitle>Prochaines actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <Send className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <p className="font-medium">Relancer les devis envoyés</p>
                  <p className="text-sm text-muted-foreground">
                    {totals.sent} devis en attente de réponse depuis plus de 7 jours
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <p className="font-medium">Convertir en facture</p>
                  <p className="text-sm text-muted-foreground">
                    {totals.accepted} devis acceptés prêts à être transformés en facture
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <Timer className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="font-medium">Expiration prochaine</p>
                  <p className="text-sm text-muted-foreground">
                    Vérifier les conditions commerciales avant la date limite
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Quotes;
