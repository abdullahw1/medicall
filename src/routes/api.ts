import { Router } from "express";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { shouldEscalateAlert } from "../services/alerts.js";
import { sendCaregiverAndDoctorAlert } from "../services/insforge.js";
import { buildWeeklySummary } from "../services/summary.js";
import { fetchFdaAlertsForPatient } from "../services/tinyfish.js";
import {
  addCallResult,
  getAllCallResults,
  getAllPatients,
  getPatient,
  getRecentCallResultsForPatient,
} from "../store.js";
import { callResultSchema } from "../types.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "medicall-person-2" });
});

apiRouter.get("/patients", (_req, res) => {
  res.json(getAllPatients());
});

apiRouter.get("/call-results", (_req, res) => {
  res.json(getAllCallResults());
});

apiRouter.post("/call-results", async (req, res) => {
  try {
    const payload = callResultSchema
      .omit({ call_id: true, alert_sent: true })
      .parse(req.body);
    const patient = getPatient(payload.patient_id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const recentCalls = [
      { ...payload, call_id: randomUUID(), alert_sent: false },
      ...getRecentCallResultsForPatient(payload.patient_id, 5),
    ];

    const escalate = shouldEscalateAlert(recentCalls);
    const result = {
      ...payload,
      call_id: randomUUID(),
      alert_sent: escalate,
    };

    addCallResult(result);

    if (escalate) {
      await sendCaregiverAndDoctorAlert(patient, result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid call result payload" });
  }
});

apiRouter.get("/tinyfish/fda-alerts/:patientId", async (req, res) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: "Patient not found" });
  }

  try {
    const alerts = await fetchFdaAlertsForPatient(
      config.tinyfishFdaFeedUrl,
      patient,
    );
    return res.json({
      patient_id: patient.patient_id,
      matched_count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      patient_id: patient.patient_id,
      matched_count: 1,
      source: "fallback_fixture",
      alerts: [
        "Metformin extended-release tablets recalled due to contamination risk (static demo fixture).",
      ],
    });
  }
});

apiRouter.get("/reports/weekly/:patientId", (req, res) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: "Patient not found" });
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCalls = getAllCallResults().filter(
    (call) =>
      call.patient_id === patient.patient_id &&
      Date.parse(call.timestamp) >= weekAgo,
  );

  return res.json({
    patient_id: patient.patient_id,
    summary: buildWeeklySummary(patient, weeklyCalls),
  });
});

