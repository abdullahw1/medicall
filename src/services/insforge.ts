import { config } from "../config.js";
import { CallResult, Patient } from "../types.js";

type NotificationChannel = "sms" | "email";

const sendMockNotification = async (
  channel: NotificationChannel,
  recipient: string,
  message: string,
): Promise<void> => {
  console.log(
    `[mock-${channel}] sent to ${recipient}: ${message.slice(0, 120)}${
      message.length > 120 ? "..." : ""
    }`,
  );
};

const sendInsForgeNotification = async (
  channel: NotificationChannel,
  recipient: string,
  message: string,
): Promise<void> => {
  if (!config.insforgeApiBaseUrl || !config.insforgeApiKey) {
    throw new Error(
      "INSFORGE_API_BASE_URL and INSFORGE_API_KEY are required when USE_MOCK_NOTIFICATIONS=false",
    );
  }

  const response = await fetch(`${config.insforgeApiBaseUrl}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.insforgeApiKey}`,
    },
    body: JSON.stringify({
      channel,
      recipient,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `InsForge notification failed with status ${response.status}`,
    );
  }
};

const sendNotification = async (
  channel: NotificationChannel,
  recipient: string,
  message: string,
): Promise<void> => {
  if (config.useMockNotifications) {
    await sendMockNotification(channel, recipient, message);
    return;
  }
  await sendInsForgeNotification(channel, recipient, message);
};

export const sendCaregiverAndDoctorAlert = async (
  patient: Patient,
  callResult: CallResult,
): Promise<void> => {
  const message = [
    `MediCall alert for ${patient.name}.`,
    `Status: ${callResult.status}.`,
    callResult.flags.length > 0 ? `Flags: ${callResult.flags.join(", ")}.` : "",
    `Transcript: ${callResult.transcript}`,
  ]
    .filter(Boolean)
    .join(" ");

  await Promise.all([
    sendNotification("sms", patient.caregiver_phone, message),
    sendNotification("email", patient.caregiver_email, message),
    sendNotification("email", patient.doctor_email, message),
  ]);
};

