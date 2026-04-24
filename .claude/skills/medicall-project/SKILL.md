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

Implement explicit fallback behavior:
- Vapi failure -> inject pre-recorded transcript into downstream pipeline.
- TinyFish scrape failure -> use static FDA alert fixture (metformin).
- InsForge SMS failure -> show dashboard update and mark SMS as pending.
- Guild.ai scheduler failure -> expose manual trigger control.

## Devpost Writing Guide

Structure:
1. Opening reframe
2. Problem statement (include the 81-year-old neighbor narrative)
3. What was built
4. How it works (agent-by-agent in plain English)
5. Sponsor integration (one paragraph per sponsor with non-swappable rationale)
6. Autonomy argument (two-level framing)
7. What's next (x402 rails, speech-drift cognitive detection, HIPAA path)

Use concise, concrete language and evidence from live demo outputs.

## Implementation Guardrails

Use these constraints during build/integration:
- Keep system proactive: FDA monitor must run before call context construction.
- Keep escalation deterministic: alert triggers must be explicit and auditable.
- Keep communication plain-English and elder-friendly during calls and summaries.
- Keep dashboard state aligned with persisted `call_result` records.
- Keep all sponsor claims demonstrably true in the demo flow.

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
- `src/routes/api.ts` for backend endpoints (health, patients, call results, TinyFish FDA check, weekly report).
- `src/services/insforge.ts` for notification sending (mock mode + InsForge-ready HTTP integration).
- `src/services/alerts.ts` for deterministic escalation logic.
- `src/services/tinyfish.ts` for FDA RSS fetch + medication matching.
- `src/services/summary.ts` for plain-English weekly summary generation.
- `src/store.ts` for in-memory seed data and result retrieval.
- `public/index.html` for dashboard and manual TinyFish check trigger.

Demo fallback currently implemented:
- If FDA feed fetch fails, API returns static metformin fixture payload with `source: "fallback_fixture"`.
