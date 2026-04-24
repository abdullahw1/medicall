"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

const inputSchema = z.object({
  patient_id: z
    .string()
    .describe("Patient ID to run alert escalation check for."),
  backend_url: z
    .string()
    .default("http://localhost:8080")
    .describe("MediCall backend base URL."),
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    "Runs an alert escalation check for a patient via the backend POST /api/trigger/alert-check endpoint.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
