---
name: medicall-project
description: End-to-end project operating guide for the MediCall hackathon build, including architecture, agent responsibilities, data schemas, sponsor integration constraints, demo sequence, fallback modes, and Devpost narrative. Use when implementing, integrating, testing, documenting, or pitching the MediCall system.
---

# MediCall Project Skill

Use this as the source of truth for building and presenting MediCall.

## Core Product Definition

MediCall is an autonomous medication adherence system for elderly patients that assumes only a phone number. The system performs daily outbound calls, interprets outcomes, logs results, escalates risks to caregivers and doctors, and incorporates live FDA safety/recall context before calls.

Anchor framing:
- Medication non-adherence causes 125,000 U.S. deaths annually.
- Existing tools assume digital engagement.
- MediCall replaces app dependence with proactive phone calls and autonomous escalation.

Use this one-sentence pitch when needed:
"MediCall is the phone call that nobody else is making — every morning, to every elderly patient, with real-time awareness of their medications, so families stop finding out too late."

## Non-Swappable Sponsor Architecture

Treat these four tools as required and architecturally distinct:

1) Vapi
- Role: Real-time voice call infrastructure (STT + LLM + TTS + telephony + transcript webhook).
- Constraint: Without Vapi, the primary call loop does not exist.

2) Guild.ai
- Role: Orchestration/scheduling control plane for agent execution.
- Constraint: Without Guild.ai, pipeline governance and visible scheduling control are lost.

3) InsForge
- Role: AI-native backend for persistence, auth, and outbound notifications.
- Constraint: Without InsForge, patient records, call results, alerts, and dashboard API must be rebuilt.

4) TinyFish
- Role: Autonomous web agent for nightly FDA recall/safety monitoring.
- Constraint: Without TinyFish, MediCall becomes reactive instead of proactive.

## Sponsor Integration Modes (Current Repo Truth)

Use this table when explaining "how each sponsor is actually wired":

| Sponsor | Product role in MediCall | Integration mode in this repo | Where implemented |
| --- | --- | --- | --- |
| Vapi | Outbound voice calls + transcript roundtrip | REST API + webhook (`POST https://api.vapi.ai/call`, backend `POST /api/vapi-webhook`) | `src/services/vapi.ts`, `src/routes/api.ts` |
| Guild.ai | Orchestration/control plane | **Workspace `medicall/medicall`:** four installed coded agents (`medicall-call-agent`, `medicall-fda-monitor`, `medicall-alert-agent`, `medicall-weekly-report`) + **time triggers** + **sessions** (chats / triggers / agent tests) | `guild-agent/agent.ts`, `guild-agents/*`, `docs/guild-judge-walkthrough.md`, `npm run guild:agents` |
| InsForge | Notification backend for caregiver/doctor alerts | InsForge SDK (`@insforge/sdk`) | `src/services/insforge.ts` |
| TinyFish | FDA recall/safety grounding before calls | Project-side HTTP/RSS fetch + medication matching (TinyFish role emulated in-service) | `src/services/tinyfish.ts`, `GET /api/tinyfish/fda-alerts/:patientId` |

Important accuracy note:
- TinyFish is represented functionally in this codebase through custom FDA feed polling/matching logic. It is not currently wired through a TinyFish SDK package.
- Guild command collision is expected on some machines (`guild` may map to GNU Guile). Use `npx @guildai/cli` for sponsor CLI operations in this project.

Optional security hardening:
- Use `cgr.dev/chainguard/node:latest` as base image for lower CVE surface and SBOM support.

## Agent Topology and Execution Order

Primary schedule:
- Daily at 8:00 AM (patient local schedule managed through patient time metadata).
- Weekly report run Sunday at 6:00 PM.

Execution flow:
1. Agent 1: TinyFish FDA Monitor
   - Scrape FDA recall/safety pages nightly.
   - Cross-reference each patient's medication list.
   - Produce `fda_alerts[]` per patient for next-day call context.

