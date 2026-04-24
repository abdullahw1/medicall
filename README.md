# MediCall
AI system that automatically calls elderly patients every morning to check if they took their medication. If something's wrong — they missed doses, they're feeling sick, they're not answering — it texts their family and doctor immediately. Everything is tracked in a dashboard the family can see.

## Person 2 Scope (Backend + TinyFish + Dashboard)

This repo now includes the Person 2 foundation:
- InsForge-ready backend API for patients, call results, escalation logic, and weekly summaries.
- TinyFish FDA monitor endpoint that checks FDA recall/safety RSS and matches against patient medications.
- Live dashboard at `/` showing patient call status and FDA match checks.

## Quick Start

This project uses the TypeScript 7 native preview toolchain (`tsgo`) for type-check and build scripts.
For InsForge integration, this project uses the `@insforge/sdk` client pattern (`INSFORGE_URL` + `INSFORGE_ANON_KEY`) with email alerts enabled by default. SMS is deferred as a future enhancement.

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Start local server:

```bash
npm run dev
```

Optional validation/build:

```bash
npm run check
npm run build
```

4. Open:

`http://localhost:8080`

## Key Endpoints

- `GET /api/health`
- `GET /api/patients`
- `GET /api/call-results`
- `POST /api/call-results`
- `GET /api/tinyfish/fda-alerts/:patientId`
- `GET /api/reports/weekly/:patientId`

## Payload Contract (Call Result Ingestion)

`POST /api/call-results` accepts:

```json
{
  "patient_id": "11111111-1111-4111-8111-111111111111",
  "timestamp": "2026-04-24T18:00:00.000Z",
  "status": "took_meds",
  "transcript": "Yes, I took my pills this morning.",
  "flags": [],
  "fda_alerts": []
}
```

Alerting behavior:
- escalates on `concern`
- escalates on 2+ missed doses in recent history
- escalates on 3 consecutive `no_answer`
