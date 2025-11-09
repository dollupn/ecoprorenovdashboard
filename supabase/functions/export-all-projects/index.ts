import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  fetchProjectExportBundle,
  type ProjectExportBundle,
} from '../_shared/project-export.ts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase configuration');
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEFAULT_HEADERS = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const parsePositiveInteger = (
  rawValue: string | null,
  {
    defaultValue,
    minValue,
    maxValue,
  }: { defaultValue: number; minValue: number; maxValue: number },
): number => {
  const value = rawValue?.trim();
  if (!value) {
    return defaultValue;
  }

  if (!/^\d+$/.test(value)) {
    throw new HttpError(400, 'Invalid numeric parameter');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, 'Invalid numeric parameter');
  }

  if (parsed < minValue) {
    throw new HttpError(400, 'Numeric parameter out of range');
  }

  return Math.min(parsed, maxValue);
};

const parseOffset = (value: string | null): number => {
  const parsed = parsePositiveInteger(value, {
    defaultValue: 0,
    minValue: 0,
    maxValue: Number.MAX_SAFE_INTEGER,
  });

  return parsed;
};

const parseLimit = (value: string | null): number =>
  parsePositiveInteger(value, {
    defaultValue: DEFAULT_LIMIT,
    minValue: 1,
    maxValue: MAX_LIMIT,
  });

const parseUpdatedSince = (value: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    throw new HttpError(400, 'Invalid updated_since parameter');
  }

  return new Date(timestamp).toISOString();
};

const resolveEcoproKey = (): string | null => {
  const candidates = [
    'ECOPRO_KEY',
    'ECOPRO_API_KEY',
    'ECOPRO_SYNC_KEY',
    'ECOPRORENOV_API_KEY',
    'X_ECOPRO_KEY',
    'N8N_ECOPRO_KEY',
  ];

  for (const name of candidates) {
    const value = Deno.env.get(name);
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: DEFAULT_HEADERS,
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: DEFAULT_HEADERS });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ message: 'Method not allowed' }, 405);
  }

  try {
    const providedKey = req.headers.get('x-ecopro-key')?.trim();
    const expectedKey = resolveEcoproKey();

    if (!expectedKey) {
      console.error('Missing ECOPRO key configuration');
      throw new HttpError(500, 'Service configuration error');
    }

    if (!providedKey || providedKey !== expectedKey) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = parseOffset(url.searchParams.get('offset'));
    const updatedSince = parseUpdatedSince(url.searchParams.get('updated_since'));

    let projectsQuery = supabaseClient
      .from('projects')
      .select('id, updated_at')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true });

    if (updatedSince) {
      projectsQuery = projectsQuery.gte('updated_at', updatedSince);
    }

    const { data: idRows, error: idError } = await projectsQuery.range(
      offset,
      offset + limit,
    );

    if (idError) {
      console.error('Failed to fetch project ids', idError);
      throw new HttpError(500, 'Unable to fetch projects');
    }

    const rows = idRows ?? [];
    const hasMore = rows.length > limit;
    const limitedRows = hasMore ? rows.slice(0, limit) : rows;

    const bundles = await Promise.all(
      limitedRows.map(async (row): Promise<ProjectExportBundle | null> => {
        const bundle = await fetchProjectExportBundle(supabaseClient, row.id);
        return bundle;
      }),
    );

    const projects = bundles.filter(
      (bundle): bundle is ProjectExportBundle => Boolean(bundle),
    );

    return jsonResponse({
      projects,
      next_offset: hasMore ? offset + limit : null,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ message: error.message }, error.status);
    }

    console.error('Unexpected error in export-all-projects', error);
    return jsonResponse({ message: 'Unexpected error' }, 500);
  }
});
