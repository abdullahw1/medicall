# Demo Sprint Tasks

## Tasks

- [ ] 1. Add pipeline and per-agent trigger endpoints to Express backend
  - [ ] 1.1 Add `POST /api/run-pipeline` — accepts optional `{ patient_id }`, runs full flow (FDA fetch → Vapi call → store context), returns summary
  - [ ] 1.2 Add `POST /api/trigger/fda-monitor` — runs TinyFish FDA fetch for a patient, returns alerts
  - [ ] 1.3 Add `POST /api/trigger/weekly-report` — generates weekly report for a patient, returns summary
  - [ ] 1.4 Add `POST /api/trigger/alert-check` — runs escalation check for a patient's recent calls, returns whether alert was sent

- [ ] 2. Create Guild.ai agents (one per SKILL.md agent)
  - [ ] 2.1 Convert `medicall-call-agent` to code-first — calls `POST /api/run-pipeline`
  - [ ] 2.2 Create `medicall-fda-monitor` agent — calls `POST /api/trigger/fda-monitor`
  - [ ] 2.3 Create `medicall-alert-agent` — calls `POST /api/trigger/alert-check`
  - [ ] 2.4 Create `medicall-weekly-report` agent — calls `POST /api/trigger/weekly-report`
  - [ ] 2.5 Save and publish all agents

- [ ] 3. End-to-end verification and demo prep
  - [ ] 3.1 Smoke test: trigger pipeline via Guild agent, verify call result on dashboard
  - [ ] 3.2 Update README with multi-agent architecture and demo instructions

## Notes

- Pharmacology agent (Agent 3) is already wired into the webhook — no separate Guild agent needed, it triggers automatically when a drug question is detected in a transcript
- Each Guild agent is code-first (`AUTO_MANAGED_STATE`) so it can make HTTP calls
- All agents call the Express backend — the backend has all the logic already
