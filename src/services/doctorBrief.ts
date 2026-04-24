import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "../config.js";
import { CallResult, Patient } from "../types.js";

export type DoctorBrief = {
  brief_id: string;
  patient_id: string;
  call_id: string;
  generated_at: string;
  preview: string;
  full_brief: string;
  citations: string[];
  x402_price_usd: number;
  unlock_state: "locked" | "unlocked";
};

const CITED_DOC_PATH = resolve(process.cwd(), "docs", "cited.md");

const UNIQUE_CONCERN_CITATIONS = [
  "https://www.cdc.gov/chronicdisease/index.htm",
  "https://www.heart.org/en/health-topics/consumer-healthcare/what-is-cardiovascular-disease",
  "https://medlineplus.gov/chestpain.html",
  "https://medlineplus.gov/dizzinessandvertigo.html",
];

const unique = (items: string[]): string[] => Array.from(new Set(items));

const buildCitationList = (callResult: CallResult): string[] => {
  const fromFda = callResult.fda_alerts
    .map((alert) => {
      const urlMatch = alert.match(/\((https?:[^)]+)\)\s*$/);
      return urlMatch?.[1] ?? "";
    })
    .filter(Boolean);

  return unique([...fromFda, ...UNIQUE_CONCERN_CITATIONS]).slice(0, 6);
};

const buildPreview = (patient: Patient, callResult: CallResult): string =>
  `Concern call for ${patient.name}: ${callResult.flags.join(", ") || "general concern"} flagged during medication check.`;

const buildFullBrief = (
  patient: Patient,
  callResult: CallResult,
  citations: string[],
): string =>
  [
    `Patient: ${patient.name} (${patient.patient_id})`,
    `Call timestamp: ${callResult.timestamp}`,
    `Status: ${callResult.status}`,
    `Flags: ${callResult.flags.join(", ") || "none"}`,
    "",
    "Clinical context:",
    `- Transcript excerpt: "${callResult.transcript}"`,
    `- FDA context count: ${callResult.fda_alerts.length}`,
    "",
    "Recommended next actions:",
    "- Contact patient for same-day follow-up and symptom triage.",
    "- Verify medication adherence and dose timing.",
    "- Escalate to emergency care if chest pain or neurologic symptoms worsen.",
    "",
    "Sources:",
    ...citations.map((c) => `- ${c}`),
  ].join("\n");

const ensureCitedDoc = async (): Promise<void> => {
  await mkdir(dirname(CITED_DOC_PATH), { recursive: true });
  try {
    await readFile(CITED_DOC_PATH, "utf8");
  } catch {
    await writeFile(
      CITED_DOC_PATH,
      "# MediCall Cited Briefs\n\nGenerated doctor-brief evidence with source links.\n",
      "utf8",
    );
  }
};

export const appendCitedBriefMarkdown = async (brief: DoctorBrief): Promise<void> => {
  await ensureCitedDoc();
  const block = [
    "",
    `## Brief ${brief.brief_id}`,
    `- Patient: ${brief.patient_id}`,
    `- Call ID: ${brief.call_id}`,
    `- Generated: ${brief.generated_at}`,
    `- Unlock: ${brief.unlock_state} ($${brief.x402_price_usd.toFixed(2)} via x402)`,
    "",
    "### Preview",
    brief.preview,
    "",
    "### Full Brief",
    "```text",
    brief.full_brief,
    "```",
    "",
  ].join("\n");

  const existing = await readFile(CITED_DOC_PATH, "utf8");
  await writeFile(CITED_DOC_PATH, `${existing}${block}`, "utf8");
};

export const generateDoctorBrief = async (
  patient: Patient,
  callResult: CallResult,
): Promise<DoctorBrief> => {
  const citations = buildCitationList(callResult);
  const brief: DoctorBrief = {
    brief_id: `${Date.now()}-${callResult.call_id.slice(0, 8)}`,
    patient_id: patient.patient_id,
    call_id: callResult.call_id,
    generated_at: new Date().toISOString(),
    preview: buildPreview(patient, callResult),
    full_brief: buildFullBrief(patient, callResult, citations),
    citations,
    x402_price_usd: config.x402PriceUsd,
    unlock_state: "locked",
  };

  await appendCitedBriefMarkdown(brief);
  return brief;
};
