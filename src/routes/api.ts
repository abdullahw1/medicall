import { Router } from "express";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { shouldEscalateAlert } from "../services/alerts.js";
import { generateDoctorBrief } from "../services/doctorBrief.js";
import { sendCaregiverAndDoctorAlert } from "../services/insforge.js";
import {
  answerDrugQuestion,
  isDrugQuestion,
} from "../services/pharmacology.js";
import { buildWeeklySummary } from "../services/summary.js";
import { fetchFdaAlertsForPatient } from "../services/tinyfish.js";
import { startOutboundCall } from "../services/vapi.js";
import {
  acknowledgeAlert,
  addDoctorBrief,
  addAlertRecord,
  addCallResult,
  addVapiCallContext,
  getAllAlerts,
  getAlertByCallId,
  getCallResultById,
  getDoctorBriefByCallId,
  getAllCallResults,
  getAllPatients,
  getLatestDoctorBriefForPatient,
  getPatient,
  getVapiCallContext,
  getRecentCallResultsForPatient,
} from "../store.js";
import {
  callResultSchema,
  pharmacologyQuerySchema,
  vapiOutboundRequestSchema,
  vapiWebhookSchema,
} from "../types.js";

export const apiRouter = Router();

const persistCallResult = async (
  payload: Omit<
    ReturnType<typeof callResultSchema.parse>,
    "call_id" | "alert_sent"
  >,
) => {
  const patient = getPatient(payload.patient_id);
  if (!patient) {
    return { error: "Patient not found" as const };
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
    const deliveries = await sendCaregiverAndDoctorAlert(patient, result);
    addAlertRecord({
      alert_id: randomUUID(),
      call_id: result.call_id,
      patient_id: result.patient_id,
      created_at: new Date().toISOString(),
      acknowledged: false,
      acknowledged_at: null,
      deliveries,
    });
  }

  return { result, patient };
};

apiRouter.get("/alerts", (req, res) => {
  const patientId = req.query.patient_id;
  const records = getAllAlerts().filter((record) => {
    if (typeof patientId === "string" && record.patient_id !== patientId) {
      return false;
    }
    return true;
  });
  return res.json(records);
});

apiRouter.post("/alerts/:callId/acknowledge", (req, res) => {
  const existing = getAlertByCallId(req.params.callId);
  if (!existing) {
    return res.status(404).json({ error: "Alert not found" });
  }
  const updated = acknowledgeAlert(req.params.callId);
  return res.json(updated);
});

