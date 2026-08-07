import type { Request } from "express";
import type { TrackRecord } from "./db.js";

const SOCIAL_META_MARKER = "<!-- vertex-social-meta -->";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstForwardedValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").split(",")[0].trim();
}

function validPublicOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getPublicOrigin(req: Request): string {
  const configuredOrigin =
    process.env.PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    "";
  const validConfiguredOrigin = validPublicOrigin(configuredOrigin);
  if (validConfiguredOrigin) return validConfiguredOrigin;

  const forwardedProtocol = firstForwardedValue(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : req.protocol;
  const forwardedHost = firstForwardedValue(req.headers["x-forwarded-host"]);
  const host = forwardedHost || req.get("host") || "localhost:3000";
  return validPublicOrigin(`${protocol}://${host}`) || "http://localhost:3000";
}

function absoluteHttpUrl(value: string | undefined, origin: string): string | null {
  if (!value || value.startsWith("data:")) return null;
  try {
    const parsed = new URL(value, origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function injectTrackSocialMeta(
  html: string,
  track: TrackRecord,
  origin: string,
): string {
  const trackUrl = new URL(`/track/${encodeURIComponent(track.id)}`, origin).toString();
  const artistUrl = new URL(`/artist/${encodeURIComponent(track.userId)}`, origin).toString();
  const coverUrl = absoluteHttpUrl(track.coverUrl, origin);
  const shareTitle = `${track.title} — ${track.artist}`;
  const pageTitle = `${shareTitle} | VERTEX Music`;
  const description = `Listen to “${track.title}” by ${track.artist} on VERTEX Music${track.album ? ` · ${track.album}` : ""}.`;

  const meta = [
    SOCIAL_META_MARKER,
    `<title>${escapeHtml(pageTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(trackUrl)}" />`,
    `<meta property="og:site_name" content="VERTEX Music" />`,
    `<meta property="og:type" content="music.song" />`,
    `<meta property="og:title" content="${escapeHtml(shareTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(trackUrl)}" />`,
    `<meta property="music:musician" content="${escapeHtml(artistUrl)}" />`,
    `<meta property="music:duration" content="${Math.max(0, Math.round(Number(track.duration) || 0))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(shareTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:label1" content="Artist" />`,
    `<meta name="twitter:data1" content="${escapeHtml(track.artist)}" />`,
    `<meta name="twitter:label2" content="Duration" />`,
    `<meta name="twitter:data2" content="${formatDuration(track.duration)}" />`,
    coverUrl ? `<meta property="og:image" content="${escapeHtml(coverUrl)}" />` : "",
    coverUrl ? `<meta property="og:image:alt" content="Cover art for ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}" />` : "",
    coverUrl ? `<meta name="twitter:image" content="${escapeHtml(coverUrl)}" />` : "",
  ].filter(Boolean).join("\n    ");

  // The base Vite document already has a generic title. Remove it so social
  // parsers and browsers see one authoritative, track-specific title.
  const withoutGenericTitle = html.replace(/\s*<title>[^<]*<\/title>/i, "");
  return withoutGenericTitle.replace(/<\/head>/i, `    ${meta}\n  </head>`);
}
