import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type LeadRow = Tables<"leads">;
type ProjectRow = Tables<"projects">;
type ProjectAppointmentRow = Tables<"project_appointments">;
type AppointmentTypeRow = Tables<"appointment_types">;

type ProjectAppointmentProject = Pick<
  ProjectRow,
  | "id"
  | "project_ref"
  | "status"
  | "assigned_to"
  | "address"
  | "city"
  | "postal_code"
  | "client_name"
  | "client_first_name"
  | "client_last_name"
  | "lead_id"
>;

type ProjectAppointmentJoinedRow = ProjectAppointmentRow & {
  appointment_type: Pick<AppointmentTypeRow, "id" | "name"> | null;
  project: ProjectAppointmentProject | null;
};

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
  status: string | null;
  projectAppointmentStatus: null;
  assignedTo: NullableString;
  productName: NullableString;
  location: NullableString;
  durationMinutes: number | null;
  project: {
    id: string;
    projectRef: NullableString;
    status: NullableString;
    assignedTo: NullableString;
    leadId?: NullableString;
    address?: NullableString;
    city?: NullableString;
    postalCode?: NullableString;
    clientName?: NullableString;
  } | null;
  appointmentType: AppointmentTypeInfo;
  source: "crm" | "google";
  entityType: "lead" | "project";
  leadId: string | null;
  projectId: string | null;
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

const looksLikeUuid = (value: string | null): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

const deriveProjectLocation = (
  project: ProjectAppointmentProject | null,
): string | null => {
  if (!project) return null;

  const parts = [project.address, project.postal_code, project.city]
    .map((value) => getString(value))
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" ") : null;
};

const deriveProjectClientName = (
  project: ProjectAppointmentProject | null,
): string | null => {
  if (!project) return null;

  const direct = getString(project.client_name);
  if (direct) return direct;

  const segments = [
    getString(project.client_first_name),
    getString(project.client_last_name),
  ].filter((value): value is string => Boolean(value));

  return segments.length > 0 ? segments.join(" ") : null;
};

