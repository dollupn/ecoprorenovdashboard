import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-ecopro-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const errorResponse = (status: number, message: string) =>
  jsonResponse({ message }, { status });

const createTimeoutSignal = () => AbortSignal.timeout(60000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const providedKey = req.headers.get('x-ecopro-key');
    const expectedKey = Deno.env.get('ECOPRO_EXPORT_KEY');

    if (!providedKey || !expectedKey || providedKey !== expectedKey) {
      return errorResponse(401, 'Non autorisé');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return errorResponse(500, 'Configuration manquante');
    }

    const url = new URL(req.url);
    let projectId = url.searchParams.get('project_id');
    const projectRef = url.searchParams.get('ref');

    if (!projectId && !projectRef) {
      return errorResponse(400, 'Paramètre project_id ou ref requis');
    }

    const client = createClient(supabaseUrl, serviceRoleKey);

    if (!projectId && projectRef) {
      const { data: resolvedProject, error: resolveError } = await client
        .from('projects')
        .select('id')
        .eq('project_ref', projectRef)
        .maybeSingle();

      if (resolveError) {
        console.error('Failed to resolve project ref', resolveError);
        return errorResponse(500, 'Erreur lors de la résolution du projet');
      }

      if (!resolvedProject) {
        return errorResponse(404, 'Projet introuvable');
      }

      projectId = resolvedProject.id;
    }

    const { data: project, error } = await client
      .from('projects')
      .select(
        `*,
        client:clients(*),
        sites(
          *,
          finances:site_finances(*),
          cee:site_cee(*),
          rdv:site_rdv(*),
          materiaux:site_materiaux(*),
          docs:site_docs(*)
        ),
        leads(*),
        invoices(*),
        kpis:project_kpis(*)`
      )
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch project', error);
      return errorResponse(500, 'Erreur lors de la récupération du projet');
    }

    if (!project) {
      return errorResponse(404, 'Projet introuvable');
    }

    const meta = {
      exported_at: new Date().toISOString(),
      app: Deno.env.get('APP_NAME') ?? 'EcoProRenov',
      version: Deno.env.get('APP_VERSION') ?? 'unknown',
      project_id: projectId,
    };

    const basePayload = { meta, project };

    const encoder = new TextEncoder();
    const baseJson = JSON.stringify(basePayload);
    const checksumBuffer = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(baseJson)
    );

    const checksum = Array.from(new Uint8Array(checksumBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    const responsePayload = {
      ...basePayload,
      meta: {
        ...basePayload.meta,
        checksum,
      },
    };

    return jsonResponse(responsePayload, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in export-project function', error);
    return errorResponse(500, 'Erreur interne du serveur');
  }
});
