type PharmacologyAnswer = {
  answer: string;
  citations: string[];
  safety_level: "routine" | "caution" | "urgent";
};

const ALCOHOL_KEYWORDS = ["alcohol", "wine", "beer", "vodka", "drink"];
const INTERACTION_KEYWORDS = ["with", "mix", "interaction", "together"];

const containsAny = (value: string, keywords: string[]): boolean =>
  keywords.some((k) => value.includes(k));

const hasMedication = (medications: string[], name: string): boolean =>
  medications.some((m) => m.toLowerCase().includes(name.toLowerCase()));

export const isDrugQuestion = (transcript: string): boolean => {
  const text = transcript.toLowerCase();
  return (
    text.includes("can i take") ||
    text.includes("is it safe") ||
    text.includes("side effect") ||
    text.includes("medicine question") ||
    (containsAny(text, ALCOHOL_KEYWORDS) && containsAny(text, INTERACTION_KEYWORDS))
  );
};

export const answerDrugQuestion = (
  question: string,
  medications: string[],
): PharmacologyAnswer => {
  const text = question.toLowerCase();
  const citations = [
    "https://www.fda.gov/drugs",
    "https://medlineplus.gov/druginformation.html",
  ];

  if (containsAny(text, ALCOHOL_KEYWORDS)) {
    if (hasMedication(medications, "metformin")) {
      return {
        safety_level: "caution",
        answer:
          "Please avoid or limit alcohol and discuss this with your doctor. Alcohol can increase side-effect risk with metformin, including stomach upset and rare serious reactions.",
        citations,
      };
    }

    return {
      safety_level: "caution",
      answer:
        "Use caution with alcohol and medications. The safest next step is to check with your doctor or pharmacist before drinking.",
      citations,
    };
  }

  if (text.includes("side effect")) {
    return {
      safety_level: "routine",
      answer:
        "Common side effects vary by medication. If symptoms are severe, persistent, or include chest pain, dizziness, or confusion, contact your doctor immediately.",
      citations,
    };
  }

  return {
    safety_level: "routine",
    answer:
      "I can share general safety guidance, but medication timing and interactions should be confirmed with your doctor or pharmacist for your exact regimen.",
    citations,
  };
};
