"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

/** Production MediCall API (Render). Override `backend_url` only for local dev. */
const DEFAULT_MEDICALL_BACKEND_URL = "https://medicall-5v26.onrender.com";

const inputSchema = z.object({
  command: z
    .string()
    .default("run pipeline")
    .describe("Invocation phrase. Kept for operator traceability."),
  backend_url: z
    .string()
    .default(DEFAULT_MEDICALL_BACKEND_URL)
    .describe(
      "MediCall backend base URL (defaults to production Render; set http://localhost:8080 for local dev).",
    ),
  patient_id: z
    .string()
    .optional()
    .describe("Optional patient ID to run pipeline for a single patient."),
});
type Input = z.infer<typeof inputSchema>;

const pipelineResultSchema = z.object({
  triggered: z.number(),
  results: z.array(
    z.object({
      patient_id: z.string(),
      call_id: z.string().optional(),
      provider: z.string().optional(),
      status: z.string(),
    }),
  ),
});

const outputSchema = z.object({
  command: z.string(),
  backend_url: z.string(),
  triggered: z.number(),
  summary: z.string(),
  results: z.array(
    z.object({
      patient_id: z.string(),
      call_id: z.string().optional(),
      provider: z.string().optional(),
      status: z.string(),
    }),
  ),
});
type Output = z.infer<typeof outputSchema>;

type Tools = Record<string, never>;

async function run(input: Input, _task: Task<Tools>): Promise<Output> {
  const baseUrl = input.backend_url.replace(/\/$/, "");
  const url = `${baseUrl}/api/run-pipeline`;

  const body: Record<string, string> = {};
  if (input.patient_id) {
    body.patient_id = input.patient_id;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Pipeline request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
    );
  }

  const data = pipelineResultSchema.parse(await response.json());

  return {
    command: input.command,
    backend_url: baseUrl,
    triggered: data.triggered,
    summary: `Pipeline triggered ${data.triggered} call(s).`,
    results: data.results,
  };
}

export default agent({
  description:
    "Triggers MediCall's call pipeline via POST /api/run-pipeline on the deployed backend (defaults to https://medicall-5v26.onrender.com). Pass backend_url to hit a different environment.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
