import { randomUUID } from "node:crypto";
import { CallResult, Patient } from "./types.js";
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

