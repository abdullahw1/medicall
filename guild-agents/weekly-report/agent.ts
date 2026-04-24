"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

const DEFAULT_MEDICALL_BACKEND_URL = "https://medicall-5v26.onrender.com";

const inputSchema = z.object({
  patient_id: z
    .string()
    .describe("Patient ID to generate a weekly report for."),
  backend_url: z
    .string()
    .default(DEFAULT_MEDICALL_BACKEND_URL)
    .describe(
      "MediCall backend base URL (defaults to production Render; use http://localhost:8080 for local).",
    ),
});
type Input = z.infer<typeof inputSchema>;

const weeklyReportResponseSchema = z.object({
  patient_id: z.string(),
  summary: z.record(z.string(), z.unknown()),
});

const outputSchema = z.object({
  patient_id: z.string(),
  report: z.record(z.string(), z.unknown()),
  summary: z.string(),
});
type Output = z.infer<typeof outputSchema>;

type Tools = Record<string, never>;

async function run(input: Input, _task: Task<Tools>): Promise<Output> {
  const baseUrl = input.backend_url.replace(/\/$/, "");
  const url = `${baseUrl}/api/trigger/weekly-report`;

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
      `Weekly report request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
    );
  }

  const data = weeklyReportResponseSchema.parse(await response.json());

  return {
    patient_id: data.patient_id,
    report: data.summary,
    summary: `Weekly report generated for patient ${data.patient_id}.`,
  };
}

export default agent({
  description:
    "MediCall weekly report: POST /api/trigger/weekly-report on the deployed backend (defaults to Render). Produces caregiver-facing compliance summary JSON.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
