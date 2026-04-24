# Design: Demo Sprint

## Overview

Minimal changes to get demo-ready. The codebase is 90% complete — partner built Vapi service, webhook, pharmacology, doctor briefs, alerts, and dashboard. We need to wire the Guild agent, verify InsForge, and smoke-test the pipeline.

## Changes Required

### 1. Add `POST /api/run-pipeline` endpoint
Single endpoint that runs the full pipeline for all patients (or a specific patient_id). This is what the Guild agent triggers. Internally it calls the existing `POST /api/vapi-outbound` for each patient.

### 2. Update Guild agent to code-first (`AUTO_MANAGED_STATE`)
Switch from LLM template to code-first so the agent can make HTTP calls via `fetch` through `task.tools`. The agent calls `POST /api/run-pipeline` on the backend.

### 3. Verify InsForge email flow
Set `USE_MOCK_NOTIFICATIONS=false` and trigger a concern scenario to verify InsForge sends emails.

### 4. End-to-end smoke test
Trigger pipeline → verify call result on dashboard → verify concern escalation → verify FDA alerts in context.
