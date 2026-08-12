const MAX_GENERATED_IMAGE_BYTES = 20 * 1024 * 1024;

export type GeneratedImagePayload = {
  base64Data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteLength: number;
};

export function buildImageGenerationsUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NVIDIA_IMAGE_API_BASE_URL must use HTTP(S).");
  }
  if (parsed.username || parsed.password) {
    throw new Error("NVIDIA_IMAGE_API_BASE_URL must not contain credentials.");
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = cleanPath.endsWith("/v1/images/generations")
    ? cleanPath
    : cleanPath.endsWith("/v1")
      ? `${cleanPath}/images/generations`
      : `${cleanPath}/v1/images/generations`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function detectImageMimeType(buffer: Buffer): GeneratedImagePayload["mimeType"] | null {
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  return null;
}

export function parseGeneratedImageResponse(body: unknown): GeneratedImagePayload {
  const rawBase64 = (body as any)?.data?.[0]?.b64_json;
  if (typeof rawBase64 !== "string" || !rawBase64.trim()) {
    throw new Error("The image provider returned no image data.");
  }

  const base64Data = rawBase64
    .trim()
    .replace(/^data:image\/(?:png|jpeg|jpg|webp);base64,/i, "")
    .replace(/[\r\n\s]/g, "");
  if (!base64Data || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data) || base64Data.length % 4 === 1) {
    throw new Error("The image provider returned invalid base64 data.");
  }
  if (base64Data.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES / 3) * 4) {
    throw new Error("The generated image exceeds the 20 MB limit.");
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0 || buffer.length > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error("The generated image has an invalid size.");
  }
  const mimeType = detectImageMimeType(buffer);
  if (!mimeType) {
    throw new Error("The image provider returned an unsupported image format.");
  }

  return { base64Data, mimeType, byteLength: buffer.length };
}
