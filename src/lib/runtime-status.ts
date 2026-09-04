import { mailConfigured } from "./mail";
import { openaiConfigured, openaiHost } from "./openai";

export type RuntimeStatus = {
  mailConfigured: boolean;
  databaseConfigured: boolean;
  openaiConfigured: boolean;
  openaiHost: string;
  appUrl: string;
  nodeEnv: string;
};

export function runtimeStatus(): RuntimeStatus {
  return {
    mailConfigured: mailConfigured(),
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    openaiConfigured: openaiConfigured(),
    openaiHost: openaiHost(),
    appUrl: (process.env.APP_URL || "").replace(/\/$/, ""),
    nodeEnv: process.env.NODE_ENV || "",
  };
}

export function logBootStatus() {
  const status = runtimeStatus();
  console.info(
    `[boot] env=${status.nodeEnv || "unset"} appUrl=${status.appUrl || "unset"} mail=${
      status.mailConfigured ? "ok" : "MISSING_RESEND_API_KEY"
    } db=${status.databaseConfigured ? "set" : "MISSING_DATABASE_URL"} ai=${
      status.openaiConfigured ? "ok" : "MISSING_OPENAI_API_KEY"
    } aiHost=${status.openaiHost}`,
  );
}
