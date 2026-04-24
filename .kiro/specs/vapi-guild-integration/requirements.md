# Requirements Document

## Introduction

This document defines the requirements for Person 1's scope of the MediCall hackathon project: integrating Vapi outbound voice calls and Guild.ai orchestration into the existing Express backend built by Person 2. The integration must enable autonomous daily medication adherence calls to elderly patients, classify call outcomes, POST results to the existing `/api/call-results` endpoint, and be demo-ready within a 3-hour build window.

## Glossary

- **Call_Agent**: The Guild.ai LLM agent responsible for initiating outbound Vapi calls, receiving transcript webhooks, classifying call status, and posting results to the Backend.
- **Backend**: The existing Express server (Person 2's code) exposing REST endpoints at `/api/*` for patients, call results, FDA alerts, and weekly reports.
- **Vapi_Service**: The Vapi platform providing STT, LLM, TTS, telephony, and transcript webhook delivery for outbound voice calls.
- **Guild_Scheduler**: The Guild.ai trigger system that initiates agent execution on a time-based or manual schedule.
- **Transcript_Classifier**: The logic within Call_Agent that maps a raw call transcript to one of the four canonical statuses: `took_meds`, `missed_meds`, `no_answer`, or `concern`.
- **Call_Result**: The canonical data object defined in `src/types.ts` containing `patient_id`, `timestamp`, `status`, `transcript`, `flags`, `fda_alerts`, and `alert_sent`.
- **FDA_Alert**: A medication safety or recall notice fetched from the TinyFish endpoint and injected into call context.
- **Patient**: A person record from the Backend store containing name, phone, medications, caregiver contacts, call time, and timezone.
- **Webhook_Endpoint**: A new Express route on the Backend that receives Vapi's end-of-call payload and triggers Call_Agent processing.
- **Fallback_Transcript**: A static pre-recorded transcript used when Vapi_Service is unreachable, allowing the downstream pipeline to continue.

## Requirements

### Requirement 1: Vapi Outbound Call Initiation

**User Story:** As the MediCall system, I want to place outbound voice calls to patients via Vapi, so that medication adherence can be checked without requiring patient-initiated action.

#### Acceptance Criteria

1. WHEN the Call_Agent is triggered for a Patient, THE Call_Agent SHALL initiate an outbound call to the Patient phone number via the Vapi_Service REST API using the configured private API key.
2. WHEN initiating a call, THE Call_Agent SHALL include the Patient name, Patient medications list, and any FDA_Alert items in the Vapi assistant system prompt so the voice agent has full context.
3. THE Vapi_Service assistant prompt SHALL instruct the voice agent to greet the Patient by name, ask whether each medication was taken today, ask about general wellbeing, and use plain elder-friendly language.
4. WHEN the Vapi_Service returns a call ID after initiation, THE Call_Agent SHALL store the call ID mapped to the Patient patient_id for later correlation with the transcript webhook.

### Requirement 2: Vapi Transcript Webhook Reception

**User Story:** As the MediCall system, I want to receive completed call transcripts from Vapi via webhook, so that call outcomes can be processed and persisted.

#### Acceptance Criteria

1. THE Backend SHALL expose a `POST /api/vapi-webhook` endpoint that accepts Vapi end-of-call webhook payloads.
2. WHEN the Vapi_Service delivers a webhook payload to the Webhook_Endpoint, THE Webhook_Endpoint SHALL extract the transcript text and the Vapi call ID from the payload.
3. WHEN a webhook payload is received, THE Webhook_Endpoint SHALL correlate the Vapi call ID to the originating Patient patient_id using the mapping stored during call initiation.
4. IF the Webhook_Endpoint receives a payload with an unrecognized call ID, THEN THE Webhook_Endpoint SHALL respond with HTTP 404 and log the unrecognized call ID.

### Requirement 3: Transcript Classification

**User Story:** As the MediCall system, I want to classify each call transcript into a canonical status, so that downstream alerting and reporting use consistent categories.

#### Acceptance Criteria

1. WHEN a transcript is received from the Webhook_Endpoint, THE Transcript_Classifier SHALL classify the transcript into exactly one of: `took_meds`, `missed_meds`, `no_answer`, or `concern`.
2. WHEN the transcript contains affirmative medication-taking language, THE Transcript_Classifier SHALL classify the status as `took_meds`.
3. WHEN the transcript contains explicit denial of medication-taking, THE Transcript_Classifier SHALL classify the status as `missed_meds`.
4. WHEN the transcript contains mentions of pain, dizziness, chest discomfort, confusion, or other health concern indicators, THE Transcript_Classifier SHALL classify the status as `concern` and populate the flags array with the matched concern keywords.
5. WHEN the Vapi_Service reports the call was not answered or went to voicemail, THE Transcript_Classifier SHALL classify the status as `no_answer` with an empty transcript.

### Requirement 4: Call Result Posting to Backend

**User Story:** As the MediCall system, I want to POST classified call results to Person 2's existing endpoint, so that alerting, escalation, and dashboard updates happen automatically.

#### Acceptance Criteria

1. WHEN the Transcript_Classifier produces a classified Call_Result, THE Call_Agent SHALL POST the result to the Backend `POST /api/call-results` endpoint with a JSON body matching the `callResultSchema` defined in `src/types.ts` (patient_id, timestamp, status, transcript, flags, fda_alerts).
2. WHEN the Backend responds with HTTP 201, THE Call_Agent SHALL log the successful persistence including the returned call_id and alert_sent value.
3. IF the Backend responds with HTTP 400 or HTTP 404, THEN THE Call_Agent SHALL log the error response body and mark the call as failed in its internal state.
4. THE Call_Agent SHALL set the `timestamp` field to the ISO 8601 time at which the Vapi call completed.

### Requirement 5: FDA Alert Context Injection

**User Story:** As the MediCall system, I want to fetch FDA alerts before each call and include them in the voice conversation, so that patients receive timely safety information about their medications.

#### Acceptance Criteria

1. WHEN the Call_Agent is preparing to call a Patient, THE Call_Agent SHALL fetch FDA alerts from the Backend `GET /api/tinyfish/fda-alerts/:patientId` endpoint before initiating the Vapi call.
2. WHEN the FDA alert response contains one or more alerts, THE Call_Agent SHALL include the alert text in the Vapi assistant system prompt and in the `fda_alerts` field of the resulting Call_Result.
3. IF the FDA alert fetch fails or returns an error, THEN THE Call_Agent SHALL proceed with the call using an empty fda_alerts array and log the fetch failure.

### Requirement 6: Guild.ai Agent Creation and Orchestration

**User Story:** As the MediCall team, I want the call pipeline orchestrated through Guild.ai agents, so that scheduling, governance, and execution visibility are managed through the Guild.ai control plane.

#### Acceptance Criteria

1. THE Call_Agent SHALL be implemented as a Guild.ai LLM agent created with `guild agent init --name medicall-call-agent --template LLM` and configured using the `@guildai/agents-sdk`.
2. THE Guild_Scheduler SHALL have a daily time trigger configured via `guild trigger create --type time --frequency DAILY --time 08:00 --agent medicall-call-agent` to execute the call pipeline each morning.
3. WHEN the daily trigger fires, THE Call_Agent SHALL iterate over all patients returned by `GET /api/patients` and execute the call flow (FDA fetch, Vapi call, classify, POST result) for each Patient sequentially.
4. THE Guild.ai workspace SHALL contain a published version of the Call_Agent accessible via `guild agent save --message "..." --wait --publish`.

### Requirement 7: Manual Trigger for Demo

**User Story:** As the demo presenter, I want to manually trigger the call pipeline on demand, so that the live demo does not depend on the daily schedule firing at the right time.

#### Acceptance Criteria

1. THE Call_Agent SHALL support manual execution via `guild agent chat` or `guild agent test` CLI commands for on-demand triggering during the demo.
2. WHEN manually triggered, THE Call_Agent SHALL execute the same call flow as the scheduled trigger (FDA fetch, Vapi call, classify, POST result) for the seed patient Margaret Ellis.
3. THE Backend dashboard at `public/index.html` SHALL reflect the new call result within 5 seconds of the POST completing, without requiring a page refresh beyond the existing polling or manual refresh mechanism.

### Requirement 8: Vapi Failure Fallback

**User Story:** As the MediCall system, I want a fallback mode when Vapi is unreachable, so that the demo and downstream pipeline can proceed even if the voice service is down.

#### Acceptance Criteria

1. IF the Vapi_Service API returns an error or times out when initiating a call, THEN THE Call_Agent SHALL inject a Fallback_Transcript with status `took_meds`, transcript text "Fallback: Vapi unavailable. Simulated successful call.", and an empty flags array.
2. WHEN a Fallback_Transcript is used, THE Call_Agent SHALL POST the fallback Call_Result to the Backend `POST /api/call-results` endpoint identically to a real call result.
3. WHEN a Fallback_Transcript is used, THE Call_Agent SHALL log a warning indicating Vapi was unreachable and fallback mode was activated.

### Requirement 9: Guild.ai Scheduler Failure Fallback

**User Story:** As the MediCall team, I want a manual override when the Guild.ai scheduler fails, so that the call pipeline can still be demonstrated.

#### Acceptance Criteria

1. IF the Guild_Scheduler daily trigger fails to fire, THEN THE Call_Agent SHALL remain executable via direct CLI invocation (`guild agent test` or `guild agent chat "run calls"`).
2. THE README SHALL document the manual trigger command as a fallback procedure for scheduler failure.

### Requirement 10: End-to-End Demo Readiness

**User Story:** As the demo presenter, I want the full call-to-dashboard pipeline verified end-to-end, so that the 90-second live demo core executes with zero failures.

#### Acceptance Criteria

1. WHEN the Call_Agent is triggered (manually or by schedule), THE system SHALL complete the full pipeline — FDA fetch, Vapi call, transcript classification, Backend POST, and dashboard update — for the seed patient Margaret Ellis within 60 seconds.
2. THE system SHALL support demonstrating a `concern` scenario where the patient mentions feeling dizzy, resulting in an escalation alert visible on the dashboard with `alert_sent: true`.
3. THE system SHALL support demonstrating an FDA alert scenario where a Metformin recall notice appears in the call context and is persisted in the Call_Result fda_alerts field.
