import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type LeadRow = Tables<"leads">;
type ProjectRow = Tables<"projects">;
type AppointmentTypeRow = Tables<"appointment_types">;

type ExtraFieldsRecord = Record<string, unknown>;

type NullableString = string | null;

type AppointmentTypeInfo = {
  id: string | null;
  name: string | null;
} | null;

export type ScheduledAppointmentRecord = {
  id: string;
  fullName: string;
  date: NullableString;
  time: NullableString;
  address: NullableString;
  city: NullableString;
  postalCode: NullableString;
  commentaire: NullableString;
  status: string;
  assignedTo: NullableString;
  productName: NullableString;
  location: NullableString;
  durationMinutes: number | null;
  project: {
    id: string;
    projectRef: NullableString;
    status: NullableString;
    assignedTo: NullableString;
  } | null;
  appointmentType: AppointmentTypeInfo;
  source: "crm" | "google";
};

const isRecord = (value: unknown): value is ExtraFieldsRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeSource = (value: string | null): "crm" | "google" => {
  if (!value) return "crm";
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("google")) return "google";
  if (normalized === "crm") return "crm";
  return "crm";
};

const deriveAppointmentType = (
  extra: ExtraFieldsRecord | null,
  appointmentTypesById: Map<string, AppointmentTypeRow>,
  appointmentTypesByName: Map<string, AppointmentTypeRow>,
): AppointmentTypeInfo => {
  if (!extra) return null;

  let id = getString(
    extra["appointment_type_id"] ??
      extra["appointmentTypeId"] ??
      extra["rdv_type_id"] ??
      extra["rdvTypeId"] ??
      null,
  );

  let name = getString(
    extra["appointment_type_label"] ??
      extra["appointment_type"] ??
      extra["appointmentType"] ??
      extra["appointmentTypeLabel"] ??
      extra["rdv_type_label"] ??
      extra["rdv_type"] ??
      extra["rdvType"] ??
      null,
  );

  if (id) {
    const match = appointmentTypesById.get(id);
    if (match) {
      name = match.name ?? name;
    }
  } else if (name) {
    const match = appointmentTypesByName.get(name.toLowerCase());
    if (match) {
      id = match.id;
      name = match.name;
    }
  }

  if (!id && !name) {
    return null;
  }

  return { id: id ?? null, name: name ?? null };
};

const deriveLocation = (
  lead: { address: string; postal_code: string; city: string },
  extra: ExtraFieldsRecord | null,
): string | null => {
  const extraLocation = getString(
    extra?.["appointment_location"] ??
      extra?.["rdv_location"] ??
      extra?.["location"] ??
      extra?.["address"] ??
      null,
  );

  if (extraLocation) return extraLocation;

  const parts = [lead.address, lead.postal_code, lead.city]
    .map((value) => getString(value))
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" ") : null;
};

const deriveDuration = (extra: ExtraFieldsRecord | null): number | null =>
  getNumber(
    extra?.["appointment_duration_minutes"] ??
      extra?.["rdv_duration_minutes"] ??
      extra?.["duration_minutes"] ??
      extra?.["duration"] ??
      null,
  );

const deriveSource = (extra: ExtraFieldsRecord | null): "crm" | "google" =>
  normalizeSource(
    getString(extra?.["calendar_source"] ?? extra?.["source"] ?? null),
  );

const buildProjectLookup = (projects: ProjectRow[] | null) => {
  const lookup = new Map<string, ProjectRow>();
  if (!projects) return lookup;

  for (const project of projects) {
    if (!project.lead_id || lookup.has(project.lead_id)) continue;
    lookup.set(project.lead_id, project);
  }

  return lookup;
};

export const fetchScheduledAppointments = async (
  orgId: string,
): Promise<ScheduledAppointmentRecord[]> => {
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select(
      "id, full_name, date_rdv, heure_rdv, address, city, postal_code, commentaire, status, assigned_to, product_name, extra_fields",
    )
    .eq("org_id", orgId)
    .not("date_rdv", "is", null)
    .order("date_rdv", { ascending: true });

  if (leadsError) throw leadsError;

  const leadIds = leads?.map((lead) => lead.id).filter(Boolean) ?? [];

  const [{ data: appointmentTypes, error: appointmentTypesError }, { data: projects, error: projectsError }] =
    await Promise.all([
      supabase
        .from("appointment_types")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true),
      leadIds.length > 0
        ? supabase
            .from("projects")
            .select("id, lead_id, project_ref, status, assigned_to")
            .in("lead_id", leadIds)
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (appointmentTypesError) throw appointmentTypesError;
  if (projectsError) throw projectsError;

  const appointmentTypesById = new Map<string, AppointmentTypeRow>();
  const appointmentTypesByName = new Map<string, AppointmentTypeRow>();

  for (const type of appointmentTypes ?? []) {
    appointmentTypesById.set(type.id, type);
    appointmentTypesByName.set(type.name.toLowerCase(), type);
  }

  const projectLookup = buildProjectLookup(projects);

  return (leads ?? []).map((lead) => {
    const extra = isRecord(lead.extra_fields) ? lead.extra_fields : null;

    const project = lead.id ? projectLookup.get(lead.id) ?? null : null;

    const appointmentType = deriveAppointmentType(
      extra,
      appointmentTypesById,
      appointmentTypesByName,
    );

    const durationMinutes = deriveDuration(extra);

    const location = deriveLocation(lead, extra);

    const source = deriveSource(extra);

    return {
      id: lead.id,
      fullName: lead.full_name,
      date: getString(lead.date_rdv),
      time: getString(lead.heure_rdv),
      address: getString(lead.address),
      city: getString(lead.city),
      postalCode: getString(lead.postal_code),
      commentaire: getString(lead.commentaire),
      status: lead.status,
      assignedTo: getString(lead.assigned_to),
      productName: getString(lead.product_name),
      location,
      durationMinutes,
      project: project
        ? {
            id: project.id,
            projectRef: getString(project.project_ref),
            status: getString(project.status),
            assignedTo: getString(project.assigned_to),
          }
        : null,
      appointmentType,
      source,
    };
  });
};

