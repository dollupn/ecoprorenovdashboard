import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, subDays } from "date-fns";
import { fr } from "date-fns/locale";

import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";

import {
  Activity,
  BadgeCheck,
  FileText,
  FolderKanban,
  Hammer,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Search,
  Users,
  Wallet,
} from "lucide-react";

const ACTIVE_PROJECT_STATUSES = new Set(["ACCEPTED", "IN_PROGRESS", "DONE"]);
const ACTIVE_SITE_STATUSES = new Set(["PLANIFIE", "EN_COURS", "CONTROLE", "CLOTURE"]);
const POSITIVE_QUOTE_STATUSES = new Set(["SENT", "ACCEPTED"]);
const PAID_INVOICE_STATUSES = new Set(["PAID"]);
const OUTSTANDING_INVOICE_STATUSES = new Set(["SENT", "OVERDUE"]);

const DAYS_FOR_RECENT_REVENUE = 30;

type LeadRecord = Tables<"leads">;
type ProjectRecord = Tables<"projects">;
type QuoteRecord = Tables<"quotes">;
type SiteRecord = Tables<"sites">;
type InvoiceRecord = Tables<"invoices">;

type ClientStage = "prospect" | "lead" | "quote" | "project" | "client";
type StageFilter = ClientStage | "all";

type ActivityType = "lead" | "quote" | "project" | "site" | "invoice";

interface ClientAggregate {
  key: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  postalCode: string | null;
  leads: LeadRecord[];
  quotes: QuoteRecord[];
  projects: ProjectRecord[];
  sites: SiteRecord[];
  invoices: InvoiceRecord[];
  lastActivity: string | null;
  lastActivityTimestamp: number | null;
  utmSources: Set<string>;
  rawStatuses: Set<string>;
}

interface ClientOverview {
  key: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  postalCode: string | null;
  stage: ClientStage;
  leadsCount: number;
  quotesCount: number;
  projectsCount: number;
  sitesCount: number;
  invoicesCount: number;
  paidRevenue: number;
  outstandingInvoices: number;
  openQuotesValue: number;
  lastActivity: string | null;
  lastActivityTimestamp: number | null;
  statusLabels: string[];
  utmSources: string[];
  recentPaidRevenue: number;
  latestLead: { status: string | null; date: string | null } | null;
  latestQuote: { status: string | null; date: string | null; amount: number | null } | null;
  latestProject: { status: string | null; date: string | null } | null;
  latestSite: { status: string | null; date: string | null } | null;
  latestInvoice: { status: string | null; date: string | null; amount: number | null } | null;
}

interface ActivityItem {
  id: string;
  type: ActivityType;
  client: string;
  description: string;
  date: string | null;
}

const stageConfig: Record<ClientStage, { label: string; className: string }> = {
  client: {
    label: "Client",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  },
  project: {
    label: "Projet",
    className: "bg-sky-500/10 text-sky-600 border-sky-200",
  },
  quote: {
    label: "Devis",
    className: "bg-amber-500/10 text-amber-600 border-amber-200",
  },
  lead: {
    label: "Lead",
    className: "bg-purple-500/10 text-purple-600 border-purple-200",
  },
  prospect: {
    label: "Prospect",
    className: "bg-slate-500/10 text-slate-600 border-slate-200",
  },
};

const activityIcons: Record<ActivityType, JSX.Element> = {
  lead: (
    <div className="rounded-md bg-purple-500/10 text-purple-600 p-2">
      <Users className="h-4 w-4" />
    </div>
  ),
  quote: (
    <div className="rounded-md bg-amber-500/10 text-amber-600 p-2">
      <FileText className="h-4 w-4" />
    </div>
  ),
  project: (
    <div className="rounded-md bg-sky-500/10 text-sky-600 p-2">
      <FolderKanban className="h-4 w-4" />
    </div>
  ),
  site: (
    <div className="rounded-md bg-blue-500/10 text-blue-600 p-2">
      <Hammer className="h-4 w-4" />
    </div>
  ),
  invoice: (
    <div className="rounded-md bg-emerald-500/10 text-emerald-600 p-2">
      <Receipt className="h-4 w-4" />
    </div>
  ),
};

