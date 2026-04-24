"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

const inputSchema = z.object({
  patient_id: z
    .string()
    .describe("Patient ID to generate a weekly report for."),
  backend_url: z
    .string()
    .default("http://localhost:8080")
    .describe("MediCall backend base URL."),
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    "Generates a weekly report for a patient via the backend POST /api/trigger/weekly-report endpoint.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
