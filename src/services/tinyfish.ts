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
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch FDA feed (${response.status})`);
  }

  const xml = await response.text();
  const entries = parseRssItems(xml);
  if (entries.length === 0) {
    return [];
  }

  const meds = patient.medications.map((medication) => medication.toLowerCase());

  const matched = entries.filter((entry) => {
    const haystack = `${entry.title} ${entry.description}`.toLowerCase();
    return meds.some((med) => haystack.includes(med));
  });

  return matched.slice(0, 5).map((entry) => `${entry.title} (${entry.link})`);
};