const normalizePhone = (phone?: string | null) =>
  phone?.replace(/\D/g, "").slice(-10) ?? "";

const getClientKey = (info: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  company?: string | null;
  fallbackId: string;
}) => {
  const normalizedEmail = info.email?.trim().toLowerCase();
  if (normalizedEmail) return `email:${normalizedEmail}`;

  const normalizedPhone = normalizePhone(info.phone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;

  const normalizedName = info.name?.trim().toLowerCase();
  const normalizedCompany = info.company?.trim().toLowerCase();

  if (normalizedName && normalizedCompany) {
    return `name:${normalizedName}|company:${normalizedCompany}`;
  }

  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  if (normalizedCompany) {
    return `company:${normalizedCompany}`;
  }

  return `id:${info.fallbackId}`;
};

const createEmptyAggregate = (key: string): ClientAggregate => ({
  key,
  name: "",
  company: null,
  email: null,
  phone: null,
  city: null,
  postalCode: null,
  leads: [],
  quotes: [],
  projects: [],
  sites: [],
  invoices: [],
  lastActivity: null,
  lastActivityTimestamp: null,
  utmSources: new Set<string>(),
  rawStatuses: new Set<string>(),
});

const setIfEmpty = <K extends keyof ClientAggregate>(
  aggregate: ClientAggregate,
  key: K,
  value: ClientAggregate[K]
) => {
  if (!aggregate[key] && value) {
    aggregate[key] = value;
  }
};

const updateLastActivity = (aggregate: ClientAggregate, ...dates: (string | null | undefined)[]) => {
  dates.forEach((date) => {
    if (!date) return;
    const time = new Date(date).getTime();
    if (Number.isNaN(time)) return;

    if (!aggregate.lastActivityTimestamp || time > aggregate.lastActivityTimestamp) {
      aggregate.lastActivityTimestamp = time;
      aggregate.lastActivity = new Date(time).toISOString();
    }
  });
};

const formatStatusLabel = (value: string | null | undefined) => {
  if (!value) return null;
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const getMostRecent = <T,>(
  items: T[],
  getDate: (item: T) => string | null | undefined
): { item: T; timestamp: number } | null => {
  let result: { item: T; timestamp: number } | null = null;

  items.forEach((item) => {
    const date = getDate(item);
    if (!date) return;
    const time = new Date(date).getTime();
    if (Number.isNaN(time)) return;
    if (!result || time > result.timestamp) {
      result = { item, timestamp: time };
    }
  });

  return result;
};

const determineStage = (aggregate: ClientAggregate): ClientStage => {
  const hasPaidInvoices = aggregate.invoices.some((invoice) =>
    PAID_INVOICE_STATUSES.has((invoice.status ?? "").toUpperCase())
  );
  if (hasPaidInvoices) return "client";

  const hasActiveSites = aggregate.sites.some((site) =>
    ACTIVE_SITE_STATUSES.has((site.status ?? "").toUpperCase())
  );
  if (hasActiveSites) return "project";

  const hasActiveProjects = aggregate.projects.some((project) =>
    ACTIVE_PROJECT_STATUSES.has((project.status ?? "").toUpperCase())
  );
  if (hasActiveProjects) return "project";

  const hasQuotes = aggregate.quotes.some((quote) =>
    POSITIVE_QUOTE_STATUSES.has((quote.status ?? "").toUpperCase())
  );
  if (hasQuotes) return "quote";

  if (aggregate.leads.length > 0) return "lead";

  return "prospect";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

const fetchClients = async (
  orgId: string | null,
  userId: string | null
): Promise<ClientOverview[]> => {
  if (!userId) return [];

  const leadsQuery = supabase
    .from("leads")
    .select(
      "id, full_name, email, phone_raw, city, postal_code, company, status, created_at, updated_at, utm_source, org_id"
    );
  const projectsQuery = supabase
    .from("projects")
    .select(
      "id, client_name, company, city, postal_code, status, created_at, updated_at, phone, org_id"
    );
  const quotesQuery = supabase
    .from("quotes")
    .select("id, client_name, status, amount, created_at, updated_at, valid_until, org_id");
  const sitesQuery = supabase
    .from("sites")
    .select("id, client_name, status, created_at, updated_at, org_id");
  const invoicesQuery = supabase
    .from("invoices")
    .select("id, client_name, status, amount, created_at, updated_at, org_id");

  if (orgId) {
    leadsQuery.eq("org_id", orgId);
    projectsQuery.eq("org_id", orgId);
    quotesQuery.eq("org_id", orgId);
    sitesQuery.eq("org_id", orgId);
    invoicesQuery.eq("org_id", orgId);
  } else {
    leadsQuery.eq("user_id", userId);
    projectsQuery.eq("user_id", userId);
    quotesQuery.eq("user_id", userId);
    sitesQuery.eq("user_id", userId);
    invoicesQuery.eq("user_id", userId);
  }

  const [leads, projects, quotes, sites, invoices] = await Promise.all([
    leadsQuery,
    projectsQuery,
    quotesQuery,
    sitesQuery,
    invoicesQuery,
  ]);

  if (leads.error) throw leads.error;
  if (projects.error) throw projects.error;
  if (quotes.error) throw quotes.error;
  if (sites.error) throw sites.error;
  if (invoices.error) throw invoices.error;

  const aggregates = new Map<string, ClientAggregate>();

  (leads.data ?? []).forEach((lead) => {
    const key = getClientKey({
      email: lead.email,
      phone: lead.phone_raw,
      name: lead.full_name,
      company: lead.company,
      fallbackId: lead.id,
    });
    const aggregate = aggregates.get(key) ?? createEmptyAggregate(key);

    setIfEmpty(aggregate, "name", lead.full_name ?? "");
    setIfEmpty(aggregate, "company", lead.company);
    setIfEmpty(aggregate, "email", lead.email);
    setIfEmpty(aggregate, "phone", lead.phone_raw);
    setIfEmpty(aggregate, "city", lead.city);
    setIfEmpty(aggregate, "postalCode", lead.postal_code);

    aggregate.leads.push(lead as any);
    if (lead.utm_source) {
      aggregate.utmSources.add(lead.utm_source);
    }
    if (lead.status) {
      aggregate.rawStatuses.add(lead.status);
    }

    updateLastActivity(aggregate, lead.updated_at, lead.created_at);
    aggregates.set(key, aggregate);
  });

  (projects.data ?? []).forEach((project) => {
    const key = getClientKey({
      name: project.client_name,
      company: project.company,
      phone: project.phone,
      fallbackId: project.id,
    });
    const aggregate = aggregates.get(key) ?? createEmptyAggregate(key);

    setIfEmpty(aggregate, "name", project.client_name ?? "");
    setIfEmpty(aggregate, "company", project.company);
    setIfEmpty(aggregate, "phone", project.phone);
    setIfEmpty(aggregate, "city", project.city);
    setIfEmpty(aggregate, "postalCode", project.postal_code);

    aggregate.projects.push(project as any);
    if (project.status) {
      aggregate.rawStatuses.add(project.status);
    }

    updateLastActivity(aggregate, project.updated_at, project.created_at);
    aggregates.set(key, aggregate);
  });

  (quotes.data ?? []).forEach((quote) => {
    const key = getClientKey({
      name: quote.client_name,
      fallbackId: quote.id,
    });
    const aggregate = aggregates.get(key) ?? createEmptyAggregate(key);

    setIfEmpty(aggregate, "name", quote.client_name ?? "");

    aggregate.quotes.push(quote as any);
    if (quote.status) {
      aggregate.rawStatuses.add(quote.status);
    }

    updateLastActivity(aggregate, quote.updated_at, quote.created_at);
    aggregates.set(key, aggregate);
  });

  (sites.data ?? []).forEach((site) => {
    const key = getClientKey({
      name: site.client_name,
      fallbackId: site.id,
    });
    const aggregate = aggregates.get(key) ?? createEmptyAggregate(key);

    setIfEmpty(aggregate, "name", site.client_name ?? "");

    aggregate.sites.push(site as any);
    if (site.status) {
      aggregate.rawStatuses.add(site.status);
    }

    updateLastActivity(aggregate, site.updated_at, site.created_at);
    aggregates.set(key, aggregate);
  });

  (invoices.data ?? []).forEach((invoice) => {
    const key = getClientKey({
      name: invoice.client_name,
      fallbackId: invoice.id,
    });
    const aggregate = aggregates.get(key) ?? createEmptyAggregate(key);

    setIfEmpty(aggregate, "name", invoice.client_name ?? "");

    aggregate.invoices.push(invoice as any);
    if (invoice.status) {
      aggregate.rawStatuses.add(invoice.status);
    }

    updateLastActivity(aggregate, invoice.updated_at, invoice.created_at);
    aggregates.set(key, aggregate);
  });

  const recentThreshold = subDays(new Date(), DAYS_FOR_RECENT_REVENUE).getTime();

  return Array.from(aggregates.values())
    .map<ClientOverview>((aggregate) => {
      const stage = determineStage(aggregate);

      const paidRevenue = aggregate.invoices
        .filter((invoice) => PAID_INVOICE_STATUSES.has((invoice.status ?? "").toUpperCase()))
        .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);

      const outstandingInvoices = aggregate.invoices
        .filter((invoice) => OUTSTANDING_INVOICE_STATUSES.has((invoice.status ?? "").toUpperCase()))
        .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);

      const openQuotesValue = aggregate.quotes
        .filter((quote) => POSITIVE_QUOTE_STATUSES.has((quote.status ?? "").toUpperCase()))
        .reduce((sum, quote) => sum + Number(quote.amount ?? 0), 0);

      const recentPaidRevenue = aggregate.invoices
        .filter((invoice) => {
          const status = (invoice.status ?? "").toUpperCase();
          if (!PAID_INVOICE_STATUSES.has(status)) return false;
          const referenceDate = invoice.updated_at ?? invoice.created_at;
          if (!referenceDate) return false;
          const time = new Date(referenceDate).getTime();
          if (Number.isNaN(time)) return false;
          return time >= recentThreshold;
        })
        .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);

      const latestLead = getMostRecent(aggregate.leads, (lead) => lead.updated_at ?? lead.created_at);
      const latestQuote = getMostRecent(
        aggregate.quotes,
        (quote) => quote.updated_at ?? quote.created_at ?? quote.valid_until
      );
      const latestProject = getMostRecent(
        aggregate.projects,
        (project) => project.updated_at ?? project.created_at
      );
      const latestSite = getMostRecent(aggregate.sites, (site) => site.updated_at ?? site.created_at);
      const latestInvoice = getMostRecent(
        aggregate.invoices,
        (invoice) => invoice.updated_at ?? invoice.created_at
      );

      const statusLabels = Array.from(aggregate.rawStatuses)
        .map((status) => formatStatusLabel(status))
        .filter((status): status is string => Boolean(status));

      const utmSources = Array.from(aggregate.utmSources);

      return {
        key: aggregate.key,
        name: aggregate.name || "Client inconnu",
        company: aggregate.company ?? null,
        email: aggregate.email ?? null,
        phone: aggregate.phone ?? null,
        city: aggregate.city ?? null,
        postalCode: aggregate.postalCode ?? null,
        stage,
        leadsCount: aggregate.leads.length,
        quotesCount: aggregate.quotes.length,
        projectsCount: aggregate.projects.length,
        sitesCount: aggregate.sites.length,
        invoicesCount: aggregate.invoices.length,
        paidRevenue,
        outstandingInvoices,
        openQuotesValue,
        lastActivity: aggregate.lastActivity,
        lastActivityTimestamp: aggregate.lastActivityTimestamp,
        statusLabels,
        utmSources,
        recentPaidRevenue,
        latestLead: latestLead
          ? {
              status: latestLead.item.status ?? null,
              date: latestLead.item.updated_at ?? latestLead.item.created_at ?? null,
            }
          : null,
        latestQuote: latestQuote
          ? {
              status: latestQuote.item.status ?? null,
              date:
                latestQuote.item.updated_at ??
                latestQuote.item.created_at ??
                latestQuote.item.valid_until ??
                null,
              amount: latestQuote.item.amount ?? null,
            }
          : null,
        latestProject: latestProject
          ? {
              status: latestProject.item.status ?? null,
              date: latestProject.item.updated_at ?? latestProject.item.created_at ?? null,
            }
          : null,
        latestSite: latestSite
          ? {
              status: latestSite.item.status ?? null,
              date: latestSite.item.updated_at ?? latestSite.item.created_at ?? null,
            }
          : null,
        latestInvoice: latestInvoice
          ? {
              status: latestInvoice.item.status ?? null,
              date: latestInvoice.item.updated_at ?? latestInvoice.item.created_at ?? null,
              amount: latestInvoice.item.amount ?? null,
            }
          : null,
      };
    })
    .sort((a, b) => {
      if (a.lastActivityTimestamp && b.lastActivityTimestamp) {
        return b.lastActivityTimestamp - a.lastActivityTimestamp;
      }
      if (a.lastActivityTimestamp) return -1;
      if (b.lastActivityTimestamp) return 1;
      return a.name.localeCompare(b.name);
    });
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const formatRelativeTime = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: fr });
};

const formatAbsoluteDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const ClientsTableSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-[1.5fr,1fr,1fr,1fr,1fr] gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 w-full">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    ))}
  </div>
);

const Clients = () => {
  const { user } = useAuth();
  const { currentOrgId, isLoading: orgLoading } = useOrg();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  const {
    data: clients = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["clients", user?.id, currentOrgId],
    queryFn: () => fetchClients(currentOrgId ?? null, user?.id ?? null),
    enabled: Boolean(user) && !orgLoading,
  });

  const stageCounts = useMemo(() => {
    return clients.reduce(
      (acc, client) => {
        acc[client.stage] = (acc[client.stage] ?? 0) + 1;
        return acc;
      },
      {
        client: 0,
        project: 0,
        quote: 0,
        lead: 0,
        prospect: 0,
      } as Record<ClientStage, number>
    );
  }, [clients]);

  const metrics = useMemo(() => {
    const totalClients = clients.length;
    const convertedClients = stageCounts.client;
    const activeProjects = stageCounts.project;
    const totalLeadContacts = clients.filter((client) => client.leadsCount > 0).length;
    const conversionRate = totalLeadContacts
      ? Math.round((convertedClients / totalLeadContacts) * 100)
      : 0;

    const pipelineValue = clients.reduce((sum, client) => sum + client.openQuotesValue, 0);
    const outstandingInvoices = clients.reduce(
      (sum, client) => sum + client.outstandingInvoices,
      0
    );
    const recentPaidRevenue = clients.reduce(
      (sum, client) => sum + client.recentPaidRevenue,
      0
    );

    return {
      totalClients,
      convertedClients,
      activeProjects,
      conversionRate,
      pipelineValue,
      outstandingInvoices,
      recentPaidRevenue,
    };
  }, [clients, stageCounts]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return clients.filter((client) => {
      if (stageFilter !== "all" && client.stage !== stageFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        client.name,
        client.company ?? "",
        client.email ?? "",
        client.phone ?? "",
        client.city ?? "",
        client.postalCode ?? "",
        client.statusLabels.join(" "),
        client.utmSources.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [clients, stageFilter, searchTerm]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const events: ActivityItem[] = [];

    clients.forEach((client) => {
      if (client.latestLead?.date) {
        events.push({
          id: `lead-${client.key}`,
          type: "lead",
          client: client.name,
          description: `Lead ${
            formatStatusLabel(client.latestLead.status) ?? "mis à jour"
          }`,
          date: client.latestLead.date,
        });
      }

      if (client.latestQuote?.date) {
        const statusLabel = formatStatusLabel(client.latestQuote.status) ?? "Devis en cours";
        const amountLabel =
          typeof client.latestQuote.amount === "number"
            ? ` • ${formatCurrency(client.latestQuote.amount)}`
            : "";

        events.push({
          id: `quote-${client.key}`,
          type: "quote",
          client: client.name,
          description: `${statusLabel}${amountLabel}`,
          date: client.latestQuote.date,
        });
      }

      if (client.latestProject?.date) {
        events.push({
          id: `project-${client.key}`,
          type: "project",
          client: client.name,
          description: `Projet ${
            formatStatusLabel(client.latestProject.status) ?? "mis à jour"
          }`,
          date: client.latestProject.date,
        });
      }

      if (client.latestSite?.date) {
        events.push({
          id: `site-${client.key}`,
          type: "site",
          client: client.name,
          description: `Chantier ${
            formatStatusLabel(client.latestSite.status) ?? "en cours"
          }`,
          date: client.latestSite.date,
        });
      }

      if (client.latestInvoice?.date) {
        const statusLabel = formatStatusLabel(client.latestInvoice.status) ?? "mise à jour";
        const amountLabel =
          typeof client.latestInvoice.amount === "number"
            ? ` ${formatCurrency(client.latestInvoice.amount)}`
            : "";

        events.push({
          id: `invoice-${client.key}`,
          type: "invoice",
          client: client.name,
          description: `Facture${amountLabel} • ${statusLabel}`,
          date: client.latestInvoice.date,
        });
      }
    });

    return events
      .filter((event) => Boolean(event.date))
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 8);
  }, [clients]);

  const topClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => b.paidRevenue + b.outstandingInvoices - (a.paidRevenue + a.outstandingInvoices))
      .slice(0, 5);
  }, [clients]);

  const stageOptions: { value: StageFilter; label: string; count: number }[] = [
    { value: "all", label: "Tous", count: clients.length },
    { value: "client", label: "Clients", count: stageCounts.client },
    { value: "project", label: "Projets", count: stageCounts.project },
    { value: "quote", label: "Devis", count: stageCounts.quote },
    { value: "lead", label: "Leads", count: stageCounts.lead },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Clients</h1>
              <p className="text-muted-foreground">
                Vue 360° des clients, historiques de projets et facturation consolidée
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="hidden text-sm font-medium text-primary md:inline-flex"
            >
              Actualiser les données
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portefeuille clients
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metrics.totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.conversionRate}% de conversion sur les leads engagés
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clients actifs
              </CardTitle>
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {metrics.convertedClients + metrics.activeProjects}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.convertedClients} fidélisés • {metrics.activeProjects} projets en cours
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-amber-500/5 to-amber-500/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Potentiel pipeline
              </CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(metrics.pipelineValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Devis en cours de signature
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-sky-500/5 to-sky-500/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Factures en attente
              </CardTitle>
              <Wallet className="h-4 w-4 text-sky-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {formatCurrency(metrics.outstandingInvoices)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Encaissements 30j : {formatCurrency(metrics.recentPaidRevenue)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-xl font-semibold">Liste des clients</CardTitle>
                <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un client, une société ou une ville..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ToggleGroup
                    type="single"
                    value={stageFilter}
                    onValueChange={(value) => {
                      if (value) {
                        setStageFilter(value as StageFilter);
                      }
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    {stageOptions.map((option) => (
                      <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                      >
                        <span>{option.label}</span>
                        <Badge variant="secondary" className="rounded-full bg-muted px-2 py-0 text-[11px]">
                          {option.count}
                        </Badge>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <ClientsTableSkeleton />
              ) : isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Impossible de charger les clients</AlertTitle>
                  <AlertDescription>
                    {error?.message ?? "Une erreur inattendue est survenue"}
                  </AlertDescription>
                </Alert>
              ) : filteredClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 text-muted-foreground/60" />
                  <p className="text-sm font-medium">Aucun client ne correspond à cette recherche</p>
                  <p className="text-xs">
                    Vérifiez vos filtres ou synchronisez de nouveaux leads depuis vos campagnes
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="hidden grid-cols-[1.5fr,1fr,1fr,1fr,1fr] gap-4 text-xs font-medium uppercase text-muted-foreground/70 lg:grid">
                    <span>Client</span>
                    <span>Contacts</span>
                    <span>Pipeline</span>
                    <span>Financier</span>
                    <span>Activité</span>
                  </div>
                  <div className="space-y-4">
                    {filteredClients.map((client) => (
                      <div
                        key={client.key}
                        className="grid gap-4 rounded-lg border p-4 transition hover:border-primary/40 lg:grid-cols-[1.5fr,1fr,1fr,1fr,1fr]"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground">
                              {client.name}
                            </div>
                            <div className="text-xs text-muted-foreground space-x-2">
                              {client.company && <span>{client.company}</span>}
                              {(client.city || client.postalCode) && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[client.postalCode, client.city].filter(Boolean).join(" ")}
                                </span>
                              )}
                            </div>
                            {client.utmSources.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {client.utmSources.map((source) => (
                                  <Badge key={source} variant="outline" className="text-[10px]">
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                          {client.email && (
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="inline-flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {client.phone}
                            </span>
                          )}
                          {!client.email && !client.phone && (
                            <span className="text-xs text-muted-foreground/70">
                              Informations de contact à compléter
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Badge className={stageConfig[client.stage].className}>
                            {stageConfig[client.stage].label}
                          </Badge>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground">{client.leadsCount}</span>
                              <p>Leads</p>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">{client.quotesCount}</span>
                              <p>Devis</p>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">{client.projectsCount}</span>
                              <p>Projets</p>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">{client.sitesCount}</span>
                              <p>Chantiers</p>
                            </div>
                          </div>
                          {client.statusLabels.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {client.statusLabels.slice(0, 3).map((status) => (
                                <Badge key={status} variant="outline" className="text-[10px]">
                                  {status}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Encaissements</span>
                            <span className="font-medium text-emerald-600">
                              {formatCurrency(client.paidRevenue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>En attente</span>
                            <span className="font-medium text-amber-600">
                              {formatCurrency(client.outstandingInvoices)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Pipeline</span>
                            <span className="font-medium text-muted-foreground">
                              {formatCurrency(client.openQuotesValue)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{client.invoicesCount}</span> facture(s)
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-2 text-sm text-foreground">
                            <Activity className="h-4 w-4 text-primary" />
                            {formatRelativeTime(client.lastActivity)}
                          </span>
                          <span>{formatAbsoluteDate(client.lastActivity)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Activité récente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Les interactions clients apparaîtront ici dès que des leads, devis ou factures seront créés.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activityItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        {activityIcons[item.type]}
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{item.client}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.date ? formatRelativeTime(item.date) : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-primary" />
                  Top clients
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Dès qu'un client signe un devis ou qu'une facture est payée, il apparaîtra dans ce classement.
                  </p>
                ) : (
                  topClients.map((client) => (
                    <div key={client.key} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{client.name}</p>
                          {client.company && (
                            <p className="text-xs text-muted-foreground">{client.company}</p>
                          )}
                        </div>
                        <Badge className={stageConfig[client.stage].className}>
                          {stageConfig[client.stage].label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Encaissements</span>
                        <span className="font-medium text-emerald-600">
                          {formatCurrency(client.paidRevenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>En attente</span>
                        <span className="font-medium text-amber-600">
                          {formatCurrency(client.outstandingInvoices)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Pipeline</span>
                        <span className="font-medium">
                          {formatCurrency(client.openQuotesValue)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Clients;
