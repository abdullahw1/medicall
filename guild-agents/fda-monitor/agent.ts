"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

const DEFAULT_MEDICALL_BACKEND_URL = "https://medicall-5v26.onrender.com";

const inputSchema = z.object({
  patient_id: z
    .string()
    .describe("Patient ID to check for FDA alerts."),
  backend_url: z
    .string()
    .default(DEFAULT_MEDICALL_BACKEND_URL)
    .describe(
      "MediCall backend base URL (defaults to production Render; use http://localhost:8080 for local).",
    ),
});
type Input = z.infer<typeof inputSchema>;

const fdaResponseSchema = z.object({
  patient_id: z.string(),
  matched_count: z.number(),
  alerts: z.array(z.string()),
});

const outputSchema = z.object({
  patient_id: z.string(),
  matched_count: z.number(),
  alerts: z.array(z.string()),
  summary: z.string(),
});
type Output = z.infer<typeof outputSchema>;

type Tools = Record<string, never>;

async function run(input: Input, _task: Task<Tools>): Promise<Output> {
  const baseUrl = input.backend_url.replace(/\/$/, "");
  const url = `${baseUrl}/api/trigger/fda-monitor`;

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ patient_id: input.patient_id }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `FDA monitor request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
    );
  }

  const data = fdaResponseSchema.parse(await response.json());

  return {
    patient_id: data.patient_id,
    matched_count: data.matched_count,
    alerts: data.alerts,
    summary: `Found ${data.matched_count} FDA alert(s) for patient ${data.patient_id}.`,
  };
}

export default agent({
  description:
    "MediCall FDA monitor: POST /api/trigger/fda-monitor on the deployed backend (defaults to Render). Matches live FDA-style feed data to the patient's medication list.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
