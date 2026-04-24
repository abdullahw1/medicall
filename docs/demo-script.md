# MediCall — Demo Script

## The Problem

My neighbor's mom passed away last year. She missed her heart medication for three days — nobody knew until it was too late. **That's the problem MediCall solves.**

MediCall calls your loved ones every morning, checks if they took their meds, and if something's wrong — their family and doctor know within seconds.

---

## How It Works

### Guild.ai — The Brain

Guild.ai is the **control plane** for MediCall: workspace **`medicall/medicall`**, a published **code-first agent** (`medicall/medicall-call-agent`, auto-managed state, `fetch` to our API), and **real time-based triggers** so runs are not only manual from the dashboard.

**What runs in production today.** A **daily time trigger** (08:00 UTC) invokes `medicall/medicall-call-agent` with explicit JSON input (`command` + `backend_url` → `https://medicall-5v26.onrender.com`). Each run calls **`POST /api/run-pipeline`**, which is where we chain **FDA feed fetch + medication match**, **Vapi outbound** with dynamic assistant overrides, and persistence on our Node service. You can inspect installs, trigger schedules, and session history in the Guild web app (`Organizations → MediCall → Workspaces → medicall`) or from the repo with **`npm run guild:triggers`**, **`npm run guild:agents`**, and **`npm run guild:sessions:time`** (CLI: `npx @guildai/cli`, not GNU Guile’s `guild`).

**What lives in-repo for depth.** Under `guild-agents/` we ship additional **coded** agents (FDA monitor, alert escalation, weekly report) aligned with **`POST /api/trigger/*`** routes—ready to publish and attach as **separate Guild time or webhook triggers** the same way as the call agent, so judges see a deliberate multi-agent split, not a monolith pretending to be “just a cron.”

### TinyFish — Real-Time FDA Safety

TinyFish ingests the **live FDA RSS recall feed** in real time, cross-references every alert against a patient's active medication list, and surfaces matched recalls directly into the call context. If the FDA publishes a recall on a patient's medication at 8 AM, MediCall's voice agent is telling them about it by 8:01.

### Vapi — The Voice

Vapi powers the actual phone calls. We use **dynamic assistant overrides** — injecting per-patient system prompts, medication context, and FDA recall data at call time. One Vapi assistant adapts its conversation to every patient's clinical profile. No manual configuration, no static scripts.

### InsForge — Instant Escalation

InsForge powers our **multi-channel escalation pipeline**. The moment our alert engine detects a concern pattern — missed doses, symptoms like dizziness or chest pain — InsForge delivers real-time email notifications to both the caregiver and the physician. Seconds, not hours.

---

## Live Demo

> "I have a patient — Samuel Brooks. He's on Warfarin and Metoprolol. Our TinyFish agent just flagged an active FDA recall on his Warfarin. I'm going to click one button and MediCall is going to call him right now, live."

**[Click Run Live Call → pick up phone → put on speaker]**

After the call:

> "Samuel's call result is already on the dashboard. The FDA recall was delivered. If this was a concern, his family and doctor would already have an email from InsForge. Four agents, four sponsors, one pipeline — that's MediCall."