apiRouter.post("/run-pipeline", async (req, res) => {
  try {
    const { patient_id } = req.body ?? {};
    const patients = patient_id ? [getPatient(patient_id)] : getAllPatients();
    const targets = patients.filter(Boolean) as import("../types.js").Patient[];

    if (patient_id && targets.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const results: Array<{
      patient_id: string;
      call_id: string;
      provider: string;
      status: string;
    }> = [];

    for (const patient of targets) {
      let fdaAlerts: string[] = [];
      try {
        fdaAlerts = await fetchFdaAlertsForPatient(
          config.tinyfishFdaFeedUrl,
          patient,
        );
      } catch {
        fdaAlerts = [];
      }

      try {
        const outbound = await startOutboundCall({ patient, fdaAlerts });

        addVapiCallContext(outbound.callId, {
          patient_id: patient.patient_id,
          fda_alerts: fdaAlerts,
        });

        results.push({
          patient_id: patient.patient_id,
          call_id: outbound.callId,
          provider: outbound.provider,
          status: outbound.status,
        });
      } catch {
        // Vapi failure — persist fallback result directly
        const fallback = await persistCallResult({
          patient_id: patient.patient_id,
          timestamp: new Date().toISOString(),
          status: "took_meds",
          transcript:
            "Fallback: Vapi unavailable. Simulated successful call.",
          flags: [],
          fda_alerts: fdaAlerts,
        });

        const callId =
          "result" in fallback ? fallback.result.call_id : "fallback";

        results.push({
          patient_id: patient.patient_id,
          call_id: callId,
          provider: "fallback",
          status: "fallback",
        });
      }
    }

    return res.json({ triggered: results.length, results });
  } catch (error) {
    console.error("run-pipeline error:", error);
    return res.status(500).json({ error: "Pipeline execution failed" });
  }
});

// ── Per-agent trigger endpoints ──────────────────────────────────────

apiRouter.post("/trigger/fda-monitor", async (req, res) => {
  try {
    const { patient_id } = req.body ?? {};
    if (!patient_id) {
      return res.status(400).json({ error: "patient_id is required" });
    }

    const patient = getPatient(patient_id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

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
    console.error("trigger/fda-monitor error:", error);
    return res.status(502).json({ error: "FDA monitor fetch failed" });
  }
});

apiRouter.post("/trigger/weekly-report", (req, res) => {
  try {
    const { patient_id } = req.body ?? {};
    if (!patient_id) {
      return res.status(400).json({ error: "patient_id is required" });
    }

    const patient = getPatient(patient_id);
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
  } catch (error) {
    console.error("trigger/weekly-report error:", error);
    return res.status(500).json({ error: "Weekly report generation failed" });
  }
});

apiRouter.post("/trigger/alert-check", async (req, res) => {
  try {
    const { patient_id } = req.body ?? {};
    if (!patient_id) {
      return res.status(400).json({ error: "patient_id is required" });
    }

    const patient = getPatient(patient_id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const recentCalls = getRecentCallResultsForPatient(patient_id, 5);
    const shouldEscalate = shouldEscalateAlert(recentCalls);

    let deliveries: import("../types.js").AlertDelivery[] = [];
    if (shouldEscalate) {
      const latestCall = recentCalls[0];
      if (latestCall) {
        deliveries = await sendCaregiverAndDoctorAlert(patient, latestCall);
        addAlertRecord({
          alert_id: randomUUID(),
          call_id: latestCall.call_id,
          patient_id: patient.patient_id,
          created_at: new Date().toISOString(),
          acknowledged: false,
          acknowledged_at: null,
          deliveries,
        });
      }
    }

    return res.json({
      patient_id: patient.patient_id,
      escalated: shouldEscalate,
      recent_calls_checked: recentCalls.length,
      deliveries,
    });
  } catch (error) {
    console.error("trigger/alert-check error:", error);
    return res.status(500).json({ error: "Alert check failed" });
  }
});

// ── General endpoints ───────────────────────────────────────────────

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
    const persisted = await persistCallResult(payload);
    if ("error" in persisted) {
      return res.status(404).json({ error: "Patient not found" });
    }

    return res.status(201).json(persisted.result);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid call result payload" });
  }
});

