import { CallResult } from "../types.js";

export const shouldEscalateAlert = (recentCalls: CallResult[]): boolean => {
  if (recentCalls.length === 0) {
    return false;
  }

  const concernTriggered = recentCalls.some((call) => call.status === "concern");
  if (concernTriggered) {
    return true;
  }

  const missedDoseCount = recentCalls.filter(
    (call) => call.status === "missed_meds",
  ).length;
  if (missedDoseCount >= 2) {
    return true;
  }

  const noAnswerStreak = recentCalls
    .slice(0, 3)
    .every((call) => call.status === "no_answer");

  return noAnswerStreak;
};

