import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  Mail,
  FileCheck,
  AlarmClock,
  Euro,
  Eye,
  Send,
} from "lucide-react";

interface Invoice {
  id: string;
  reference: string;
  client: string;
  project?: string;
  amount: number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  dueDate: string;
  issueDate: string;
  facturx: boolean;
  paymentMethod?: string;
}

const mockInvoices: Invoice[] = [
  {
    id: "f1",
    reference: "FAC-2024-0098",
    client: "Sophie Bernard",
    project: "Isolation Façade",
    amount: 18500,
    status: "PAID",
    dueDate: "2024-03-15",
    issueDate: "2024-03-01",
    facturx: true,
    paymentMethod: "Virement SEPA",
  },
  {
    id: "f2",
    reference: "FAC-2024-0099",
    client: "Jean Martin",
    project: "Pompe à chaleur",
    amount: 14200,
    status: "SENT",
    dueDate: "2024-03-30",
    issueDate: "2024-03-05",
    facturx: true,
  },
  {
    id: "f3",
    reference: "FAC-2024-0100",
    client: "Marie Dupont",
    project: "Isolation combles",
    amount: 6200,
    status: "DRAFT",
    dueDate: "2024-04-05",
    issueDate: "2024-03-12",
    facturx: false,
  },
  {
    id: "f4",
    reference: "FAC-2024-0101",
    client: "SARL Les Halles",
    project: "Rénovation éclairage",
    amount: 9800,
    status: "OVERDUE",
    dueDate: "2024-03-10",
    issueDate: "2024-02-25",
    facturx: true,
  },
];

const statusMeta: Record<Invoice["status"], { label: string; className: string }> = {
  DRAFT: {
    label: "Brouillon",
    className: "bg-gray-500/10 text-gray-700 border-gray-200",
  },
  SENT: {
    label: "Envoyée",
    className: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  PAID: {
    label: "Payée",
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  OVERDUE: {
    label: "En retard",
    className: "bg-red-500/10 text-red-700 border-red-200",
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const getTotals = () => {
  const totalBilled = mockInvoices.reduce((acc, invoice) => acc + invoice.amount, 0);
  const totalPaid = mockInvoices
    .filter((invoice) => invoice.status === "PAID")
    .reduce((acc, invoice) => acc + invoice.amount, 0);
  const totalOverdue = mockInvoices
    .filter((invoice) => invoice.status === "OVERDUE")
    .reduce((acc, invoice) => acc + invoice.amount, 0);

  return { totalBilled, totalPaid, totalOverdue };
};

const Invoices = () => {
  const { totalBilled, totalPaid, totalOverdue } = getTotals();
  const collectionRate = Math.round((totalPaid / totalBilled) * 100);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Factures
            </h1>
            <p className="text-muted-foreground mt-1">
              Pilotage des encaissements et conformité Factur-X 2026
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exporter Factur-X
            </Button>
            <Button variant="outline">
              <Send className="w-4 h-4 mr-2" />
              Relance email
            </Button>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Nouvelle Facture
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="shadow-card border-0 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total facturé</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalBilled)}</p>
              <p className="text-xs text-muted-foreground">Montant cumulé toutes factures</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total encaissé</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Taux d'encaissement</span>
                  <span>{collectionRate}%</span>
                </div>
                <Progress value={collectionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Montant en retard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
              <p className="text-xs text-muted-foreground">Relances prioritaires à effectuer</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Factures Factur-X</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {mockInvoices.filter((invoice) => invoice.facturx).length}/{mockInvoices.length}
              </p>
              <p className="text-xs text-muted-foreground">Prêtes pour l'obligation 2026</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher par client, référence ou chantier" className="pl-10" />
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
              <CardTitle>Liste des factures ({mockInvoices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Projet</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{invoice.reference}</span>
                          <span className="text-xs text-muted-foreground">Émise le {invoice.issueDate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{invoice.client}</span>
                          {invoice.paymentMethod && (
                            <span className="text-xs text-muted-foreground">{invoice.paymentMethod}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Euro className="w-4 h-4 text-muted-foreground" />
                          <span>{invoice.project ?? "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <AlarmClock className="w-4 h-4 text-muted-foreground" />
                          <span>{invoice.dueDate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={statusMeta[invoice.status].className}>
                            {statusMeta[invoice.status].label}
                          </Badge>
                          {invoice.facturx && (
                            <Badge variant="outline" className="w-fit bg-blue-500/10 text-blue-700 border-blue-200">
                              Factur-X
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Mail className="w-4 h-4" />
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
              <CardTitle>Relances & conformité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <AlarmClock className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="font-medium">Factures à relancer</p>
                  <p className="text-sm text-muted-foreground">
                    {mockInvoices.filter((invoice) => invoice.status === "OVERDUE").length} factures dépassent l'échéance
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <FileCheck className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <p className="font-medium">Factur-X généré</p>
                  <p className="text-sm text-muted-foreground">
                    {mockInvoices.filter((invoice) => invoice.facturx).length} factures prêtes au format hybride XML/PDF
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border bg-background/60">
                <Mail className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <p className="font-medium">Envoyer par email</p>
                  <p className="text-sm text-muted-foreground">
                    Synchronisation SMTP OVH pour l'envoi direct aux clients
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

export default Invoices;
