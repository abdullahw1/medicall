import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 8080),
  appUrl: process.env.APP_URL ?? "http://localhost:8080",
  useMockNotifications: process.env.USE_MOCK_NOTIFICATIONS === "true",
  useMockVapi: process.env.USE_MOCK_VAPI === "true",
  vapiApiBaseUrl: process.env.VAPI_API_BASE_URL ?? "https://api.vapi.ai",
  vapiApiKey: process.env.VAPI_API_KEY ?? "",
  vapiPhoneNumberId: process.env.VAPI_PHONE_NUMBER_ID ?? "",
  vapiAssistantId: process.env.VAPI_ASSISTANT_ID ?? "",
  insforgeUrl: process.env.INSFORGE_URL ?? "",
  insforgeAnonKey: process.env.INSFORGE_ANON_KEY ?? "",
  tinyfishFdaFeedUrl: getEnv(
    "TINYFISH_FDA_FEED_URL",
    "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls-market-withdrawals-safety-alerts/rss.xml",
  ),
};

