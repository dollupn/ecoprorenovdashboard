import { useMemo, useRef, useState, type ChangeEvent } from "react";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadFormDialog } from "@/features/leads/LeadFormDialog";
import { ScheduleLeadDialog } from "@/components/leads/ScheduleLeadDialog";
import { AddProjectDialog } from "@/components/projects/AddProjectDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLeadsList, useUpdateLead } from "@/features/leads/api";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getLeadStatusColor,
  getLeadStatusLabel,
  isLeadStatus,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/components/leads/status";
import {
  Search,
  Filter,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building,
  FileX,
  AlertCircle,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react";

const CARD_SKELETON_COUNT = 4;

type LeadRecord = Tables<"leads">;

type CsvLead = {
  full_name: string;
  email: string;
  phone_raw: string;
  city: string;
  postal_code: string;
  company?: string;
  product_name?: string;
  surface_m2?: number;
  utm_source?: string;
  status?: LeadStatus;
  commentaire?: string;
  date_rdv?: string;
  heure_rdv?: string;
};

type CsvParseResult = {
  rows: CsvLead[];
  skipped: number;
};

const detectDelimiter = (line: string) => {
  const commaCount = (line.match(/,/g) ?? []).length;
  const semicolonCount = (line.match(/;/g) ?? []).length;
  if (semicolonCount > commaCount) return ";";
  if (commaCount > 0) return ",";
  return ";";
};

const parseCsvLine = (line: string, delimiter: string) => {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === "\"") {
      if (insideQuotes && nextChar === "\"") {
        current += "\"";
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result.map((value) => value.replace(/^"|"$/g, "").trim());
};

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_MAPPINGS: Record<string, keyof CsvLead> = {
  fullname: "full_name",
  nom: "full_name",
  name: "full_name",
  client: "full_name",
  email: "email",
  courriel: "email",
  mail: "email",
  phone: "phone_raw",
  telephone: "phone_raw",
  tel: "phone_raw",
  phoneraw: "phone_raw",
  city: "city",
  ville: "city",
  locality: "city",
  postalcode: "postal_code",
  codepostal: "postal_code",
  postal: "postal_code",
  postal_code: "postal_code",
  company: "company",
  entreprise: "company",
  societe: "company",
  product: "product_name",
  produit: "product_name",
  productname: "product_name",
  producttype: "product_name",
  product_type: "product_name",
  surface: "surface_m2",
  surfacehabitable: "surface_m2",
  surfacem2: "surface_m2",
  surface_m2: "surface_m2",
  utm: "utm_source",
  utmsource: "utm_source",
  source: "utm_source",
  status: "status",
  statut: "status",
  commentaire: "commentaire",
  comments: "commentaire",
  note: "commentaire",
  daterdv: "date_rdv",
  date: "date_rdv",
  heure: "heure_rdv",
  heurerdv: "heure_rdv",
};

const normalizeCsvStatus = (value: string): LeadStatus | undefined => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");

  switch (cleaned) {
    case "non eligible":
    case "noneligible":
    case "not eligible":
      return "Non éligible";
    case "a rappeler":
    case "rappeler":
    case "call back":
    case "callback":
      return "À rappeler";
    case "a recontacter":
    case "recontacter":
    case "follow up":
    case "followup":
      return "À recontacter";
    case "programmer pre visite":
    case "programmer previsite":
    case "pre visite":
    case "previsite":
      return "Programmer pré-visite";
    case "eligible":
    case "converti":
    case "converted":
      return "Éligible";
    default:
      return undefined;
  }
};

const parseCsv = (text: string): CsvParseResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], skipped: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);

  const rows: CsvLead[] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line, delimiter);
    if (values.every((value) => value.trim().length === 0)) {
      continue;
    }

    const record: Partial<CsvLead> = {};

    headers.forEach((header, index) => {
      const key = HEADER_MAPPINGS[header];
      if (!key) return;

      const rawValue = values[index]?.trim() ?? "";
      if (!rawValue) return;

      switch (key) {
        case "surface_m2": {
          const parsed = Number.parseFloat(rawValue.replace(/,/, "."));
          if (!Number.isNaN(parsed)) {
            record.surface_m2 = parsed;
          }
          break;
        }
        case "status": {
          const normalized = normalizeCsvStatus(rawValue);
          if (normalized) {
            record.status = normalized;
          }
          break;
        }
        case "date_rdv":
        case "heure_rdv":
        case "utm_source":
        case "company":
        case "product_name":
        case "commentaire": {
          // Preserve raw text
          record[key] = rawValue;
          break;
        }
        default: {
          record[key] = rawValue;
        }
      }
    });


    if (
      record.full_name &&
      record.email &&
      record.phone_raw &&
      record.city &&
      record.postal_code
    ) {
      rows.push(record as CsvLead);
    } else {
      skipped += 1;
    }
  }

  return { rows, skipped };
};

