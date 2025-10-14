import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";

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
import { LeadPhoningDialog } from "@/components/leads/LeadPhoningDialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Upload,
} from "lucide-react";
import { getOrganizationProducts } from "@/features/leads/api";
import { cn } from "@/lib/utils";

const CARD_SKELETON_COUNT = 4;

const SELECT_NONE_VALUE = "__none" as const;

type LeadRecord = Tables<"leads">;
type LeadWithExtras = LeadRecord & { extra_fields?: Record<string, unknown> | null };

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
  nometprenom: "full_name",
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
  phonenumber: "phone_raw",
  phonenumberwithcountrycode: "phone_raw",
  mobilephone: "phone_raw",
  city: "city",
  ville: "city",
  locality: "city",
  cityname: "city",
  postalcode: "postal_code",
  codepostal: "postal_code",
  postal: "postal_code",
  postal_code: "postal_code",
  zipcode: "postal_code",
  zip: "postal_code",
  cp: "postal_code",
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
    case "phoning":
    case "appel":
    case "call":
    case "calling":
      return "Phoning";
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

type FieldParsingContext = {
  firstName?: string;
  lastName?: string;
  comments: string[];
};

const safeParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    try {
      return JSON.parse(value.replace(/""/g, '"'));
    } catch {
      console.warn("Impossible d'analyser le JSON du champ field_data", error);
      return null;
    }
  }
};

