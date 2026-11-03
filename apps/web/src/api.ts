import type { Incident } from "./types";
import { demoIncidents } from "./data/demo";
const base = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
export async function getIncidents(): Promise<{ data: Incident[]; mode: "api" | "demo" }> {
  try { const response = await fetch(`${base}/incidents?limit=100`, { signal: AbortSignal.timeout(1800) }); if (!response.ok) throw new Error("API request failed"); const result = await response.json(); return { data: result.data, mode: "api" }; }
  catch { return { data: demoIncidents, mode: "demo" }; }
}
