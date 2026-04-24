"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

const DEFAULT_MEDICALL_BACKEND_URL = "https://medicall-5v26.onrender.com";

const inputSchema = z.object({
  patient_id: z
    .string()
    .describe("Patient ID to run alert escalation check for."),
  backend_url: z
    .string()
    .default(DEFAULT_MEDICALL_BACKEND_URL)
    .describe(
      "MediCall backend base URL (defaults to production Render; use http://localhost:8080 for local).",
    ),
});
type Input = z.infer<typeof inputSchema>;

const alertDeliverySchema = z
  .object({
    channel: z.string(),
    recipient: z.string(),
    status: z.string(),
  })
  .passthrough();

const alertCheckResponseSchema = z.object({
  patient_id: z.string(),
  escalated: z.boolean(),
  recent_calls_checked: z.number(),
  deliveries: z.array(alertDeliverySchema),
});

const outputSchema = z.object({
  patient_id: z.string(),
  escalated: z.boolean(),
  recent_calls_checked: z.number(),
  deliveries: z.array(alertDeliverySchema),
  summary: z.string(),
});
type Output = z.infer<typeof outputSchema>;

type Tools = Record<string, never>;

async function run(input: Input, _task: Task<Tools>): Promise<Output> {
  const baseUrl = input.backend_url.replace(/\/$/, "");
  const url = `${baseUrl}/api/trigger/alert-check`;

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
      `Alert check request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
    );
  }

  const data = alertCheckResponseSchema.parse(await response.json());

  return {
    patient_id: data.patient_id,
    escalated: data.escalated,
    recent_calls_checked: data.recent_calls_checked,
    deliveries: data.deliveries,
    summary: `Alert check for patient ${data.patient_id}: escalated=${data.escalated}, checked ${data.recent_calls_checked} recent call(s).`,
  };
}

export default agent({
  description:
    "MediCall alert escalation: POST /api/trigger/alert-check on the deployed backend (defaults to Render). Evaluates recent calls and notification delivery.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
