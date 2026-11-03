export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  duration: string;
  affectedUsers: string;
  summary: string;
  rootCause: string;
  confidence: number;
  signals: { label: string; value: number; color: string }[];
  timeline: { time: string; title: string; detail: string; kind: "alert" | "analysis" | "action" }[];
}
