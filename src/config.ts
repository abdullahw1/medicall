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
  useMockNotifications: process.env.USE_MOCK_NOTIFICATIONS !== "false",
  insforgeApiBaseUrl: process.env.INSFORGE_API_BASE_URL ?? "",
  insforgeApiKey: process.env.INSFORGE_API_KEY ?? "",
  tinyfishFdaFeedUrl: getEnv(
    "TINYFISH_FDA_FEED_URL",
    "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls-market-withdrawals-safety-alerts/rss.xml",
  ),
};

