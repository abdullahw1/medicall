"use agent";

import { type Task, agent } from "@guildai/agents-sdk";
import { z } from "zod";

const inputSchema = z.object({
  command: z
    .string()
    .default("run calls")
    .describe("Invocation phrase. Kept for operator traceability."),
  backend_url: z
    .string()
    .default("http://localhost:8080")
    .describe("MediCall backend base URL."),
  demo_patient_only: z
    .boolean()
    .default(true)
    .describe("When true, only process the seed patient for demo reliability."),
});
type Input = z.infer<typeof inputSchema>;

const patientSchema = z.object({
  patient_id: z.string(),
  name: z.string(),
  medications: z.array(z.string()),
});
type Patient = z.infer<typeof patientSchema>;

const outputSchema = z.object({
  command: z.string(),
  backend_url: z.string(),
  processed_count: z.number(),
  summary: z.string(),
  results: z.array(
    z.object({
      patient_id: z.string(),
      patient_name: z.string(),
      fda_alert_count: z.number(),
      posted: z.boolean(),
      note: z.string(),
      alert_sent: z.boolean().optional(),
      call_id: z.string().optional(),
    }),
  ),
});
type Output = z.infer<typeof outputSchema>;

type Tools = Record<string, never>;

const SEED_PATIENT_ID = "11111111-1111-4111-8111-111111111111";

const safeJson = async <T>(
  response: Response,
  fallback: T,
): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
};

async function run(input: Input, _task: Task<Tools>): Promise<Output> {
  const baseUrl = input.backend_url.replace(/\/$/, "");
  const patientsRes = await fetch(`${baseUrl}/api/patients`);
  if (!patientsRes.ok) {
    throw new Error(
      `Failed to fetch patients: ${patientsRes.status} ${patientsRes.statusText}`,
    );
  }

  const rawPatients = await safeJson<unknown[]>(patientsRes, []);
  const parsedPatients = rawPatients
    .map((row) => patientSchema.safeParse(row))
    .filter((p) => p.success)
    .map((p) => p.data);

  const patientsToProcess: Patient[] = input.demo_patient_only
    ? parsedPatients.filter((p) => p.patient_id === SEED_PATIENT_ID)
    : parsedPatients;

  const results: Output["results"] = [];
  for (const patient of patientsToProcess) {
    let fdaAlerts: string[] = [];
    let note = "Posted simulated fallback call result.";

    try {
      const fdaRes = await fetch(
        `${baseUrl}/api/tinyfish/fda-alerts/${patient.patient_id}`,
      );
      if (fdaRes.ok) {
        const payload = await safeJson<{ alerts?: string[] }>(fdaRes, {});
        fdaAlerts = Array.isArray(payload.alerts) ? payload.alerts : [];
      } else {
        note = `FDA alert fetch failed (${fdaRes.status}); using empty alerts.`;
      }
    } catch {
      note = "FDA alert fetch failed (network); using empty alerts.";
    }

    const outboundRes = await fetch(`${baseUrl}/api/vapi-outbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patient.patient_id }),
    });

    if (!outboundRes.ok) {
      await safeJson<Record<string, unknown>>(outboundRes, {});
      results.push({
        patient_id: patient.patient_id,
        patient_name: patient.name,
        fda_alert_count: fdaAlerts.length,
        posted: false,
        note: `${note} Outbound call initiation failed (${outboundRes.status}).`,
      });
      continue;
    }

    const outboundPayload = await safeJson<{
      call_id?: string;
      provider?: "vapi" | "mock";
    }>(
      outboundRes,
      {},
    );

    // In mock provider mode, immediately emulate a completion webhook so the
    // downstream alerting/dashboard path runs in one deterministic execution.
    let webhookResult:
      | { call_id?: string; result?: { alert_sent?: boolean } }
      | undefined;
    if (outboundPayload.call_id && outboundPayload.provider === "mock") {
      const webhookRes = await fetch(`${baseUrl}/api/vapi-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: outboundPayload.call_id,
          transcript:
            "Fallback: Vapi unavailable during automated run. Simulated successful call completion.",
          call_status: "completed",
        }),
      });
      webhookResult = await safeJson(webhookRes, {});
    }
    results.push({
      patient_id: patient.patient_id,
      patient_name: patient.name,
      fda_alert_count: fdaAlerts.length,
      posted: true,
      note:
        outboundPayload.provider === "mock"
          ? `${note} Mock provider completed through webhook fallback.`
          : "Vapi outbound queued; awaiting webhook completion.",
      call_id: outboundPayload.call_id ?? webhookResult?.call_id,
      alert_sent: webhookResult?.result?.alert_sent ?? false,
    });
  }

  return {
    command: input.command,
    backend_url: baseUrl,
    processed_count: results.length,
    summary: `Processed ${results.length} patient(s).`,
    results,
  };
}

export default agent({
  description:
    "Runs MediCall's daily backend-aligned call pipeline: fetches patients, loads FDA context, and posts deterministic call results for dashboard/escalation workflows.",
  inputSchema,
  outputSchema,
  tools: {},
  run,
});
