import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
    auth: {
      getUser: mocks.getUserMock,
    },
  },
}));

import {
  inviteMember,
  mapMemberRoleToAppRole,
  upsertUserRole,
  updateMemberRole,
  deleteMember,
} from "./api";
import { supabase } from "@/integrations/supabase/client";

beforeEach(() => {
  mocks.fromMock.mockReset();
  mocks.rpcMock.mockReset();
  mocks.getUserMock.mockReset();
});

describe("mapMemberRoleToAppRole", () => {
  it("maps membership roles to application roles understood by RLS", () => {
    expect(mapMemberRoleToAppRole("owner")).toBe("admin");
    expect(mapMemberRoleToAppRole("admin")).toBe("admin");
    expect(mapMemberRoleToAppRole("commercial")).toBe("commercial");
    expect(mapMemberRoleToAppRole("member")).toBe("user");
  });
});

describe("role synchronization", () => {
  it("upserts an admin user role enabling admin-only policies", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const leadsSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.fromMock.mockImplementation((table) => {
      if (table === "user_roles") {
        return {
          upsert: upsertMock,
          delete: vi.fn(),
          match: vi.fn(),
        } as any;
      }
      if (table === "leads") {
        return {
          select: leadsSelectMock,
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const appRole = await upsertUserRole("org-1", "user-1", "admin");

    expect(appRole).toBe("admin");
    expect(upsertMock).toHaveBeenCalledWith(
      {
        org_id: "org-1",
        user_id: "user-1",
        role: "admin",
      },
      { onConflict: "user_id,org_id" }
    );

    await supabase.from("leads").select("*");
    expect(leadsSelectMock).toHaveBeenCalledWith("*");
  });

  it("invites a member and synchronizes memberships with user roles", async () => {
    const membershipUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const roleUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const leadsSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.fromMock.mockImplementation((table) => {
      if (table === "memberships") {
        return {
          upsert: membershipUpsertMock,
        } as any;
      }
      if (table === "user_roles") {
        return {
          upsert: roleUpsertMock,
          delete: vi.fn(),
          match: vi.fn(),
        } as any;
      }
      if (table === "leads") {
        return {
          select: leadsSelectMock,
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    mocks.rpcMock.mockResolvedValueOnce({ data: "user-42", error: null });
    mocks.getUserMock.mockResolvedValue({ data: { user: { id: "inviter-1" } }, error: null } as any);

    const result = await inviteMember({
      email: "admin@example.com",
      orgId: "org-1",
      role: "admin",
    });

    expect(result.appRole).toBe("admin");
    expect(result.userId).toBe("user-42");

    expect(mocks.rpcMock).toHaveBeenCalledWith("lookup_user_id_by_email", { email: "admin@example.com" });
    expect(membershipUpsertMock).toHaveBeenCalledWith(
      {
        org_id: "org-1",
        user_id: "user-42",
        role: "admin",
        invited_by: "inviter-1",
      },
      { onConflict: "org_id,user_id" }
    );
    expect(roleUpsertMock).toHaveBeenCalledWith(
      {
        org_id: "org-1",
        user_id: "user-42",
        role: "admin",
      },
      { onConflict: "user_id,org_id" }
    );

    await supabase.from("leads").select("*");
    expect(leadsSelectMock).toHaveBeenCalledWith("*");
  });

  it("updates a membership role and mirrors the change in user roles", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const roleUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mocks.fromMock.mockImplementation((table) => {
      if (table === "memberships") {
        return {
          update: () => ({
            match: updateMock,
          }),
          delete: vi.fn(),
          match: vi.fn(),
        } as any;
      }
      if (table === "user_roles") {
        return {
          upsert: roleUpsertMock,
          delete: vi.fn(),
          match: vi.fn(),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { appRole } = await updateMemberRole({
      orgId: "org-1",
      userId: "user-1",
      role: "commercial",
    });

    expect(appRole).toBe("commercial");
    expect(updateMock).toHaveBeenCalledWith({ org_id: "org-1", user_id: "user-1" });
    expect(roleUpsertMock).toHaveBeenCalledWith(
      {
        org_id: "org-1",
        user_id: "user-1",
        role: "commercial",
      },
      { onConflict: "user_id,org_id" }
    );
  });

  it("removes user role entries when memberships are deleted", async () => {
    const membershipDeleteMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const roleDeleteMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mocks.fromMock.mockImplementation((table) => {
      if (table === "memberships") {
        return {
          delete: () => ({
            match: membershipDeleteMock,
          }),
          update: vi.fn(),
          match: vi.fn(),
        } as any;
      }
      if (table === "user_roles") {
        return {
          upsert: vi.fn(),
          delete: () => ({
            match: roleDeleteMock,
          }),
          match: vi.fn(),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await deleteMember({ orgId: "org-1", userId: "user-9" });

    expect(membershipDeleteMock).toHaveBeenCalledWith({ org_id: "org-1", user_id: "user-9" });
    expect(roleDeleteMock).toHaveBeenCalledWith({ org_id: "org-1", user_id: "user-9" });
  });
});
