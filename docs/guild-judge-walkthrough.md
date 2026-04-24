# Guild.ai — Judge Walkthrough (2 minutes)

Use this when a judge asks *“where is Guild actually doing work?”* Open the Guild web app in a second tab: **Organizations → MediCall → Workspaces → medicall** (`https://app.guild.ai`).

## 1) Workspace Agents (catalog + installs)

Scroll to **Workspace Agents**. MediCall does not hide orchestration inside a single mystery bot. You should see **four** installed agents, each **code-first** (`"use agent"`), **auto-update** pinned to published semver, and each delegating to **one** HTTP surface on the MediCall API:

| Installed agent | What it does on MediCall |
| --- | --- |
| **medicall-call-agent** | `POST /api/run-pipeline` — FDA fetch per patient, Vapi outbound with assistant overrides, result wiring. |
| **medicall-fda-monitor** | `POST /api/trigger/fda-monitor` — focused FDA / medication match for a single `patient_id`. |
| **medicall-alert-agent** | `POST /api/trigger/alert-check` — escalation logic and caregiver/doctor delivery audit. |
| **medicall-weekly-report** | `POST /api/trigger/weekly-report` — seven-day narrative for a patient. |

**Judge line:** *“Guild is our control plane: each capability is a separate installable agent with its own schema and version history—not one prompt doing everything.”*

## 2) Workspace Sessions (proof of execution)

Open **Workspace Sessions**. Point out the **tabs**:

- **Chats** — exploratory runs (e.g. “Execute project workflow”) show up as full sessions with **token meters** (tens of thousands of tokens is normal when iterating multi-step workflows in chat). That is not waste; it is evidence the team actually drove work through Guild’s session UX, not only through curl.
- **Triggers** — time-based automation (e.g. daily **08:00 UTC** run for the call agent with JSON input pinning **`backend_url`** to **`https://medicall-5v26.onrender.com`**). Emphasize **next_run_at** and that production does not depend on someone’s laptop being on.
- **Agent Tests** — each published agent has **agent_test** sessions from `guild agent test` / UI test runs; open one and show **DONE** root task and compact token usage vs chat.

**Judge line:** *“Sessions are our flight recorder: every trigger fire and every test run is auditable with timestamps, task status, and token accounting—exactly what you want before you put this next to a patient story.”*

## 3) CLI parity (optional 15 seconds)

From the repo: `npm run guild:agents`, `npm run guild:triggers`, `npm run guild:sessions` dump the same workspace as JSON for screenshots or offline judging. Remind them the binary is **`npx @guildai/cli`**, not GNU Guile’s `guild`.

## 4) Tie back to the live demo

Close the loop: *“The button on our dashboard hits the same backend these Guild agents call. Triggers run overnight or on schedule; judges see the same Render deployment whether the run started in Guild or in the UI.”*