2. Agent 2: Call Agent (Vapi) [Primary]
   - Start outbound call with `fda_alerts` injected into system prompt/context.
   - Ask adherence and wellbeing questions.
   - Receive transcript via webhook at call completion.
   - Classify status: `took_meds | missed_meds | no_answer | concern`.
   - Persist call result in InsForge.

3. Agent 3: Pharmacology Agent (conditional)
   - Trigger only when patient asks drug-specific question.
   - Query Ghost drug database.
   - Return concise answer for Call Agent to speak aloud.

4. Agent 4: Alert Agent (conditional)
   - Trigger on any of:
     - 2+ missed doses
     - concern flag
     - 3 consecutive no-answers
   - Send SMS + email via InsForge to caregiver and doctor.
   - Persist `alert_sent = true`.

5. Agent 5: Weekly Report Agent
   - Pull last 7 days of call results.
   - Generate plain-English summary.
   - Email caregiver and doctor.

## Canonical Schemas (Integration Contract)

All teammates and agents must honor these exact data shapes.

Patient object:
```json
{
  "patient_id": "uuid",
  "name": "string",
  "phone": "+1XXXXXXXXXX",
  "medications": ["string"],
  "caregiver_phone": "+1XXXXXXXXXX",
  "caregiver_email": "string",
  "doctor_email": "string",
  "call_time": "HH:MM",
  "timezone": "America/Los_Angeles"
}
```

Call result object:
```json
{
  "call_id": "uuid",
  "patient_id": "uuid",
  "timestamp": "ISO8601",
  "status": "took_meds | missed_meds | no_answer | concern",
  "transcript": "string",
  "flags": ["chest_pain", "dizziness", "drug_question"],
  "fda_alerts": ["string"],
  "alert_sent": true
}
```

## Autonomy Standard (Judging Narrative)

When explaining autonomy, always present both levels:

Level 1: Scheduled autonomy
- Daily pipeline executes without human trigger.
- Calls, logging, and escalation happen automatically.

Level 2: Web-grounded autonomy
- TinyFish tracks live FDA web updates.
- New recall data updates next-day call context automatically.

Framing distinction:
- Automation runs a fixed flow.
- Autonomy adapts to real-world changes from live web data.

## Team Split and Build Priorities

Person 1 owns:
- Vapi call flow
- Guild.ai orchestration
- demo script + Devpost write-up

Person 2 owns:
- InsForge backend + SMS/email
- TinyFish FDA monitor
- dashboard UI

Parallelization rule:
- No blocking if both sides implement against canonical schemas from hour one.

## Demo Reliability Script (3 Minutes)

Narrative sequence:
1) Problem framing (0:00-0:20)
2) Live call trigger from Guild.ai and call completion (0:20-1:20)
3) Concern scenario and caregiver SMS + FDA signal proof (1:20-2:00)
4) Sponsor architecture argument (2:00-2:40)
5) Forward path and close (2:40-3:00)

Reliability requirement:
- Rehearse the exact full sequence at least 5 times pre-demo.
- Treat the 90-second live core as zero-failure.

## Fallback Modes

Keep these contingencies explicit without fabricating synthetic patient data:
- Vapi failure -> surface failure state in dashboard/operator log and retry manually.
- TinyFish scrape failure -> return empty FDA list with explicit error state.
- InsForge notification failure -> preserve call result and alert flag, then show delivery error.
- Guild.ai scheduler failure -> expose manual trigger control.

## Devpost Writing Guide

Structure:
1. Opening reframe
2. Problem statement (include the 81-year-old neighbor narrative)
3. What was built
4. How it works (agent-by-agent in plain English)
5. Sponsor integration (one paragraph per sponsor with non-swappable rationale)
6. Autonomy argument (two-level framing)
7. What's next (speech-drift cognitive detection, HIPAA path)

Use concise, concrete language and evidence from live demo outputs.

## Implementation Guardrails

