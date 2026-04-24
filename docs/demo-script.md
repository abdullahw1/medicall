# MediCall — Demo Script

## The Problem

My neighbor's mom passed away last year. She missed her heart medication for three days — nobody knew until it was too late. **That's the problem MediCall solves.**

MediCall calls your loved ones every morning, checks if they took their meds, and if something's wrong — their family and doctor know within seconds.

---

## How It Works

### Guild.ai — The Brain

Guild.ai is the backbone of MediCall. We built a **fleet of four code-first autonomous agents** running on Guild's auto-managed runtime — each one handling a critical piece of the patient care pipeline:

| Agent | What It Does |
|---|---|
| **Call Pipeline Agent** | Orchestrates the entire morning check-in flow — FDA fetch, voice call, result classification — in one trigger |
| **FDA Monitor Agent** | Pulls live recall data and matches it against each patient's medications |
| **Alert Escalation Agent** | Evaluates recent call history and fires caregiver/doctor notifications when risk thresholds are crossed |
| **Weekly Report Agent** | Generates compliance summaries for caregivers and physicians |

Every agent is code-first (`AUTO_MANAGED_STATE`), calling dedicated backend endpoints via `fetch`. No prompt engineering, no manual triggers — Guild agents wake up, do their job, and report back. The entire patient care workflow runs **hands-free**, on a schedule or on-demand.

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
