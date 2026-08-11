const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 40_000_000;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class InvalidImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageUploadError";
  }
}

export type ValidatedImageUpload = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

export function parseImageDataUrl(value: string): { base64Data: string; mimeType: string } {
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([\s\S]+)$/i);
  if (!match) {
    throw new InvalidImageUploadError("Unsupported image type. Use JPEG, PNG, or WebP; SVG is not allowed.");
  }
  return { mimeType: match[1].toLowerCase(), base64Data: match[2] };
}

function normalizeImageMimeType(value: string): string {
  const normalized = value.split(";", 1)[0].trim().toLowerCase();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function decodeBase64Strict(value: string): Buffer {
  const clean = value.replace(/[\r\n\s]/g, "");
  if (!clean || clean.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) {
    throw new InvalidImageUploadError("Image is empty or exceeds the 12 MB limit.");
  }
  if (clean.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new InvalidImageUploadError("Image data is not valid base64.");
  }
  const buffer = Buffer.from(clean, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageUploadError("Image is empty or exceeds the 12 MB limit.");
  }
  return buffer;
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
    return null;
  }
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    buffer.length < 45 ||
    !buffer.subarray(0, 8).equals(signature) ||
    buffer.toString("ascii", 12, 16) !== "IHDR" ||
    buffer.toString("ascii", buffer.length - 8, buffer.length - 4) !== "IEND"
  ) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
    const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
    return { width, height };
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const width = 1 + buffer[21] + ((buffer[22] & 0x3f) << 8);
    const height = 1 + (buffer[22] >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10);
    return { width, height };
  }
  if (chunk === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

export function validateImageUpload(base64Data: string, declaredMimeType: string): ValidatedImageUpload {
  return validateImageBuffer(decodeBase64Strict(base64Data), declaredMimeType);
}

export function validateImageBuffer(buffer: Buffer, declaredMimeType: string): ValidatedImageUpload {
  const declaredMime = normalizeImageMimeType(declaredMimeType);
  if (!ALLOWED_IMAGE_MIME_TYPES.has(declaredMime)) {
    throw new InvalidImageUploadError("Unsupported image type. Use JPEG, PNG, or WebP; SVG is not allowed.");
  }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageUploadError("Image is empty or exceeds the 12 MB limit.");
  }
  const candidates = [
    { mimeType: "image/jpeg" as const, extension: "jpg" as const, dimensions: readJpegDimensions(buffer) },
    { mimeType: "image/png" as const, extension: "png" as const, dimensions: readPngDimensions(buffer) },
    { mimeType: "image/webp" as const, extension: "webp" as const, dimensions: readWebpDimensions(buffer) },
  ];
  const detected = candidates.find((candidate) => candidate.dimensions !== null);
  if (!detected || detected.mimeType !== declaredMime) {
    throw new InvalidImageUploadError("Image content does not match its declared JPEG, PNG, or WebP MIME type.");
  }

  const { width, height } = detected.dimensions!;
  if (!width || !height || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new InvalidImageUploadError("Image dimensions are invalid or too large.");
  }

  return { buffer, mimeType: detected.mimeType, extension: detected.extension, width, height };
}
