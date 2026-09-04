export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logBootStatus } = await import("./lib/runtime-status");
  logBootStatus();
}
