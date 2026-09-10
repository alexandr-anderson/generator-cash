import { mailConfigured } from "./mail";
import {
  openaiConfigured,
  openaiHost,
  openaiImageConfigured,
  openaiImageHost,
  openaiImageModelOrEmpty,
  openaiModelOrEmpty,
} from "./openai";

export type RuntimeStatus = {
  mailConfigured: boolean;
  databaseConfigured: boolean;
  openaiConfigured: boolean;
  openaiHost: string;
  openaiModel: string;
  openaiImageConfigured: boolean;
  openaiImageHost: string;
  openaiImageModel: string;
  appUrl: string;
  nodeEnv: string;
};

export function runtimeStatus(): RuntimeStatus {
  return {
    mailConfigured: mailConfigured(),
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    openaiConfigured: openaiConfigured(),
    openaiHost: openaiHost(),
    openaiModel: openaiModelOrEmpty(),
    openaiImageConfigured: openaiImageConfigured(),
    openaiImageHost: openaiImageHost(),
    openaiImageModel: openaiImageModelOrEmpty(),
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
    } aiHost=${status.openaiHost} textModel=${status.openaiModel || "MISSING_OPENAI_MODEL"} image=${
      status.openaiImageConfigured ? "ok" : "MISSING_OPENAI_IMAGE_API"
    } imageHost=${status.openaiImageHost || "unset"} imageModel=${status.openaiImageModel || "MISSING_OPENAI_IMAGE_MODEL"}`,
  );
}
