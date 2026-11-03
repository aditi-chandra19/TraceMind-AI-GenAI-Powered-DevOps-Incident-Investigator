import { afterAll, describe, expect, it } from "vitest";
import { app } from "./app.js";

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
afterAll(() => server.close());

describe("incident API", () => {
  it("reports health in demo mode", async () => { const response = await fetch(`${base}/api/health`); expect(response.status).toBe(200); expect((await response.json()).mode).toBe("demo"); });
  it("paginates and filters incidents", async () => { const response = await fetch(`${base}/api/incidents?severity=critical&page=1&limit=2`); const body = await response.json(); expect(body.pagination.total).toBe(1); expect(body.data[0].id).toBe("INC-2847"); });
  it("rejects invalid pagination", async () => { const response = await fetch(`${base}/api/incidents?page=0`); expect(response.status).toBe(400); });
  it("returns a useful 404 for an unknown incident", async () => { const response = await fetch(`${base}/api/incidents/INC-0000`); expect(response.status).toBe(404); });
});