apiRouter.post("/vapi-outbound", async (req, res) => {
  let payload: ReturnType<typeof vapiOutboundRequestSchema.parse>;
  try {
    payload = vapiOutboundRequestSchema.parse(req.body);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid vapi outbound payload" });
  }

  try {
    const patient = getPatient(payload.patient_id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    let fdaAlerts: string[] = [];
    try {
      fdaAlerts = await fetchFdaAlertsForPatient(config.tinyfishFdaFeedUrl, patient);
    } catch {
      fdaAlerts = [];
    }

    const outbound = await startOutboundCall({
      patient,
      fdaAlerts,
    });

    addVapiCallContext(outbound.callId, {
      patient_id: patient.patient_id,
      fda_alerts: fdaAlerts,
    });

    return res.status(201).json({
      call_id: outbound.callId,
      provider: outbound.provider,
      status: outbound.status,
      patient_id: patient.patient_id,
      fda_alert_count: fdaAlerts.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: "Unable to initiate live Vapi outbound call",
      details: String(error),
    });
  }
});

apiRouter.post("/vapi-webhook", async (req, res) => {
  try {
    const payload = vapiWebhookSchema.parse(req.body);
    const context = getVapiCallContext(payload.call_id);
    if (!context) {
      return res.status(404).json({ error: "Unknown call id" });
    }

    const patient = getPatient(context.patient_id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const transcript = payload.transcript ?? "";
    const lower = transcript.toLowerCase();
    let status: "took_meds" | "missed_meds" | "no_answer" | "concern" =
      "took_meds";
    let flags: string[] = [];

    if (payload.call_status === "no_answer" || lower.includes("voicemail")) {
      status = "no_answer";
    } else if (
      lower.includes("chest pain") ||
      lower.includes("dizzy") ||
      lower.includes("dizziness") ||
      lower.includes("confused") ||
      lower.includes("shortness of breath")
    ) {
      status = "concern";
      if (lower.includes("chest pain")) flags.push("chest_pain");
      if (lower.includes("dizzy") || lower.includes("dizziness")) {
        flags.push("dizziness");
      }
      if (lower.includes("confused")) flags.push("confusion");
      if (lower.includes("shortness of breath")) flags.push("shortness_of_breath");
    } else if (
      lower.includes("forgot") ||
      lower.includes("didn't take") ||
      lower.includes("did not take") ||
      lower.includes("missed")
    ) {
      status = "missed_meds";
    }

    let enrichedTranscript = transcript;
    if (isDrugQuestion(transcript)) {
      const answer = answerDrugQuestion(transcript, patient.medications);
      flags = uniqueFlags([...flags, "drug_question"]);
      enrichedTranscript = `${transcript}\nPharmacology agent answer: ${answer.answer}`;
    }

    const persisted = await persistCallResult({
      patient_id: patient.patient_id,
      timestamp: new Date().toISOString(),
      status,
      transcript: enrichedTranscript,
      flags: uniqueFlags(flags),
      fda_alerts: context.fda_alerts,
    });

    if ("error" in persisted) {
      return res.status(404).json({ error: persisted.error });
    }

    return res.status(201).json({
      call_id: payload.call_id,
      result: persisted.result,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid vapi webhook payload" });
  }
});

apiRouter.post("/pharmacology/query", (req, res) => {
  try {
    const payload = pharmacologyQuerySchema.parse(req.body);
    const patient = getPatient(payload.patient_id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const answer = answerDrugQuestion(payload.question, patient.medications);
    return res.json({
      patient_id: patient.patient_id,
      question: payload.question,
      ...answer,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid pharmacology query payload" });
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
    return res.status(502).json({
      error: "Unable to fetch live FDA alerts",
      patient_id: patient.patient_id,
      matched_count: 0,
      alerts: [],
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

apiRouter.post("/doctor-briefs/generate/:callId", async (req, res) => {
  const call = getCallResultById(req.params.callId);
  if (!call) {
    return res.status(404).json({ error: "Call result not found" });
  }

  const patient = getPatient(call.patient_id);
  if (!patient) {
    return res.status(404).json({ error: "Patient not found" });
  }

  if (call.status !== "concern") {
    return res.status(400).json({
      error: "Doctor brief generation is only available for concern calls",
    });
  }

  try {
    const brief = await generateDoctorBrief(patient, call);
    addDoctorBrief(brief);
    return res.status(201).json({
      ...brief,
      cited_doc: "docs/cited.md",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to generate doctor brief" });
  }
});

apiRouter.get("/doctor-briefs/call/:callId", (req, res) => {
  const brief = getDoctorBriefByCallId(req.params.callId);
  if (!brief) {
    return res.status(404).json({ error: "Doctor brief not found for call" });
  }

  return res.json({
    ...brief,
    cited_doc: "docs/cited.md",
  });
});

apiRouter.get("/doctor-briefs/latest/:patientId", (req, res) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: "Patient not found" });
  }

  const brief = getLatestDoctorBriefForPatient(patient.patient_id);
  if (!brief) {
    return res.status(404).json({ error: "No doctor brief generated yet" });
  }

  return res.json({
    ...brief,
    cited_doc: "docs/cited.md",
  });
});

const uniqueFlags = (flags: string[]): string[] => Array.from(new Set(flags));

