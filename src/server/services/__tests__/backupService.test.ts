import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportOrganizationBackup, testBackupWebhook } from "../../services/backupService.js";
import * as projectRepository from "../../repositories/projectRepository.js";
import type { ProjectWithRelations } from "../../repositories/projectRepository.js";
import { ValidationError } from "../../errors.js";

vi.mock("../../repositories/projectRepository", () => ({
  fetchProjectsPage: vi.fn(),
}));

describe("backupService", () => {
  const originalFetch = global.fetch;
  const fetchProjectsPage = vi.mocked(projectRepository.fetchProjectsPage);

  beforeEach(() => {
    fetchProjectsPage.mockReset();
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const createProject = (id: number): ProjectWithRelations =>
    ({
      id: `project-${id}`,
      org_id: "org-1",
      created_at: new Date().toISOString(),
      status: "NOUVEAU",
      title: `Projet ${id}`,
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      sites: [],
      quotes: [],
      invoices: [],
    } as unknown as ProjectWithRelations);

  it("chunks projects and sends webhook payloads", async () => {
    const firstBatch = Array.from({ length: 50 }, (_value, index) => createProject(index + 1));
    const secondBatch = Array.from({ length: 50 }, (_value, index) => createProject(index + 51));
    const finalBatch = Array.from({ length: 20 }, (_value, index) => createProject(index + 101));

    fetchProjectsPage
      .mockResolvedValueOnce({ data: firstBatch, count: 120 })
      .mockResolvedValueOnce({ data: secondBatch, count: 120 })
      .mockResolvedValueOnce({ data: finalBatch, count: 120 });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await exportOrganizationBackup("org-1", "https://example.com/webhook");

    expect(fetchProjectsPage).toHaveBeenCalledTimes(3);
    expect(fetchProjectsPage).toHaveBeenNthCalledWith(1, "org-1", 0, 49);
    expect(fetchProjectsPage).toHaveBeenNthCalledWith(2, "org-1", 50, 99);
    expect(fetchProjectsPage).toHaveBeenNthCalledWith(3, "org-1", 100, 149);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const payloads = fetchMock.mock.calls.map(([, options]) => JSON.parse(String(options?.body)));

    expect(payloads).toHaveLength(3);
    expect(payloads[0].meta.chunkIndex).toBe(1);
    expect(payloads[0].meta.totalChunks).toBe(3);
    expect(payloads[0].meta.count).toBe(50);
    expect(payloads[1].meta.chunkIndex).toBe(2);
    expect(payloads[2].meta.chunkIndex).toBe(3);
    expect(payloads[2].meta.count).toBe(20);

    expect(result.totalChunks).toBe(3);
    expect(result.totalProjects).toBe(120);
    expect(result.success).toBe(true);
  });

  it("records failed chunks when webhook remains unreachable", async () => {
    const projects = Array.from({ length: 10 }, (_value, index) => createProject(index + 1));

    fetchProjectsPage
      .mockResolvedValueOnce({ data: projects, count: 10 })
      .mockResolvedValueOnce({ data: [], count: 10 });

    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await exportOrganizationBackup("org-1", "https://example.com/webhook", { chunkSize: 5 });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.failedChunks).toHaveLength(2);
    expect(result.success).toBe(false);
  });

  it("validates webhook URL on test", async () => {
    await expect(testBackupWebhook("not-a-url" as unknown as string)).rejects.toBeInstanceOf(ValidationError);
  });

  it("sends test payload to webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await testBackupWebhook("https://example.com/webhook");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    const body = JSON.parse(String(options?.body));
    expect(body.ping).toBe(true);
    expect(body.app).toBe("EcoProRenov");
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });
});
