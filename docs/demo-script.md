# MediCall — Demo Script

## The Problem

My neighbor's mom passed away last year. She missed her heart medication for three days — nobody knew until it was too late. **That's the problem MediCall solves.**

MediCall calls your loved ones every morning, checks if they took their meds, and if something's wrong — their family and doctor know within seconds.

---

## How It Works

### Guild.ai — The Brain

Guild.ai is the **control plane** for MediCall: workspace **`medicall/medicall`** with **four installed, auto-updating code agents** (not one mega-prompt). Each agent is **`"use agent"`** auto-managed state, **`fetch`** to our Render API, and its **own** published semver in Guild’s catalog.

**Installed in the workspace today.** **`medicall-call-agent`** (pipeline), **`medicall-fda-monitor`** (single-patient FDA match), **`medicall-alert-agent`** (escalation / delivery check), **`medicall-weekly-report`** (seven-day summary). Defaults pin **`backend_url`** to **`https://medicall-5v26.onrender.com`** so scheduled runs never depend on localhost.

**What runs on a schedule.** A **daily time trigger** (08:00 UTC) invokes **`medicall-call-agent`** with JSON input (`command` + explicit **`backend_url`**). That run calls **`POST /api/run-pipeline`** (FDA enrichment, Vapi, persistence). The other three agents are built for **additional time or webhook triggers** per patient or cadence—same product pattern as enterprise “one concern = one delegate.”

**Where to click in Guild (for judges).** **Workspace Agents** shows all four installs and versions. **Workspace Sessions** shows **Chats** (e.g. “Execute project workflow” with real token totals), **Triggers** (scheduled autonomy), and **Agent Tests** (published-agent validation runs). Read **`docs/guild-judge-walkthrough.md`** for a 2-minute spoken script. From the repo: **`npm run guild:agents`**, **`npm run guild:triggers`**, **`npm run guild:sessions`** (CLI: **`npx @guildai/cli`**, not GNU Guile’s **`guild`**).

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

> "Samuel's call result is already on the dashboard. The FDA recall was delivered. If this was a concern, his family and doctor would already have an email from InsForge. In Guild we run **four separate installed agents** on one workspace—call pipeline, FDA delegate, alert delegate, weekly report—each versioned and auditable in **Workspace Sessions**. That's MediCall."