Use these constraints during build/integration:
- Keep system proactive: FDA monitor must run before call context construction.
- Keep escalation deterministic: alert triggers must be explicit and auditable.
- Keep communication plain-English and elder-friendly during calls and summaries.
- Keep dashboard state aligned with persisted `call_result` records.
- Keep all sponsor claims demonstrably true in the demo flow.

## Dashboard Product Spec (Story-Driven)

Use this layout and behavior as the canonical dashboard target:

Primary screen objective:
- Answer "Is anyone unsafe right now?" in under 3 seconds.

Required regions:
1) Safety status + KPI rail
   - Show today counts for: successful adherence checks, missed doses, concern calls, escalations sent.
   - Show last update timestamp and live/healthy system indicator.
2) Agent activity strip
   - Show visible state for TinyFish, Call Agent, Pharmacology Agent, Alert Agent, Weekly Report Agent.
   - Include timestamps so autonomy is observable, not narrated.
3) Patient timeline (centerpiece)
   - Each event must show: timestamp, canonical status, transcript snippet, flags, `alert_sent`, and FDA context indicator.
   - Keep "most recent event first" ordering.
4) Caregiver layer
   - Plain-English labels and summaries (never raw internal jargon only).
   - Weekly summary card suitable for forwarding to a doctor.
5) Doctor action panel
   - On concern events, show quick triage summary + cited brief preview.
6) Operator/audit panel
   - Show patient_id, call_id, alert_id (if available), source mode (live vs fallback), and durable timestamps.

Demo mode control:
- Provide a single "Run Demo Sequence" control that can step through: call trigger -> dashboard update -> caregiver alert -> cited brief generation.

## Dashboard Acceptance Criteria (Mapped to User Stories)

Patient:
1) When daily pipeline runs, patient receives/records one adherence call attempt with status captured in canonical schema.
2) If patient asks a drug question, event includes `drug_question` flag and pharmacology path is visible in agent activity.
3) If relevant FDA alert exists, call context and resulting timeline event show FDA alert presence.

Caregiver:
1) On `missed_meds` threshold, `concern`, or 3x `no_answer`, caregiver SMS/email send attempt is visible with timestamp and delivery state.
2) Dashboard shows live call history and adherence trend without requiring page reload.
3) Weekly plain-English summary is available each Sunday run (or manual fallback trigger).

Doctor:
1) Concern flags (e.g., chest pain, dizziness) appear in doctor-facing alert panel immediately after ingestion.
2) Cited brief preview appears for concern events and indicates source grounding mode.

Clinic/Operator:
1) Patient enrollment data fields match canonical Patient schema and require no patient-side app setup.
2) Morning run can execute without human trigger, with manual trigger fallback exposed.
3) All call results and alert outcomes persist in backend and are queryable/auditable from dashboard state.

Judge demo beats:
1) Show autonomous trigger launching a real call flow (or explicit fallback mode with reason).
2) Show dashboard updating from persisted result in near real-time after call completion.
3) Show physical-room alert evidence (SMS/email send proof state) for concern/missed threshold scenario.
4) Show cited brief population with live web sources after concern.

## Known Integration Gotchas (Apr 2026)

Capture these as hard constraints for future agent sessions:
- Guild LLM agent prompts are not execution by themselves. If the prompt says "call backend endpoints", the agent still needs concrete tools capable of HTTP/network actions; otherwise it cannot run the pipeline.
- Do not reference non-existent backend routes in Guild agent prompts. Current Person 2 API baseline does NOT include `POST /api/vapi-outbound`; only use endpoints that exist in `src/routes/api.ts` unless route work is added in the same change set.
- Avoid ignoring `.claude` in `.gitignore` if project skills are part of repo memory. If `.claude` remains ignored, skill updates require explicit force-add and are easy to miss in commits.
- Treat `guild-agent/guild.json` as workspace-local metadata (contains concrete `agent_id` and `workspace_id`). Do not assume it is portable across contributors/environments.
- For Guild agent claims, keep implementation and runtime wiring aligned: prompt, tools, backend endpoints, and demo script must describe the same executable flow.

## First Checklist For New Sessions

