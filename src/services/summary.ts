import { CallResult, Patient } from "../types.js";

export const buildWeeklySummary = (
  patient: Patient,
  weeklyCalls: CallResult[],
): string => {
  const took = weeklyCalls.filter((call) => call.status === "took_meds").length;
  const missed = weeklyCalls.filter(
    (call) => call.status === "missed_meds",
  ).length;
  const concerns = weeklyCalls.filter((call) => call.status === "concern");

  const concernLine =
    concerns.length > 0
      ? `Concerns were flagged on ${concerns.length} call(s): ${concerns
          .flatMap((call) => call.flags)
          .filter(Boolean)
          .join(", ")}.`
      : "No concern flags were raised this week.";

  return [
    `${patient.name} took ${took} dose-check calls and missed ${missed} this week.`,
    concernLine,
    "MediCall continues monitoring and will alert caregivers immediately when risk thresholds are crossed.",
  ].join(" ");
};