const getRecordTimestamp = (record: ScheduledAppointmentRecord): number => {
  if (!record.date) return Number.POSITIVE_INFINITY;

  const [yearStr, monthStr, dayStr] = record.date.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10) - 1;
  const day = Number.parseInt(dayStr ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return Number.POSITIVE_INFINITY;
  }

  let hours = 0;
  let minutes = 0;

  if (record.time) {
    const [hoursStr, minutesStr] = record.time.split(":");
    const parsedHours = Number.parseInt(hoursStr ?? "", 10);
    const parsedMinutes = Number.parseInt(minutesStr ?? "", 10);

    if (Number.isFinite(parsedHours)) {
      hours = parsedHours;
    }

    if (Number.isFinite(parsedMinutes)) {
      minutes = parsedMinutes;
    }
  }

  const result = new Date(year, month, day, hours, minutes, 0, 0);
  const timestamp = result.getTime();

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

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

  const projectAppointmentsPromise = supabase
    .from("project_appointments")
    .select(
      `id, project_id, appointment_date, appointment_time, appointment_type_id, assignee_id, notes,
        appointment_type:appointment_types(id, name),
        project:projects(id, project_ref, status, assigned_to, address, city, postal_code, client_name, client_first_name, client_last_name, lead_id)`
    )
    .eq("org_id", orgId)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  const [
    { data: appointmentTypes, error: appointmentTypesError },
    { data: projects, error: projectsError },
    { data: projectAppointments, error: projectAppointmentsError },
  ] = await Promise.all([
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
    projectAppointmentsPromise,
  ]);

  if (appointmentTypesError) throw appointmentTypesError;
  if (projectsError) throw projectsError;
  if (projectAppointmentsError) throw projectAppointmentsError;

  const appointmentTypesById = new Map<string, AppointmentTypeRow>();
  const appointmentTypesByName = new Map<string, AppointmentTypeRow>();

  for (const type of appointmentTypes ?? []) {
    if (type.id !== null && type.id !== undefined) {
      appointmentTypesById.set(type.id, type);
    }

    const normalizedName =
      typeof type.name === "string"
        ? type.name.trim().toLowerCase()
        : null;

    if (normalizedName) {
      appointmentTypesByName.set(normalizedName, type);
      continue;
    }

    if (type.id !== null && type.id !== undefined) {
      const fallbackKey = String(type.id).trim().toLowerCase();
      if (fallbackKey) {
        appointmentTypesByName.set(fallbackKey, type);
      }
    }
  }

  const projectLookup = buildProjectLookup(projects);

  const leadRecords = (leads ?? []).map((lead) => {
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
      status: getString(lead.status),
      projectAppointmentStatus: null,
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
            leadId: getString(project.lead_id),
          }
        : null,
      appointmentType,
      source,
      entityType: "lead" as const,
      leadId: lead.id ?? null,
      projectId: project?.id ?? null,
    };
  });

  const projectAppointmentRows = (projectAppointments ?? []) as ProjectAppointmentJoinedRow[];

  const projectAppointmentRecords = projectAppointmentRows.map((appointment) => {
    const project = appointment.project;

    let appointmentType: AppointmentTypeInfo = null;
    if (appointment.appointment_type) {
      appointmentType = {
        id: getString(appointment.appointment_type.id),
        name: getString(appointment.appointment_type.name),
      };
    } else if (appointment.appointment_type_id) {
      const mapped = appointmentTypesById.get(appointment.appointment_type_id);
      appointmentType = mapped
        ? { id: mapped.id, name: mapped.name ?? null }
        : { id: appointment.appointment_type_id, name: null };
    }

    const location = deriveProjectLocation(project);
    const projectAssignedTo = getString(project?.assigned_to);
    const appointmentAssignee = getString(appointment.assignee_id);
    const assignedTo = projectAssignedTo ?? (looksLikeUuid(appointmentAssignee) ? null : appointmentAssignee);

    const fullName =
      deriveProjectClientName(project) ?? getString(project?.project_ref) ?? "Projet";

    return {
      id: appointment.id,
      fullName,
      date: getString(appointment.appointment_date),
      time: getString(appointment.appointment_time),
      address: null,
      city: getString(project?.city ?? null),
      postalCode: getString(project?.postal_code ?? null),
      commentaire: getString(appointment.notes),
      status: getString(project?.status ?? null) ?? "confirmed",
      projectAppointmentStatus: null,
      assignedTo,
      productName: null,
      location: location ?? "Adresse à confirmer",
      durationMinutes: null,
      project: project
        ? {
            id: project.id,
            projectRef: getString(project.project_ref),
            status: getString(project.status),
            assignedTo: projectAssignedTo,
            leadId: getString(project.lead_id),
            address: getString(project.address),
            city: getString(project.city),
            postalCode: getString(project.postal_code),
            clientName: deriveProjectClientName(project),
          }
        : null,
      appointmentType,
      source: "crm",
      entityType: "project" as const,
      leadId: getString(project?.lead_id ?? null),
      projectId: project?.id ?? null,
    } satisfies ScheduledAppointmentRecord;
  });

  const combinedRecords = [...leadRecords, ...projectAppointmentRecords];

  return combinedRecords.sort(
    (a, b) => getRecordTimestamp(a) - getRecordTimestamp(b),
  );
};

export const markProjectAppointmentDone = async (
  params: { appointmentId: string; orgId: string },
) => {
  const { appointmentId, orgId } = params;
  // Note: project_appointments table doesn't have a status column
  // This function is kept for API compatibility but doesn't update anything
  // Consider tracking appointment completion in a separate way if needed
  return;
};

export const deleteProjectAppointment = async (
  params: { appointmentId: string; orgId: string },
) => {
  const { appointmentId, orgId } = params;
  const { error } = await supabase
    .from("project_appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("org_id", orgId);

  if (error) throw error;
};