When starting work on MediCall:
1) Validate schemas exist and are shared.
2) Validate outbound call path and transcript webhook roundtrip.
3) Validate InsForge writes and notification send.
4) Validate TinyFish data arrives in call context.
5) Validate fallback flags and manual trigger path.
6) Validate demo script sequence end-to-end.

## Current Person 2 Implementation Map

Use these modules as the active implementation baseline:
- `src/types.ts` for canonical Patient and CallResult schemas.
- `src/routes/api.ts` for backend endpoints (health, patients, call results, Vapi outbound/webhook ingestion, pharmacology query, TinyFish FDA check, doctor briefs, weekly report).
- `src/services/insforge.ts` for notification sending (live by default, optional mock mode via env flag).
- `src/services/alerts.ts` for deterministic escalation logic.
- `src/services/tinyfish.ts` for FDA RSS fetch + medication matching.
- `src/services/vapi.ts` for outbound call initiation (real Vapi by default; mock only when explicitly enabled).
- `src/services/pharmacology.ts` for drug-question detection and real-time answer generation.
- `src/services/doctorBrief.ts` for concern-brief generation and `docs/cited.md` persistence.
- `src/services/summary.ts` for plain-English weekly summary generation.
- `src/store.ts` for in-memory seed data, Vapi call context mapping, and doctor brief retrieval.
- `public/index.html` for the full story-driven dashboard (regions listed below).
- `docs/cited.md` for persisted cited concern briefs used in demo/judge evidence.

Dashboard regions now shipped in `public/index.html`:
- Topbar with live "System healthy" pulse + local clock.
- Hero with primary "Run demo sequence" CTA and secondary "Weekly report".
- Demo sequence progress strip (4 steps: call trigger → dashboard update → caregiver alert → cited brief) that lights up beat-by-beat as the orchestrator runs against real endpoints.
- KPI rail (patients on watch, calls in last 24h, adherence %, escalations today) with escalation card turning warm when alerts fired.
- Patients-on-watch roster with avatar + medication count + latest call status chip.
- Click-to-focus patient detail module with per-patient streak, 30-day escalation count, latest status, and isolated recent call history.
- Call timeline (centerpiece) with filter chips (all/took/missed/no-answer/concern/escalated), transcript quotes, flag chips, `alert_sent` chip, and FDA context chip.
- Dedicated alert panel with unresolved-vs-acknowledged workflow and channel breakdown (email/sms/failures) plus acknowledge actions.
- Guild trigger panel that centralizes live call controls and visualizes `calling -> STT -> LLM -> webhook -> persisted` stage progression for both live call and judge sequence triggers.
- Agent pipeline strip with per-agent observable timestamps (spec: "observable, not narrated").
- FDA safety monitor panel with live feed status line.
- Weekly summary card (plain-English, caregiver-voiced).
- Doctor action panel: urgent chip + triage one-liner + cited brief preview (serif-set with numbered sources) for rapid clinical follow-up.
- Operator audit panel at the bottom: monospace table of ISO timestamp, patient_id, call_id, status, alert_sent flag, and FDA source mode.

Dashboard → backend endpoint contract (must stay in sync):
- `GET /api/patients`, `GET /api/call-results` drive the live refresh every 8s.
- `GET /api/alerts` and `POST /api/alerts/:callId/acknowledge` power alert triage state and acknowledgement UX.
- `POST /api/vapi-outbound` + `POST /api/vapi-webhook` power both "Try random call" and the demo sequence's real-call/webhook beats.
- `POST /api/doctor-briefs/generate/:callId` + `GET /api/doctor-briefs/latest/:patientId` drive the doctor action panel.
- `GET /api/tinyfish/fda-alerts/:patientId` powers the FDA monitor with live FDA RSS matching.
- `GET /api/reports/weekly/:patientId` powers the weekly summary card.

Demo fallback currently implemented:
- If FDA feed fetch fails, API returns a non-200 error and the dashboard shows a live-feed failure state.
- If Vapi outbound fails, API returns an error (no silent synthetic call fallback in live mode).
