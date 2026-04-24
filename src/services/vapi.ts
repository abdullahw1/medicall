import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { Patient } from "../types.js";

export type VapiOutboundRequest = {
  patient: Patient;
  fdaAlerts: string[];
  webhookUrl?: string;
};

export type VapiOutboundResult = {
  callId: string;
  provider: "vapi" | "mock";
  status: "queued" | "fallback";
};

const buildAssistantOverrides = (patient: Patient, fdaAlerts: string[]) => {
  const firstName = patient.name.split(" ")[0];
  const medsFormatted = patient.medications.join(", ");

  const hasRecall = fdaAlerts.length > 0;
  const recallBlock = hasRecall
    ? `\n\nIMPORTANT — FDA RECALL ALERT:\nOne or more of this patient's medications has an active FDA recall or safety alert. Details:\n${fdaAlerts.join("\n")}\nYou MUST inform the patient about this recall during the call. Tell them which medication is affected, that there is an active recall, and that they should contact their pharmacy on file to get a replacement as soon as possible. Be clear but calm — do not alarm them unnecessarily.`
    : `\n\nNo FDA recall alerts matched this patient's medications today. Do NOT mention any recalls.`;

  const systemPrompt = `You are a friendly, warm healthcare check-in assistant for MediCall. Your name is MediCall. You are calling ${patient.name} (first name: ${firstName}) for a routine medication check-in.

PATIENT INFO:
- Name: ${patient.name}
- Medications: ${medsFormatted}
- Timezone: ${patient.timezone}

YOUR GOALS (in order):
1. Greet the patient warmly by first name. Confirm you're speaking with them.
2. Ask how they're feeling today. Listen for any health concerns (dizziness, chest pain, confusion, shortness of breath). If they mention any, express concern and note it.
3. Ask if they've taken their medications today (${medsFormatted}). If they missed any, gently remind them how important it is.
4. ${hasRecall ? "Inform them about the FDA recall (see below). Tell them which medication is affected and advise them to contact their pharmacy to get a replacement." : "No recall to mention — skip this step."}
5. Ask if they have any questions about their medications.
6. Wrap up warmly. Tell them you'll check in again soon and to take care.

TONE: Conversational, caring, like a friendly nurse. Use short sentences. Don't sound robotic. Pause naturally. Use the patient's first name occasionally.

DO NOT:
- Diagnose anything
- Prescribe or change medications
- Give specific medical advice beyond "contact your doctor" or "contact your pharmacy"
- Rush through the call${recallBlock}`;

  const firstMessage = `Hey, is this ${firstName}? Hi! This is MediCall, just calling to check in on you today. How are you doing?`;

  return {
    firstMessage,
    model: {
      provider: "openai" as const,
      model: "gpt-4.1" as const,
      messages: [{ role: "system" as const, content: systemPrompt }],
    },
    variableValues: {
      patient_name: patient.name,
      patient_medications: medsFormatted,
      patient_timezone: patient.timezone,
      fda_context: hasRecall ? fdaAlerts.join(" ") : "none",
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

  const callPayload = {
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
    ...(request.webhookUrl ? { serverUrl: request.webhookUrl } : {}),
  };

  const response = await fetch(`${config.vapiApiBaseUrl}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.vapiApiKey}`,
    },
    body: JSON.stringify(callPayload),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      detail = payload.message ?? payload.error ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    if (detail) {
      console.error("Vapi error body:", detail);
    }
    throw new Error(
      `Vapi outbound failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
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