const formatInitials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const initials = parts.slice(0, 2).map((part) => part[0] ?? "").join("");
  return initials.toUpperCase();
};

const Leads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([]);
  const [importing, setImporting] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const orgId = user?.id ?? null;

  const {
    data: leads = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useLeadsList(
    orgId,
    selectedStatuses.length
      ? {
          statuses: selectedStatuses,
        }
      : undefined,
    searchTerm
  );

  const updateLeadMutation = useUpdateLead(orgId);

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus =
        selectedStatuses.length === 0 ||
        (isLeadStatus(lead.status) && selectedStatuses.includes(lead.status as LeadStatus));

      if (!matchesStatus) return false;

      if (!normalizedSearch) return true;

      const searchable = [
        lead.full_name,
        lead.email,
        lead.phone_raw,
        lead.city,
        lead.postal_code,
        lead.product_name ?? "",
        lead.utm_source ?? "",
        lead.company ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [leads, searchTerm, selectedStatuses]);

  const hasActiveFilters = Boolean(searchTerm.trim()) || selectedStatuses.length > 0;

  const handleStatusFilterChange = (status: LeadStatus, checked: boolean | "indeterminate") => {
    setSelectedStatuses((prev) => {
      if (checked === true) {
        if (prev.includes(status)) return prev;
        return [...prev, status];
      }
      return prev.filter((item) => item !== status);
    });
  };

  const handleImportClick = () => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Connectez-vous pour importer des leads",
        variant: "destructive",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Connectez-vous pour importer des leads",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const { rows, skipped } = parseCsv(text);

      if (rows.length === 0) {
        toast({
          title: "Import invalide",
          description: "Aucun lead valide n'a été détecté dans le fichier.",
          variant: "destructive",
        });
        return;
      }

      const payload = rows.map((row) => ({
        user_id: user.id,
        org_id: user.id,
        created_by: user.id,
        assigned_to: user.id,
        full_name: row.full_name,
        email: row.email,
        phone_raw: row.phone_raw,
        city: row.city,
        postal_code: row.postal_code,
        status: row.status ?? "À rappeler",
        company: row.company ?? null,
        product_name: row.product_name ?? null,
        surface_m2: row.surface_m2 ?? null,
        utm_source: row.utm_source ?? null,
        commentaire: row.commentaire ?? null,
        date_rdv: row.date_rdv ?? null,
        heure_rdv: row.heure_rdv ?? null,
        extra_fields: {},
      }));

      const { error: insertError } = await supabase.from("leads").insert(payload);
      if (insertError) throw insertError;

      toast({
        title: "Import terminé",
        description: `${rows.length} lead${rows.length > 1 ? "s" : ""} importé${
          rows.length > 1 ? "s" : ""
        }${
          skipped
            ? ` • ${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""}`
            : ""
        }`,
      });

      await refetch();
    } catch (error) {
      console.error("Erreur lors de l'import CSV", error);
      const message = error instanceof Error ? error.message : "Vérifiez le format du fichier puis réessayez.";
      toast({
        title: "Erreur lors de l'import",
        description: message,
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
      setImporting(false);
    }
  };

  const handleLeadAdded = async () => {
    await refetch();
  };

  const handleLeadScheduled = async () => {
    await refetch();
  };

  const handleProjectCreated = async (lead: LeadRecord) => {
    try {
      if (lead.status !== "Éligible") {
        await updateLeadMutation.mutateAsync({
          id: lead.id,
          values: { status: "Éligible", updated_at: new Date().toISOString() },
        });

        toast({
          title: "Lead éligible",
          description: `${lead.full_name} est maintenant marqué comme éligible.`,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du lead", error);
      const message = error instanceof Error ? error.message : "Réessayez plus tard.";
      toast({
        title: "Impossible de mettre à jour le lead",
        description: message,
        variant: "destructive",
      });
    } finally {
      await refetch();
    }
  };

  return (
    <Layout>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleCsvImport}
        className="hidden"
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Leads
            </h1>
            <p className="text-muted-foreground mt-1">
              Prospection et qualification des demandes entrantes synchronisées avec Supabase
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImportClick} disabled={importing}>
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileX className="w-4 h-4 mr-2" />
              )}
              {importing ? "Import en cours" : "Importer CSV"}
            </Button>
            <LeadFormDialog onCreated={handleLeadAdded} />
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email, téléphone..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    {selectedStatuses.length > 0
                      ? `Filtres (${selectedStatuses.length})`
                      : "Filtres"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Filtrer par statut</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {LEAD_STATUSES.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={(checked) => handleStatusFilterChange(status, checked)}
                    >
                      {getLeadStatusLabel(status)}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedStatuses([])}>
                    Réinitialiser les filtres
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Impossible de charger les leads</AlertTitle>
            <AlertDescription>
              {error?.message ?? "Vérifiez votre connexion Supabase puis réessayez."}
            </AlertDescription>
            <div className="mt-4">
              <Button variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          </Alert>
        )}

        {/* Leads Table */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Leads Récents ({filteredLeads.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? `${leads.length} leads au total` : "Données à jour depuis Supabase"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 md:justify-end">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as "cards" | "table")}
                className="border rounded-md"
              >
                <ToggleGroupItem value="cards" className="px-3 py-1" aria-label="Vue cartes">
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Cartes
                </ToggleGroupItem>
                <ToggleGroupItem value="table" className="px-3 py-1" aria-label="Vue tableau">
                  <List className="mr-2 h-4 w-4" />
                  Tableau
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: CARD_SKELETON_COUNT }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 rounded-lg border bg-muted/20 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {hasActiveFilters
                  ? "Aucun lead ne correspond aux filtres sélectionnés."
                  : "Aucun lead pour le moment. Ajoutez-en un nouveau ou importez un fichier CSV."}
              </div>
            ) : viewMode === "cards" ? (
              <div className="space-y-4">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="font-semibold text-primary">
                            {formatInitials(lead.full_name)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {lead.full_name}
                          </h3>
                          {lead.company && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {lead.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={getLeadStatusColor(lead.status)}>
                        {getLeadStatusLabel(lead.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {lead.phone_raw}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {lead.email}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {lead.city} ({lead.postal_code})
                        </div>
                        {lead.product_name && (
                          <div className="text-sm">
                            <span className="font-medium">{lead.product_name}</span>
                            {lead.surface_m2 && (
                              <span className="text-muted-foreground"> • {lead.surface_m2} m²</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {lead.date_rdv && lead.heure_rdv && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-primary font-medium">
                              {new Date(lead.date_rdv).toLocaleDateString("fr-FR")} à {lead.heure_rdv}
                            </span>
                          </div>
                        )}
                        {lead.utm_source && (
                          <div className="text-sm text-muted-foreground">
                            Source: {lead.utm_source}
                          </div>
                        )}
                      </div>
                    </div>

                    {lead.commentaire && (
                      <div className="mb-3 p-3 bg-muted/50 rounded text-sm">
                        {lead.commentaire}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        Créé le {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                      </span>
                      <div className="flex gap-2">
                        <ScheduleLeadDialog lead={lead} onScheduled={handleLeadScheduled} />
                        <AddProjectDialog
                          trigger={<Button size="sm">Créer Projet</Button>}
                          initialValues={{
                            client_name: lead.full_name,
                            company: lead.company ?? "",
                            city: lead.city,
                            postal_code: lead.postal_code,
                            surface_isolee_m2: lead.surface_m2 ?? undefined,
                            lead_id: lead.id,
                          }}
                          onProjectAdded={() => handleProjectCreated(lead)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>RDV</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Commentaire</TableHead>
                      <TableHead className="text-right">Créé / Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <div className="font-semibold text-foreground">{lead.full_name}</div>
                          {lead.company && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {lead.company}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {lead.phone_raw}
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {lead.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {lead.city} ({lead.postal_code})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.product_name ? (
                            <div>
                              <span className="font-medium">{lead.product_name}</span>
                              {lead.surface_m2 && (
                                <span className="text-muted-foreground"> • {lead.surface_m2} m²</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getLeadStatusColor(lead.status)}>
                            {getLeadStatusLabel(lead.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.date_rdv && lead.heure_rdv ? (
                            <div className="flex items-center gap-2 text-primary font-medium">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {new Date(lead.date_rdv).toLocaleDateString("fr-FR")} à {lead.heure_rdv}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.utm_source ? lead.utm_source : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          {lead.commentaire ? (
                            <span className="line-clamp-2">{lead.commentaire}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-muted-foreground">
                              Créé le {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                            </span>
                            <div className="flex gap-2">
                              <ScheduleLeadDialog lead={lead} onScheduled={handleLeadScheduled} />
                        <AddProjectDialog
                          trigger={<Button size="sm">Créer Projet</Button>}
                          initialValues={{
                            client_name: lead.full_name,
                            company: lead.company ?? "",
                            city: lead.city,
                            postal_code: lead.postal_code,
                            surface_isolee_m2: lead.surface_m2 ?? undefined,
                            lead_id: lead.id,
                          }}
                                onProjectAdded={() => handleProjectCreated(lead)}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Leads;
