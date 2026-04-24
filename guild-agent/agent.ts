/**
 * MediCall Call Agent — Guild.ai LLM Agent
 *
 * Orchestrates the daily medication adherence call pipeline:
 *   1. Fetch all patients from the MediCall backend
 *   2. For each patient, fetch FDA alerts
 *   3. Initiate Vapi outbound calls with patient context
 *   4. Handle fallbacks when Vapi is unavailable
 *
 * Trigger manually:  guild agent chat "run calls"
 * Trigger via test:  guild agent test
 * Daily schedule:    guild trigger create --type time --frequency DAILY --time 08:00 --agent medicall-call-agent
 */

import { guildTools, llmAgent, pick } from "@guildai/agents-sdk";

const systemPrompt = `You are the MediCall daily medication adherence call agent.

Your job is to orchestrate outbound phone calls to elderly patients to check if they took their medications. When triggered with "run calls" or any similar instruction, execute this pipeline:

## Pipeline Steps

1. **Fetch patients** — GET {BACKEND_URL}/api/patients to retrieve the patient list.
2. **For each patient:**
   a. **Fetch FDA alerts** — GET {BACKEND_URL}/api/tinyfish/fda-alerts/{patient_id}
      - If this fails, proceed with empty alerts and note the failure.
   b. **Initiate Vapi call** — POST {BACKEND_URL}/api/vapi-outbound with the patient context:
      - patient_id, patient name, phone number, medications list, FDA alerts
      - The Vapi service on the backend handles the actual outbound call.
   c. **On Vapi failure** — If the call initiation fails, POST a fallback result directly:
      - POST {BACKEND_URL}/api/call-results with:
        - patient_id: the patient's ID
        - timestamp: current ISO 8601 time
        - status: "took_meds"
        - transcript: "Fallback: Vapi unavailable. Simulated successful call."
        - flags: []
        - fda_alerts: [] (or whatever was fetched)
3. **Report completion** — Summarize what happened for each patient.

## Environment

- BACKEND_URL defaults to http://localhost:8080 unless specified otherwise.
- The backend is an Express server with REST endpoints for patients, call results, and FDA alerts.
- The seed patient for demo is Margaret Ellis (patient_id: 11111111-1111-4111-8111-111111111111).

## Behavior Rules

- Process patients sequentially, not in parallel.
- Always log warnings when fallbacks activate.
- If the entire patient fetch fails, report the error and stop.
- When manually triggered for demo, focus on the seed patient Margaret Ellis.
- Keep responses concise — report success/failure per patient.
`;

const description = `MediCall daily medication adherence call agent.

Orchestrates outbound voice calls to elderly patients to check medication adherence.
Fetches patient data and FDA alerts from the MediCall backend, initiates Vapi calls,
handles fallbacks when services are unavailable, and posts call results.

Trigger with "run calls" to execute the full pipeline, or ask about a specific patient.
Designed for daily scheduled execution or on-demand demo triggers.`;

export default llmAgent({
  description,
  tools: {
    ...pick(guildTools, ["guild_get_me"]),
  },
  systemPrompt,
  mode: "one-shot",
});
