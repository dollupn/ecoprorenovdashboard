import { describe, expect, it, beforeEach, vi } from "vitest";

import { updateProjectStatusService } from "../../services/projectsService";
import * as projectRepository from "../../repositories/projectRepository";
import type { ProjectRow } from "../../repositories/projectRepository";

vi.mock("../../repositories/projectRepository", () => ({
  fetchProjectById: vi.fn(),
  fetchChantiersForProject: vi.fn(),
  fetchQuotesForProject: vi.fn(),
  fetchInvoicesForProject: vi.fn(),
  updateProjectStatus: vi.fn(),
  updateChantiersStatusForProject: vi.fn(),
}));

describe("updateProjectStatusService", () => {
  const orgId = "org-1";
  const projectId = "project-1";

  const fetchProjectById = vi.mocked(projectRepository.fetchProjectById);
  const fetchChantiersForProject = vi.mocked(projectRepository.fetchChantiersForProject);
  const updateProjectStatus = vi.mocked(projectRepository.updateProjectStatus);
  const updateChantiersStatusForProject = vi.mocked(
    projectRepository.updateChantiersStatusForProject,
  );

  beforeEach(() => {
    vi.clearAllMocks();

    fetchProjectById.mockResolvedValue({
      id: projectId,
      org_id: orgId,
      status: "NOUVEAU",
    } as ProjectRow);

    fetchChantiersForProject.mockResolvedValue([]);

    updateProjectStatus.mockImplementation(async (_id, _org, status) => ({
      id: projectId,
      org_id: orgId,
      status,
    } as ProjectRow));

    updateChantiersStatusForProject.mockResolvedValue([]);
  });

  it("updates both project and associated chantiers", async () => {
    const result = await updateProjectStatusService(orgId, projectId, "EN_COURS");

    expect(updateProjectStatus).toHaveBeenCalledTimes(1);
    expect(updateProjectStatus).toHaveBeenCalledWith(projectId, orgId, "EN_COURS");
    expect(updateChantiersStatusForProject).toHaveBeenCalledWith(projectId, orgId, "EN_COURS");
    expect(result.project.status).toBe("EN_COURS");
  });

  it("rolls back the project status if chantier update fails", async () => {
    const failure = new Error("chantier update failed");

    updateChantiersStatusForProject.mockRejectedValueOnce(failure);

    updateProjectStatus
      .mockResolvedValueOnce({ id: projectId, org_id: orgId, status: "EN_COURS" } as ProjectRow)
      .mockResolvedValueOnce({ id: projectId, org_id: orgId, status: "NOUVEAU" } as ProjectRow);

    await expect(updateProjectStatusService(orgId, projectId, "EN_COURS")).rejects.toThrow(failure);

    expect(updateProjectStatus).toHaveBeenCalledTimes(2);
    expect(updateProjectStatus).toHaveBeenNthCalledWith(1, projectId, orgId, "EN_COURS");
    expect(updateProjectStatus).toHaveBeenNthCalledWith(2, projectId, orgId, "NOUVEAU");
  });
});
