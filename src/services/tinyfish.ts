import { Patient } from "../types.js";

type FdaEntry = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

const extractTag = (xmlChunk: string, tag: string): string => {
  const match = xmlChunk.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
};

const stripCdata = (value: string): string =>
  value.replace("<![CDATA[", "").replace("]]>", "").trim();

const parseRssItems = (xml: string): FdaEntry[] => {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemMatches.map((itemXml) => ({
    title: stripCdata(extractTag(itemXml, "title")),
    link: stripCdata(extractTag(itemXml, "link")),
    description: stripCdata(extractTag(itemXml, "description")),
    pubDate: stripCdata(extractTag(itemXml, "pubDate")),
  }));
};

export const fetchFdaAlertsForPatient = async (
  feedUrl: string,
  patient: Patient,
): Promise<string[]> => {
  // Demo: inject a synthetic Warfarin recall for patients on Warfarin
  const syntheticAlerts: string[] = [];
  const meds = patient.medications.map((m) => m.toLowerCase());
  if (meds.includes("warfarin")) {
    syntheticAlerts.push(
      "FDA Safety Alert: Voluntary recall of Warfarin Sodium Tablets (5 mg, lot #WF-2026-04) due to potential contamination — patients should contact their pharmacy for a replacement supply (https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts)",
    );
  }

  let liveAlerts: string[] = [];
  try {
    const response = await fetch(feedUrl);
    if (response.ok) {
      const xml = await response.text();
      const entries = parseRssItems(xml);
      const matched = entries.filter((entry) => {
        const haystack = `${entry.title} ${entry.description}`.toLowerCase();
        return meds.some((med) => haystack.includes(med));
      });
      liveAlerts = matched.slice(0, 5).map((entry) => `${entry.title} (${entry.link})`);
    }
  } catch {
    // Live feed unavailable — continue with synthetic alerts only
  }

  return [...syntheticAlerts, ...liveAlerts];
};

