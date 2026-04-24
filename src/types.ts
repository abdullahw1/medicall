import { z } from "zod";

export const patientSchema = z.object({
  patient_id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().regex(/^\+1\d{10}$/),
  medications: z.array(z.string().min(1)),
  caregiver_phone: z.string().regex(/^\+1\d{10}$/),
  caregiver_email: z.email(),
  doctor_email: z.email(),
  call_time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1),
});

export const callStatusSchema = z.enum([
  "took_meds",
  "missed_meds",
  "no_answer",
  "concern",
]);

export const callResultSchema = z.object({
  call_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  timestamp: z.string(),
  status: callStatusSchema,
  transcript: z.string(),
  flags: z.array(z.string()),
  fda_alerts: z.array(z.string()),
  alert_sent: z.boolean(),
});

export const vapiOutboundRequestSchema = z.object({
  patient_id: z.string().uuid(),
});

export const vapiWebhookSchema = z.object({
  call_id: z.string().min(1),
  transcript: z.string().default(""),
  call_status: z.enum(["completed", "no_answer", "failed"]).default("completed"),
});

export const pharmacologyQuerySchema = z.object({
  patient_id: z.string().uuid(),
  question: z.string().min(3),
});

export const alertDeliverySchema = z.object({
  channel: z.enum(["email", "sms"]),
  recipient: z.string().min(3),
  target: z.enum(["caregiver", "doctor"]),
  status: z.enum(["sent", "failed", "skipped"]),
  detail: z.string().optional(),
  timestamp: z.string(),
});

export const alertRecordSchema = z.object({
  alert_id: z.string().uuid(),
  call_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  created_at: z.string(),
  acknowledged: z.boolean(),
  acknowledged_at: z.string().nullable(),
  deliveries: z.array(alertDeliverySchema),
});

export type Patient = z.infer<typeof patientSchema>;
export type CallResult = z.infer<typeof callResultSchema>;
export type AlertDelivery = z.infer<typeof alertDeliverySchema>;
export type AlertRecord = z.infer<typeof alertRecordSchema>;

