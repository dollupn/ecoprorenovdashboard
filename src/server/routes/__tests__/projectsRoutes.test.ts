import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../authentication.js", () => ({
  ensureAuthenticated: vi.fn((_req, _res, next) => next()),
}));

const utilsMock = vi.hoisted(() => ({
  getOrganizationId: vi.fn(() => "org-1"),
  handleRouteError: vi.fn((res, _error, message) =>
    res.status(500).json({ message }),
  ),
}));

vi.mock("../utils.js", () => utilsMock);

const serviceMocks = vi.hoisted(() => ({
  exportProjectBundle: vi.fn(),
  syncProjectToWebhook: vi.fn(),
  getProjectDetails: vi.fn(),
  updateProjectStatusService: vi.fn(),
}));

vi.mock("../../services/projectsService.js", () => serviceMocks);

import router from "../projects.js";

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/projects", router);
  return app;
};

describe("projects routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports project bundle via backup route", async () => {
    const app = createApp();
    serviceMocks.exportProjectBundle.mockResolvedValueOnce({ status: "ok" });

    const response = await request(app).post("/projects/123/backup/export");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(serviceMocks.exportProjectBundle).toHaveBeenCalledWith("org-1", "123");
  });

  it("syncs project via backup route", async () => {
    const app = createApp();
    serviceMocks.syncProjectToWebhook.mockResolvedValueOnce({ synced: true });

    const response = await request(app).post("/projects/456/backup/sync");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ synced: true });
    expect(serviceMocks.syncProjectToWebhook).toHaveBeenCalledWith("org-1", "456");
  });
});
