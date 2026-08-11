export type RuntimeEnvironment = NodeJS.ProcessEnv;

export function getOptionalPrivateR2BucketName(
  configuredName: string | undefined,
  publicBucketName: string,
): string | null {
  const bucketName = configuredName?.trim();
  if (!bucketName) return null;
  if (bucketName === publicBucketName) {
    throw new Error("R2_PRIVATE_BUCKET_NAME must be different from the public R2_BUCKET_NAME.");
  }
  return bucketName;
}

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
