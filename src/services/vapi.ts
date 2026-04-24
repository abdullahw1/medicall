import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { Patient } from "../types.js";

export type VapiOutboundRequest = {
  patient: Patient;
  fdaAlerts: string[];
};

export type VapiOutboundResult = {
  callId: string;
  provider: "vapi" | "mock";
  status: "queued" | "fallback";
};

const buildAssistantOverrides = (patient: Patient, fdaAlerts: string[]) => {
  const recallLine =
    fdaAlerts.length > 0
      ? `FDA safety context for this patient: ${fdaAlerts.join(" ")}`
      : "No FDA recall alerts matched this patient today.";

  return {
    variableValues: {
      patient_name: patient.name,
      patient_medications: patient.medications.join(", "),
      patient_timezone: patient.timezone,
      fda_context: recallLine,
    },
  };
};

const startMockCall = async (): Promise<VapiOutboundResult> => ({
  callId: `mock-call-${randomUUID()}`,
  provider: "mock",
  status: "fallback",
});

const startLiveCall = async (
  request: VapiOutboundRequest,
): Promise<VapiOutboundResult> => {
  if (!config.vapiApiKey || !config.vapiPhoneNumberId || !config.vapiAssistantId) {
    throw new Error(
      "Vapi config missing: VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, and VAPI_ASSISTANT_ID are required",
    );
  }

  const normalizedPhoneNumberId = await resolvePhoneNumberId(
    config.vapiApiBaseUrl,
    config.vapiApiKey,
    config.vapiPhoneNumberId,
  );

  const response = await fetch(`${config.vapiApiBaseUrl}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.vapiApiKey}`,
    },
    body: JSON.stringify({
      phoneNumberId: normalizedPhoneNumberId,
      assistantId: config.vapiAssistantId,
      customer: {
        number: request.patient.phone,
        name: request.patient.name,
      },
      assistantOverrides: buildAssistantOverrides(
        request.patient,
        request.fdaAlerts,
      ),
      metadata: {
        patient_id: request.patient.patient_id,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Vapi outbound failed (${response.status})`);
  }

  const payload = (await response.json()) as { id?: string; callId?: string };
  const callId = payload.id ?? payload.callId;
  if (!callId) {
    throw new Error("Vapi response missing call id");
  }

  return {
    callId,
    provider: "vapi",
    status: "queued",
  };
};

const looksLikeUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const normalizePhoneNumber = (value: string): string => {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return value;
};

const resolvePhoneNumberId = async (
  baseUrl: string,
  apiKey: string,
  configuredPhoneNumberId: string,
): Promise<string> => {
  if (looksLikeUuid(configuredPhoneNumberId)) {
    return configuredPhoneNumberId;
  }

  const targetNumber = normalizePhoneNumber(configuredPhoneNumberId);
  const response = await fetch(`${baseUrl}/phone-number`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to resolve phoneNumberId from number: ${response.status}`,
    );
  }

  const phoneNumbers = (await response.json()) as Array<{ id: string; number: string }>;
  const match = phoneNumbers.find(
    (phone) => normalizePhoneNumber(phone.number) === targetNumber,
  );
  if (!match) {
    throw new Error(
      `Configured VAPI_PHONE_NUMBER_ID is not a valid id and no matching number was found for ${targetNumber}`,
    );
  }

  return match.id;
};

export const startOutboundCall = async (
  request: VapiOutboundRequest,
): Promise<VapiOutboundResult> => {
  if (config.useMockVapi) {
    return startMockCall();
  }
  return startLiveCall(request);
};
