import { randomUUID } from "node:crypto";
import { AlertRecord, CallResult, Patient } from "./types.js";
import { DoctorBrief } from "./services/doctorBrief.js";

const now = new Date().toISOString();

const seedPatients: Patient[] = [
  {
    patient_id: "11111111-1111-4111-8111-111111111111",
    name: "Margaret Ellis",
    phone: "+14086740311",
    medications: ["Metformin", "Lisinopril", "Atorvastatin"],
    caregiver_phone: "+14155550999",
    caregiver_email: "daughter@example.com",
    doctor_email: "dr.hsu@exampleclinic.com",
    call_time: "08:00",
    timezone: "America/Los_Angeles",
  },
  {
    patient_id: "22222222-2222-4222-8222-222222222222",
    name: "Samuel Brooks",
    phone: "+14085550022",
    medications: ["Warfarin", "Metoprolol"],
    caregiver_phone: "+14155550001",
    caregiver_email: "sam.caregiver@example.com",
    doctor_email: "dr.lee@exampleclinic.com",
    call_time: "08:30",
    timezone: "America/Los_Angeles",
  },
  {
    patient_id: "33333333-3333-4333-8333-333333333333",
    name: "Lena Ortiz",
    phone: "+14085550033",
    medications: ["Levothyroxine"],
    caregiver_phone: "+14155550002",
    caregiver_email: "lena.caregiver@example.com",
    doctor_email: "dr.patel@exampleclinic.com",
    call_time: "09:00",
    timezone: "America/Los_Angeles",
  },
];

const primaryPatient = seedPatients[0];
if (!primaryPatient) {
  throw new Error("Seed data requires at least one patient");
}

const seedCallResults: CallResult[] = [
  {
    call_id: randomUUID(),
    patient_id: primaryPatient.patient_id,
    timestamp: now,
    status: "took_meds",
    transcript: "Yes, I took all my morning pills after breakfast.",
    flags: [],
    fda_alerts: [],
    alert_sent: false,
  },
  {
    call_id: randomUUID(),
    patient_id: "22222222-2222-4222-8222-222222222222",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "missed_meds",
    transcript: "I forgot my blood pressure pill this morning.",
    flags: [],
    fda_alerts: [],
    alert_sent: false,
  },
  {
    call_id: randomUUID(),
    patient_id: "33333333-3333-4333-8333-333333333333",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    status: "concern",
    transcript: "I feel dizzy and my chest is tight.",
    flags: ["dizziness", "chest_pain"],
    fda_alerts: [],
    alert_sent: true,
  },
];

export const patientStore = new Map<string, Patient>(
  seedPatients.map((patient) => [patient.patient_id, patient]),
);

export const callResultStore = new Map<string, CallResult>(
  seedCallResults.map((result) => [result.call_id, result]),
);

type VapiCallContext = {
  patient_id: string;
  fda_alerts: string[];
};

export const vapiCallContextStore = new Map<string, VapiCallContext>();
export const doctorBriefStore = new Map<string, DoctorBrief>();
export const alertStore = new Map<string, AlertRecord>();
for (const call of seedCallResults) {
  if (!call.alert_sent) continue;
  alertStore.set(call.call_id, {
    alert_id: randomUUID(),
    call_id: call.call_id,
    patient_id: call.patient_id,
    created_at: call.timestamp,
    acknowledged: false,
    acknowledged_at: null,
    deliveries: [
      {
        channel: "email",
        recipient: "seed-caregiver@example.com",
        target: "caregiver",
        status: "sent",
        timestamp: call.timestamp,
      },
      {
        channel: "email",
        recipient: "seed-doctor@example.com",
        target: "doctor",
        status: "sent",
        timestamp: call.timestamp,
      },
      {
        channel: "sms",
        recipient: "+14155550002",
        target: "caregiver",
        status: "skipped",
        detail: "sms_channel_not_configured",
        timestamp: call.timestamp,
      },
    ],
  });
}

export const addCallResult = (result: CallResult): void => {
  callResultStore.set(result.call_id, result);
};

export const getPatient = (patientId: string): Patient | undefined =>
  patientStore.get(patientId);

export const getAllPatients = (): Patient[] => Array.from(patientStore.values());

export const getAllCallResults = (): CallResult[] =>
  Array.from(callResultStore.values()).sort((a, b) =>
    a.timestamp > b.timestamp ? -1 : 1,
  );

export const getRecentCallResultsForPatient = (
  patientId: string,
  limit: number,
): CallResult[] =>
  getAllCallResults()
    .filter((result) => result.patient_id === patientId)
    .slice(0, limit);

export const addVapiCallContext = (
  callId: string,
  context: VapiCallContext,
): void => {
  vapiCallContextStore.set(callId, context);
};

export const getVapiCallContext = (
  callId: string,
): VapiCallContext | undefined => vapiCallContextStore.get(callId);

export const addDoctorBrief = (brief: DoctorBrief): void => {
  doctorBriefStore.set(brief.call_id, brief);
};

export const getDoctorBriefByCallId = (
  callId: string,
): DoctorBrief | undefined => doctorBriefStore.get(callId);

export const getLatestDoctorBriefForPatient = (
  patientId: string,
): DoctorBrief | undefined =>
  Array.from(doctorBriefStore.values())
    .filter((brief) => brief.patient_id === patientId)
    .sort((a, b) => (a.generated_at > b.generated_at ? -1 : 1))[0];

export const getCallResultById = (callId: string): CallResult | undefined =>
  callResultStore.get(callId);

export const addAlertRecord = (record: AlertRecord): void => {
  alertStore.set(record.call_id, record);
};

export const getAlertByCallId = (callId: string): AlertRecord | undefined =>
  alertStore.get(callId);

export const getAllAlerts = (): AlertRecord[] =>
  Array.from(alertStore.values()).sort((a, b) =>
    a.created_at > b.created_at ? -1 : 1,
  );

export const acknowledgeAlert = (callId: string): AlertRecord | undefined => {
  const existing = alertStore.get(callId);
  if (!existing) {
    return undefined;
  }
  const updated: AlertRecord = {
    ...existing,
    acknowledged: true,
    acknowledged_at: new Date().toISOString(),
  };
  alertStore.set(callId, updated);
  return updated;
};

