# Requirements: Demo Sprint (80-minute window)

## Introduction

Final sprint to get MediCall demo-ready. Partner's Vapi integration, webhook, pharmacology agent, doctor briefs, and dashboard are built. Focus is on verifying everything works end-to-end, fixing the Guild.ai agent to actually trigger the pipeline, and ensuring InsForge notifications fire.

## Requirements

### Requirement 1: Guild.ai Agent Pipeline Trigger
The Guild.ai agent must be able to trigger the call pipeline via the backend's `POST /api/vapi-outbound` endpoint. Currently the agent only has `guild_get_me` — it needs to either use a code-first approach with `fetch`, or the backend needs a single `POST /api/run-pipeline` endpoint the agent can describe in its prompt.

### Requirement 2: InsForge Notifications
InsForge SDK is installed but the integration needs verification. When `USE_MOCK_NOTIFICATIONS=false`, the system should send real emails via InsForge to caregiver and doctor on escalation.

### Requirement 3: End-to-End Pipeline Verification
The full flow must work: Guild trigger → FDA fetch → Vapi call → webhook → classification → call result → dashboard update. Verify with seed patient Margaret Ellis.

### Requirement 4: Demo Readiness
README updated, env vars documented, demo script rehearsed. The 90-second live core must execute with zero failures.
