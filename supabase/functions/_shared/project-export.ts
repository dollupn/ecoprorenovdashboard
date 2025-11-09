import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type DocumentCategory =
  | 'DEVIS'
  | 'FACTURES'
  | 'CONTRATS'
  | 'TECHNIQUES'
  | 'AUTRES'
  | 'PRODUITS';

const DOCUMENT_CATEGORIES = new Set<DocumentCategory>([
  'DEVIS',
  'FACTURES',
  'CONTRATS',
  'TECHNIQUES',
  'AUTRES',
  'PRODUITS',
]);

const normalizeIsoString = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
};

const computeLatestIso = (
  values: Array<string | null | undefined>,
): string | null => {
  let latest: number | null = null;

  for (const value of values) {
    const normalized = normalizeIsoString(value);
    if (!normalized) continue;

    const timestamp = Date.parse(normalized);
    if (Number.isNaN(timestamp)) continue;

    if (latest === null || timestamp > latest) {
      latest = timestamp;
    }
  }

  return latest !== null ? new Date(latest).toISOString() : null;
};

export type LightweightInvoice = {
  id: string;
  project_id: string | null;
  org_id: string | null;
  invoice_ref: string;
  status: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_first_name: string | null;
  client_last_name: string | null;
  notes: string | null;
};

export type ProjectDocument = {
  id: string;
  project_id: string;
  org_id: string | null;
  category: string;
  file_name: string;
  file_url: string | null;
  drive_url: string | null;
  preview_url: string | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectExportMeta = {
  project_id: string;
  org_id: string | null;
  project_created_at: string | null;
  project_updated_at: string | null;
  last_activity_at: string | null;
  latest_invoice_activity_at: string | null;
  latest_doc_activity_at: string | null;
  invoices_count: number;
  docs_count: number;
};

export type ProjectExportBundle = {
  meta: ProjectExportMeta;
  project: Record<string, unknown> & {
    invoices: LightweightInvoice[];
    docs: ProjectDocument[];
  };
};

type ProjectRow = {
  id: string;
  org_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  [key: string]: unknown;
};

type InvoiceRow = {
  id: string;
  project_id: string | null;
  org_id: string | null;
  invoice_ref: string;
  status: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_first_name: string | null;
  client_last_name: string | null;
  notes: string | null;
};

type ProjectMediaRow = {
  id: string;
  project_id: string;
  org_id: string | null;
  category: string;
  file_name: string;
  file_url: string | null;
  drive_url: string | null;
  preview_url: string | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
};

const sanitizeInvoice = (invoice: InvoiceRow): LightweightInvoice => ({
  id: invoice.id,
  project_id: invoice.project_id,
  org_id: invoice.org_id,
  invoice_ref: invoice.invoice_ref,
  status: invoice.status,
  amount: invoice.amount,
  due_date: invoice.due_date,
  paid_date: invoice.paid_date,
  created_at: invoice.created_at,
  updated_at: invoice.updated_at,
  client_name: invoice.client_name,
  client_first_name: invoice.client_first_name,
  client_last_name: invoice.client_last_name,
  notes: invoice.notes,
});

const sanitizeDocument = (doc: ProjectMediaRow): ProjectDocument => ({
  id: doc.id,
  project_id: doc.project_id,
  org_id: doc.org_id,
  category: doc.category,
  file_name: doc.file_name,
  file_url: doc.file_url,
  drive_url: doc.drive_url,
  preview_url: doc.preview_url,
  mime_type: doc.mime_type,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

const filterDocumentCategory = (category: string | null | undefined): boolean => {
  if (!category) return false;
  return DOCUMENT_CATEGORIES.has(category as DocumentCategory);
};

export const fetchProjectExportBundle = async (
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectExportBundle | null> => {
  const { data: project, error: projectError } = await client
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle<ProjectRow>();

  if (projectError) {
    throw projectError;
  }

  if (!project) {
    return null;
  }

  const [invoicesResult, docsResult] = await Promise.all([
    client
      .from('invoices')
      .select('id, project_id, org_id, invoice_ref, status, amount, due_date, paid_date, created_at, updated_at, client_name, client_first_name, client_last_name, notes')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    client
      .from('project_media')
      .select('id, project_id, org_id, category, file_name, file_url, drive_url, preview_url, mime_type, created_at, updated_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ]);

  if (invoicesResult.error) {
    throw invoicesResult.error;
  }

  if (docsResult.error) {
    throw docsResult.error;
  }

  const invoices = ((invoicesResult.data ?? []) as InvoiceRow[]).map(sanitizeInvoice);
  const docs = ((docsResult.data ?? []) as ProjectMediaRow[])
    .filter((doc) => filterDocumentCategory(doc.category))
    .map(sanitizeDocument);

  const projectCreatedAt = normalizeIsoString(project.created_at as string | null | undefined);
  const projectUpdatedAt = normalizeIsoString(project.updated_at as string | null | undefined);
  const latestInvoiceActivity = computeLatestIso(
    invoices.map((invoice) => invoice.updated_at ?? invoice.created_at),
  );
  const latestDocActivity = computeLatestIso(
    docs.map((doc) => doc.updated_at ?? doc.created_at),
  );
  const lastActivity = computeLatestIso([
    projectUpdatedAt,
    latestInvoiceActivity,
    latestDocActivity,
  ]);

  const meta: ProjectExportMeta = {
    project_id: project.id,
    org_id: (project.org_id as string | null | undefined) ?? null,
    project_created_at: projectCreatedAt,
    project_updated_at: projectUpdatedAt,
    last_activity_at: lastActivity,
    latest_invoice_activity_at: latestInvoiceActivity,
    latest_doc_activity_at: latestDocActivity,
    invoices_count: invoices.length,
    docs_count: docs.length,
  };

  return {
    meta,
    project: {
      ...project,
      invoices,
      docs,
    },
  };
};
