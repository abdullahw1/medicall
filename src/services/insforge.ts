import { config } from "../config.js";
import { CallResult, Patient } from "../types.js";

type NotificationChannel = "email";

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

type InsforgeClient = {
  emails: {
    send: (args: {
      to: string;
      subject: string;
      html: string;
    }) => Promise<{ error?: unknown }>;
  };
};

let insforgeClient: InsforgeClient | null = null;

const getInsforgeClient = async (): Promise<InsforgeClient> => {
  if (!config.insforgeUrl || !config.insforgeAnonKey) {
    throw new Error(
      "INSFORGE_URL and INSFORGE_ANON_KEY are required when USE_MOCK_NOTIFICATIONS=false",
    );
  }

  if (!insforgeClient) {
    const { createClient } = await import("@insforge/sdk");
    insforgeClient = createClient({
      baseUrl: config.insforgeUrl,
      anonKey: config.insforgeAnonKey,
    });
  }

  return insforgeClient;
};

const sendInsForgeNotification = async (
  _channel: NotificationChannel,
  recipient: string,
  message: string,
): Promise<void> => {
  const insforge = await getInsforgeClient();
  const { error } = await insforge.emails.send({
    to: recipient,
    subject: "MediCall Alert",
    html: `<p>${message}</p>`,
  });

  if (error) {
    throw new Error(`InsForge SMS invoke failed: ${String(error)}`);
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
    sendNotification("email", patient.caregiver_email, message),
    sendNotification("email", patient.doctor_email, message),
  ]);
};

