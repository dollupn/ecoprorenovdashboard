import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { fetchScheduledAppointments } from "./api";

type SupabaseResponse<T> = { data: T; error: null };

const createQuery = <T>(response: SupabaseResponse<T>) => {
  const query: any = {};

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.not = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.in = vi.fn(() => query);

  const promise = Promise.resolve(response);

  query.then = promise.then.bind(promise);
  query.catch = promise.catch.bind(promise);
  query.finally = promise.finally.bind(promise);

  return query;
};

beforeEach(() => {
  mocks.from.mockReset();
});

describe("fetchScheduledAppointments", () => {
  it("handles appointment types without a name", async () => {
    const appointmentTypesResponse: SupabaseResponse<any[]> = {
      data: [
        {
          id: "type-1",
          name: null,
          org_id: "org-123",
          is_active: true,
        },
      ],
      error: null,
    };

    const projectAppointmentsResponse: SupabaseResponse<any[]> = {
      data: [
        {
          id: "appt-1",
          project_id: "project-1",
          appointment_date: "2024-01-01",
          appointment_time: "09:00",
          appointment_type_id: "type-1",
          assignee_id: null,
          notes: null,
          status: null,
          completed_at: null,
          appointment_type: null,
          project: null,
        },
      ],
      error: null,
    };

    const leadsResponse: SupabaseResponse<any[]> = {
      data: [],
      error: null,
    };

    mocks.from.mockImplementation((table: string) => {
      if (table === "leads") {
        return createQuery(leadsResponse);
      }
      if (table === "appointment_types") {
        return createQuery(appointmentTypesResponse);
      }
      if (table === "project_appointments") {
        return createQuery(projectAppointmentsResponse);
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await fetchScheduledAppointments("org-123");

    expect(result).toHaveLength(1);
    expect(result[0].appointmentType).toEqual({ id: "type-1", name: null });
  });
});
