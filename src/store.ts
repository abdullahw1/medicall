import { randomUUID } from "node:crypto";
import { CallResult, Patient } from "./types.js";

const now = new Date().toISOString();

const seedPatients: Patient[] = [
  {
    patient_id: "11111111-1111-4111-8111-111111111111",
    name: "Margaret Ellis",
    phone: "+14155550101",
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

