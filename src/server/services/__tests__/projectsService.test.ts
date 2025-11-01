import { describe, expect, it, beforeEach, vi } from "vitest";

import { updateProjectStatusService } from "../../services/projectsService";
import * as projectRepository from "../../repositories/projectRepository";
import type { ProjectRow } from "../../repositories/projectRepository";

vi.mock("../../repositories/projectRepository", () => ({
  fetchProjectById: vi.fn(),
  fetchQuotesForProject: vi.fn(),
  fetchInvoicesForProject: vi.fn(),
  updateProjectStatus: vi.fn(),
}));

describe("updateProjectStatusService", () => {
  const orgId = "org-1";
  const projectId = "project-1";

  const fetchProjectById = vi.mocked(projectRepository.fetchProjectById);
  const updateProjectStatus = vi.mocked(projectRepository.updateProjectStatus);

  beforeEach(() => {
    vi.clearAllMocks();

    fetchProjectById.mockResolvedValue({
      id: projectId,
      org_id: orgId,
      status: "NOUVEAU",
    } as ProjectRow);

    updateProjectStatus.mockImplementation(async (_id, _org, status) => ({
      id: projectId,
      org_id: orgId,
      status,
    } as ProjectRow));
  });

  it("updates the project status", async () => {
    const result = await updateProjectStatusService(orgId, projectId, "EN_COURS");

    expect(updateProjectStatus).toHaveBeenCalledTimes(1);
    expect(updateProjectStatus).toHaveBeenCalledWith(projectId, orgId, "EN_COURS");
    expect(result.project.status).toBe("EN_COURS");
  });
});