const parseSurfaceValue = (value: string) => {
  const normalized = value.replace(/[^0-9,\.]/g, "").replace(/,/g, ".");
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const mergeComments = (current: string | undefined, additions: string[]) => {
  const existing = current
    ? current
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const incoming = additions.map((item) => item.trim()).filter(Boolean);
  if (!incoming.length) {
    return existing.join("\n");
  }
  const merged = Array.from(new Set([...existing, ...incoming]));
  return merged.join("\n");
};

const getFieldEntryValues = (entry: any): string[] => {
  if (Array.isArray(entry?.values)) {
    return entry.values
      .map((value) => {
        if (typeof value === "string") return value;
        if (value && typeof value === "object" && "value" in value) {
          return String((value as { value?: string }).value ?? "");
        }
        return "";
      })
      .filter((item) => item && item.trim().length > 0);
  }
  if (typeof entry?.value === "string") {
    return [entry.value];
  }
  return [];
};

const applyHeuristicAssignment = (
  header: string,
  value: string,
  record: Partial<CsvLead>,
  context: FieldParsingContext
) => {
  const normalized = header;
  const trimmed = value.trim();
  if (!trimmed) return;

  if (normalized.includes("prenom")) {
    context.firstName = context.firstName ?? trimmed;
    return;
  }

  if (
    normalized.includes("nom") &&
    !normalized.includes("campaign") &&
    !normalized.includes("form") &&
    !normalized.includes("ad")
  ) {
    if (!record.full_name) {
      record.full_name = trimmed;
    } else if (!context.lastName) {
      context.lastName = trimmed;
    }
    return;
  }

  if (normalized.includes("email") || normalized.includes("courriel") || normalized.includes("mail")) {
    if (!record.email) {
      record.email = trimmed;
    }
    return;
  }

  if (
    normalized.includes("phone") ||
    normalized.includes("tel") ||
    normalized.includes("mobile") ||
    normalized.includes("telephone")
  ) {
    if (!record.phone_raw) {
      record.phone_raw = trimmed;
    }
    return;
  }

  if (normalized.includes("ville") || normalized.includes("city") || normalized.includes("localite")) {
    if (!record.city) {
      record.city = trimmed;
    }
    return;
  }

  if (
    normalized.includes("codepostal") ||
    normalized.includes("postalcode") ||
    normalized.includes("zipcode") ||
    normalized === "zip" ||
    normalized === "cp"
  ) {
    if (!record.postal_code) {
      record.postal_code = trimmed.replace(/\s+/g, "");
    }
    return;
  }

  if (normalized.includes("surface")) {
    if (record.surface_m2 == null) {
      const parsed = parseSurfaceValue(trimmed);
      if (parsed !== undefined) {
        record.surface_m2 = parsed;
      }
    }
    return;
  }

  if (
    normalized.includes("produit") ||
    normalized.includes("categorie") ||
    normalized.includes("travaux") ||
    normalized.includes("projet") ||
    normalized.includes("installation")
  ) {
    if (!record.product_name) {
      record.product_name = trimmed;
    }
    return;
  }

  if (
    normalized.includes("commentaire") ||
    normalized.includes("message") ||
    normalized.includes("precisions") ||
    normalized.includes("note")
  ) {
    record.commentaire = mergeComments(record.commentaire ?? undefined, [trimmed]);
    return;
  }

  if (normalized.includes("daterdv") || normalized.includes("daterendezvous")) {
    if (!record.date_rdv) {
      record.date_rdv = trimmed;
    }
    return;
  }

  if (
    normalized.includes("heurerdv") ||
    normalized.includes("heurerendezvous") ||
    normalized === "heurerdv" ||
    normalized === "heure"
  ) {
    if (!record.heure_rdv) {
      record.heure_rdv = trimmed;
    }
  }
};

const parseFacebookFieldData = (
  rawValue: string,
  record: Partial<CsvLead>,
  context: FieldParsingContext
) => {
  const parsed = safeParseJson(rawValue);
  if (!Array.isArray(parsed)) return;

  for (const entry of parsed) {
    const name: string =
      typeof entry?.name === "string"
        ? entry.name
        : typeof entry?.key === "string"
        ? entry.key
        : typeof entry?.label === "string"
        ? entry.label
        : "";
    if (!name) continue;

    const normalized = normalizeHeader(name);
    const values = getFieldEntryValues(entry);
    if (!values.length) continue;

    const value = values.join(", ").trim();
    if (!value) continue;

    if (normalized === "fullname" || normalized === "nometprenom") {
      if (!record.full_name) {
        record.full_name = value;
      }
      continue;
    }

    if (normalized === "firstname" || normalized.includes("prenom")) {
      context.firstName = context.firstName ?? value;
      continue;
    }

    if (normalized === "lastname" || normalized === "nom" || normalized.endsWith("nom")) {
      context.lastName = context.lastName ?? value;
      continue;
    }

    if (normalized.includes("email") || normalized.includes("courriel") || normalized.includes("mail")) {
      if (!record.email) {
        record.email = value;
      }
      continue;
    }

    if (
      normalized.includes("phone") ||
      normalized.includes("tel") ||
      normalized.includes("mobile") ||
      normalized.includes("telephone")
    ) {
      if (!record.phone_raw) {
        record.phone_raw = value;
      }
      continue;
    }

    if (normalized.includes("ville") || normalized.includes("city") || normalized.includes("localite")) {
      if (!record.city) {
        record.city = value;
      }
      continue;
    }

    if (
      normalized.includes("codepostal") ||
      normalized.includes("postalcode") ||
      normalized.includes("zipcode") ||
      normalized === "zip" ||
      normalized === "cp"
    ) {
      if (!record.postal_code) {
        record.postal_code = value.replace(/\s+/g, "");
      }
      continue;
    }

    if (
      normalized.includes("produit") ||
      normalized.includes("categorie") ||
      normalized.includes("travaux") ||
      normalized.includes("projet") ||
      normalized.includes("installation")
    ) {
      if (!record.product_name) {
        record.product_name = value;
      }
      continue;
    }

    if (normalized.includes("surface")) {
      if (record.surface_m2 == null) {
        const parsedSurface = parseSurfaceValue(value);
        if (parsedSurface !== undefined) {
          record.surface_m2 = parsedSurface;
        }
      }
      continue;
    }

    if (
      normalized.includes("commentaire") ||
      normalized.includes("message") ||
      normalized.includes("precisions") ||
      normalized.includes("note")
    ) {
      context.comments.push(value);
      continue;
    }

    if (normalized.includes("daterdv") || normalized.includes("daterendezvous")) {
      if (!record.date_rdv) {
        record.date_rdv = value;
      }
      continue;
    }

    if (
      normalized.includes("heurerdv") ||
      normalized.includes("heurerendezvous") ||
      normalized === "heurerdv" ||
      normalized === "heure"
    ) {
      if (!record.heure_rdv) {
        record.heure_rdv = value;
      }
    }
  }

  if (context.comments.length) {
    record.commentaire = mergeComments(record.commentaire ?? undefined, context.comments);
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
    const context: FieldParsingContext = { comments: [] };
    let fieldDataRaw: string | null = null;
    let platformValue: string | null = null;
    let campaignName: string | null = null;
    let formName: string | null = null;

    headers.forEach((header, index) => {
      const rawValue = values[index]?.trim() ?? "";
      if (!rawValue) return;

      switch (header) {
        case "fielddata": {
          fieldDataRaw = rawValue;
          return;
        }
        case "firstname": {
          context.firstName = context.firstName ?? rawValue;
          return;
        }
        case "lastname": {
          context.lastName = context.lastName ?? rawValue;
          return;
        }
        case "platform": {
          platformValue = rawValue;
          return;
        }
        case "campaignname": {
          campaignName = rawValue;
          if (!record.utm_source) {
            record.utm_source = rawValue;
          }
          return;
        }
        case "adname": {
          if (!record.utm_source) {
            record.utm_source = rawValue;
          }
          return;
        }
        case "formname": {
          formName = rawValue;
          if (!record.product_name) {
            record.product_name = rawValue;
          }
          return;
        }
        default: {
          break;
        }
      }

      const key = HEADER_MAPPINGS[header];
      if (key) {
        switch (key) {
          case "surface_m2": {
            // FIX: comma to dot for decimal
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
            (record as any)[key] = rawValue;
            break;
          }
          default: {
            (record as any)[key] = rawValue;
          }
        }
        return;
      }

      applyHeuristicAssignment(header, rawValue, record, context);
    });

    if (fieldDataRaw) {
      parseFacebookFieldData(fieldDataRaw, record, context);
    }

    if (!record.full_name) {
      const combined = [context.firstName, context.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (combined) {
        record.full_name = combined;
      }
    }

    if (!record.utm_source) {
      if (campaignName) {
        record.utm_source = campaignName;
      } else if (platformValue) {
        record.utm_source = platformValue;
      }
    }

    if (
      platformValue &&
      platformValue.toLowerCase().includes("facebook") &&
      record.utm_source &&
      /^facebook$/i.test(record.utm_source.trim())
    ) {
      record.utm_source = "Facebook Ads";
    }

    if (formName && !record.product_name) {
      record.product_name = formName;
    }

    if (record.postal_code) {
      record.postal_code = record.postal_code.replace(/\s+/g, "");
    }

    if (record.commentaire) {
      record.commentaire = record.commentaire.trim();
    }

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
  const [isCsvDragActive, setIsCsvDragActive] = useState(false);
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

  const [isImportDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportProductId, setSelectedImportProductId] = useState<string | null>(null);

  const { data: productOptions = [], isLoading: productsLoading } = useQuery({
    queryKey: ["lead-import-products", orgId],
    enabled: Boolean(orgId),
    queryFn: () => getOrganizationProducts(orgId!),
    staleTime: 5 * 60 * 1000,
  });

  const selectedImportProduct = useMemo(() => {
    if (!selectedImportProductId) return null;
    return productOptions.find((product) => product.id === selectedImportProductId) ?? null;
  }, [productOptions, selectedImportProductId]);

  const bulkProductLabel = selectedImportProduct?.label ?? null;

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
        lead.siren ?? "",
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
    setImportDialogOpen(true);
  };

  const runCsvImport = async (file: File, input?: HTMLInputElement | null) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Connectez-vous pour importer des leads",
        variant: "destructive",
      });
      if (input) {
        input.value = "";
      }
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Format invalide",
        description: "Seuls les fichiers CSV sont acceptés",
        variant: "destructive",
      });
      if (input) {
        input.value = "";
      }
      return;
    }

    const defaultProductName = bulkProductLabel?.trim() ? bulkProductLabel.trim() : null;

    setImportDialogOpen(false);
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

      const payload = rows.map((row) => {
        const rowProductName =
          row.product_name && row.product_name.trim().length > 0 ? row.product_name.trim() : null;

        return {
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
          product_name: rowProductName ?? defaultProductName,
          surface_m2: row.surface_m2 ?? null,
          utm_source: row.utm_source ?? null,
          commentaire: row.commentaire ?? null,
          date_rdv: row.date_rdv ?? null,
          heure_rdv: row.heure_rdv ?? null,
          extra_fields: {},
          siren: null,
        };
      });

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
      if (input) {
        input.value = "";
      }
      setImporting(false);
    }
  };

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await runCsvImport(file, event.target);
  };

  const handleCsvDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (importing) return;
    setIsCsvDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (fileInputRef.current && typeof DataTransfer !== "undefined") {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
    }

    await runCsvImport(file, fileInputRef.current);
  };

  const handleLeadAdded = async () => {
    await refetch();
  };

  const handlePhoningCompleted = async () => {
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
      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          if (importing && open) return;
          setImportDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Importer des leads CSV</DialogTitle>
            <DialogDescription>
              Importez un export Facebook Lead Ads ou un fichier CSV compatible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Compatibilité Facebook</AlertTitle>
              <AlertDescription>
                Les champs essentiels (nom, email, téléphone, ville, code postal) sont détectés
                automatiquement, y compris depuis la colonne <span className="font-medium">field_data</span>.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="import-product">Catégorie de produit</Label>
              <Select
                value={selectedImportProductId ?? SELECT_NONE_VALUE}
                onValueChange={(value) => {
                  if (value === SELECT_NONE_VALUE) {
                    setSelectedImportProductId(null);
                  } else if (value !== "__loading" && value !== "__empty") {
                    setSelectedImportProductId(value);
                  }
                }}
                disabled={productsLoading}
              >
                <SelectTrigger id="import-product">
                  <SelectValue placeholder="Sélectionner une catégorie (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>Aucune catégorie</SelectItem>
                  {productsLoading ? (
                    <SelectItem value="__loading" disabled>
                      Chargement...
                    </SelectItem>
                  ) : productOptions.length > 0 ? (
                    productOptions.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      Aucun produit actif
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedImportProduct
                  ? `Le produit ${selectedImportProduct.label} sera appliqué aux leads sans produit.`
                  : "Laissez vide pour conserver le produit présent dans chaque ligne du CSV."}
              </p>
            </div>
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors",
                importing
                  ? "cursor-not-allowed border-muted-foreground/30 bg-muted/30 text-muted-foreground"
                  : "cursor-pointer border-muted-foreground/40 hover:border-primary hover:bg-primary/5",
                isCsvDragActive && !importing ? "border-primary bg-primary/5" : null
              )}
              role="button"
              tabIndex={importing ? -1 : 0}
              aria-disabled={importing}
              onClick={() => {
                if (importing) return;
                fileInputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (importing) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (importing) return;
                setIsCsvDragActive(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                if (importing) return;
                setIsCsvDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsCsvDragActive(false);
              }}
              onDrop={handleCsvDrop}
            >
              <Upload className="h-6 w-6 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Glissez-déposez votre fichier CSV</p>
                <p className="text-xs text-muted-foreground">
                  Encodage UTF-8 recommandé • séparateur virgule ou point-virgule détecté automatiquement
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Vous pouvez aussi cliquer ou utiliser le bouton ci-dessous pour sélectionner un fichier.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(false)}
                disabled={importing}
              >
                Annuler
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileX className="w-4 h-4 mr-2" />
                )}
                {importing ? "Import en cours" : "Sélectionner un fichier CSV"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
                  placeholder="Rechercher par nom, email, téléphone, SIREN..."
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

        {/* Leads Table / Cards */}
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
                          {lead.siren && (
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              SIREN : {lead.siren}
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
                      <div className="flex flex-wrap gap-2 justify-end">
                        <LeadPhoningDialog lead={lead as LeadWithExtras} onCompleted={handlePhoningCompleted} />
                        <ScheduleLeadDialog lead={lead as LeadWithExtras} onScheduled={handleLeadScheduled} />
                        <AddProjectDialog
                          trigger={<Button size="sm">Créer Projet</Button>}
                          initialValues={{
                            client_name: lead.full_name,
                            company: lead.company ?? "",
                            siren: lead.siren ?? "",
                            city: lead.city,
                            postal_code: lead.postal_code,
                            surface_batiment_m2: lead.surface_m2 ?? undefined,
                                lead_id: lead.id,
                              }}
                              onProjectAdded={() => handleProjectCreated(lead as LeadWithExtras)}
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
                          {lead.siren && (
                            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                              SIREN : {lead.siren}
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
                            <div className="flex flex-wrap gap-2 justify-end">
                              <LeadPhoningDialog lead={lead as LeadWithExtras} onCompleted={handlePhoningCompleted} />
                              <ScheduleLeadDialog lead={lead as LeadWithExtras} onScheduled={handleLeadScheduled} />
                              <AddProjectDialog
                                trigger={<Button size="sm">Créer Projet</Button>}
                                initialValues={{
                                  client_name: lead.full_name,
                                  company: lead.company ?? "",
                                  siren: lead.siren ?? "",
                                  city: lead.city,
                                  postal_code: lead.postal_code,
                                  surface_batiment_m2: lead.surface_m2 ?? undefined,
                                  lead_id: lead.id,
                                }}
                                onProjectAdded={() => handleProjectCreated(lead as LeadWithExtras)}
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
