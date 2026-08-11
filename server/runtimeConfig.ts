export type RuntimeEnvironment = NodeJS.ProcessEnv;

export function getRuntimePort(configuredPort: string | undefined): number {
  if (!configuredPort?.trim()) return 3000;
  const port = Number(configuredPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

export function getConfiguredPublicBaseUrl(env: RuntimeEnvironment): string | undefined {
  const explicitUrl = env.PUBLIC_BASE_URL?.trim();
  if (explicitUrl) return explicitUrl;
  if (env.RENDER === "true") return env.RENDER_EXTERNAL_URL?.trim() || undefined;
  return undefined;
}
