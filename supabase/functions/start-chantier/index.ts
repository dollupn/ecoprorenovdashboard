import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface StartChantierRequest {
  projectId: string;
  dateDebut: string;
  dateFinPrevue?: string | null;
  subcontractorId?: string;
  notes?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      console.error('Authentication failed: No user found');
      throw new Error('Non authentifié');
    }

    console.log('User authenticated:', user.id);

    const { projectId, dateDebut, dateFinPrevue, subcontractorId, notes }: StartChantierRequest = await req.json();

    console.log('Request data:', { projectId, dateDebut, dateFinPrevue, subcontractorId });

    // Fetch project with org check
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project fetch error:', projectError);
      throw new Error('Projet introuvable');
    }

    console.log('Project found:', project.id, 'org:', project.org_id);

    // Verify user has access to this org
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('*')
      .eq('org_id', project.org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      console.error('No membership found for user:', user.id, 'org:', project.org_id);
      throw new Error('Accès non autorisé');
    }

    console.log('Membership verified for user:', user.id);

    // Normalize and validate data
    const siteRef = `${project.project_ref}-CHANTIER`;
    const normalizedDateDebut = dateDebut || new Date().toISOString().split('T')[0];

    // Create chantier
    const chantierData = {
      project_id: project.id,
      org_id: project.org_id,
      user_id: project.user_id,
      project_ref: project.project_ref,
      site_ref: siteRef,
      client_name: project.client_name,
      client_first_name: project.client_first_name,
      client_last_name: project.client_last_name,
      product_name: project.product_name,
      address: project.address || '',
      city: project.city,
      postal_code: project.postal_code,
      date_debut: normalizedDateDebut,
      date_fin_prevue: dateFinPrevue?.trim() || null,
      subcontractor_id: subcontractorId || null,
      notes: notes,
      team_members: [],
    };

    console.log('Creating chantier with data:', chantierData);

    const { data: chantier, error: chantierError } = await supabaseClient
      .from('sites')
      .insert(chantierData)
      .select()
      .single();

    if (chantierError) {
      console.error('Chantier creation error:', chantierError);
      throw new Error(chantierError.message || 'Impossible de créer le chantier');
    }

    console.log('Chantier created successfully:', chantier.id);

    return new Response(
      JSON.stringify({ chantier, project }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );

  } catch (error) {
    console.error('Error in start-chantier:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ message: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
