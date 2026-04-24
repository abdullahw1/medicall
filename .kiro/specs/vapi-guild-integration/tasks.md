# Implementation Plan: Vapi + Guild.ai Integration

## Overview

Integrate Vapi outbound voice calls and Guild.ai orchestration into the existing MediCall Express backend. Guild.ai first (it's the orchestration brain), then Vapi as the tool it calls. Vapi's built-in LLM handles both the patient conversation AND transcript classification via `analysisPlan` — no separate classifier needed.

## Tasks

- [x] 1. Guild.ai agent setup and pipeline orchestrator
  - [x] 1.1 Initialize the Guild.ai agent project
    - Run `guild agent init --name medicall-call-agent --template LLM` in a new directory outside MediCall (Guild agents are standalone projects)
    - Write the `agent.ts` file using `llmAgent` from `@guildai/agents-sdk` with a system prompt that describes the MediCall daily call pipeline
    - The agent should accept a trigger message (e.g., "run calls") and execute the pipeline: fetch patients → fetch FDA alerts → initiate Vapi calls
    - Export a standalone `runCallPipeline(backendUrl: string)` async function that works with or without Guild.ai (fallback for scheduler failure)
    - Save and publish: `guild agent save --message "Initial medicall-call-agent" --wait --publish`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1_

  - [x] 1.2 Configure Guild.ai daily trigger and manual trigger
    - Create daily time trigger: `guild trigger create --type time --frequency DAILY --time 08:00 --agent medicall-call-agent`
    - Verify manual trigger works via `guild agent test` or `guild agent chat "run calls"` for demo use
    - _Requirements: 6.2, 7.1, 7.2_

- [ ] 2. Vapi service, config, and call ID mapping
  - [ ] 2.1 Add Vapi config to `src/config.ts` and call ID map to `src/store.ts`
    - Add `vapiPrivateKey`, `vapiPublicKey`, and `vapiApiUrl` to the config object in `MediCall/src/config.ts`
    - Add `callIdMap: Map<string, CallMapping>` to `MediCall/src/store.ts` with `setCallMapping(vapiCallId, patientId, fdaAlerts)` and `getCallMapping(vapiCallId)` helpers. `CallMapping` stores `{ patientId: string, fdaAlerts: string[] }`
    - Update `MediCall/.env.example` to document the Vapi env vars
    - _Requirements: 1.1, 1.4, 2.3_

  - [ ] 2.2 Create `src/services/vapi.ts` — Vapi outbound call with AI assistant and analysisPlan
    - Implement `createOutboundCall(req: VapiCallRequest): Promise<VapiCallResponse>` that POSTs to `{vapiApiUrl}/call` with `Authorization: Bearer <vapiPrivateKey>`
    - Use a transient inline `assistant` object with: model `gpt-4o-mini`, provider `openai`, a system prompt built by `buildAssistantPrompt(patientName, medications, fdaAlerts)` that instructs the LLM to greet by name, ask about each medication, check wellbeing, mention FDA alerts if any, and use elder-friendly language
    - Configure `assistant.analysisPlan.structuredDataPlan` with a JSON schema for `{ status: "took_meds"|"missed_meds"|"no_answer"|"concern", flags: string[] }` and classification rules so Vapi's LLM classifies the call outcome automatically at call end
    - Set `assistant.serverUrl` to `{APP_URL}/api/vapi-webhook` and `customer.number` to the patient phone
    - 10-second fetch timeout; throw on failure to trigger fallback in the pipeline
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

  - [ ]* 2.3 Write property tests for prompt builder and call ID mapping
    - **Property 1**: Generate random (name, medications[], fdaAlerts[]) → verify `buildAssistantPrompt` output contains the name, every medication, and every FDA alert
    - **Property 2**: Generate random (callId, patientId, fdaAlerts[]) → verify `setCallMapping` + `getCallMapping` round-trip returns original values
    - Install `fast-check` and `vitest` as devDependencies if not present
    - **Validates: Requirements 1.2, 1.4, 2.3, 5.2**

- [ ] 3. Vapi webhook endpoint and pipeline integration
  - [ ] 3.1 Add `POST /api/vapi-webhook` endpoint to `src/routes/api.ts`
    - Only process payloads where `message.type === "end-of-call-report"`; respond 200 to all other types
    - Extract `message.call.id`, `message.artifact.transcript`, and `message.analysis.structuredData` (contains `{ status, flags }` from Vapi's LLM classification)
    - Look up patientId and fdaAlerts via `getCallMapping(callId)`; if not found, respond 404 and log warning
    - Read `status` and `flags` directly from `structuredData` — no separate classifier needed since Vapi's LLM already did it
    - If `structuredData` is missing or has invalid status, default to `missed_meds` with empty flags
    - If `endedReason` is `"no-answer"` or `"voicemail"`, override status to `no_answer`
    - Build call result payload (patient_id, timestamp as ISO 8601, status, transcript, flags, fda_alerts from stored mapping) and call `addCallResult` directly or POST to `/api/call-results`
    - Respond 200 to Vapi
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.4, 5.2_

  - [ ] 3.2 Wire fallback mode into the pipeline orchestrator
    - In `runCallPipeline`: if `createOutboundCall` throws (Vapi down/timeout), inject fallback transcript with `status: "took_meds"`, `transcript: "Fallback: Vapi unavailable. Simulated successful call."`, `flags: []`, and POST directly to `/api/call-results`
    - If FDA alert fetch fails, proceed with empty `fda_alerts` array and log the failure
    - Log `console.warn` when any fallback activates
    - _Requirements: 8.1, 8.2, 8.3, 5.3, 4.2, 4.3_

- [ ] 4. Demo readiness and documentation
  - [ ] 4.1 Update README with Person 1 integration docs
    - Document Guild.ai manual trigger command (`guild agent chat "run calls"`) as primary demo trigger and scheduler fallback
    - Document Vapi fallback behavior
    - Document required env vars (vapi-private-key, vapi-public-key, VAPI_API_URL)
    - Add Person 1 scope section to match Person 2's existing section
    - _Requirements: 9.2, 10.1_

  - [ ] 4.2 End-to-end verification
    - Verify full pipeline: Guild trigger → FDA fetch → Vapi call → AI conversation → LLM classification → webhook → call result on dashboard — for seed patient Margaret Ellis
    - Verify concern scenario: patient says "I feel dizzy" → Vapi LLM classifies as `concern` with `flags: ["dizziness"]` → `alert_sent: true` on dashboard
    - Verify FDA alert scenario: Metformin alert appears in call context and persists in `fda_alerts` field
    - Verify Vapi fallback: disconnect Vapi → fallback transcript posted → dashboard shows result
    - _Requirements: 10.1, 10.2, 10.3_

## Notes

- Tasks marked with `*` are optional property-based tests — skip if tight on time
- Guild.ai first (Task 1), then Vapi (Task 2), then wire them together (Task 3), then verify (Task 4)
- No separate classifier module — Vapi's `analysisPlan.structuredDataPlan` handles classification via its built-in LLM
- The `runCallPipeline` function works standalone without Guild.ai as a fallback
