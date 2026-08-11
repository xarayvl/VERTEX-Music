import type { RequestHandler } from "express";

const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://accounts.google.com https://*.r2.cloudflarestorage.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "manifest-src 'self'",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "upgrade-insecure-requests",
  "worker-src 'self' blob:",
].join("; ");

export function getSecurityHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-DNS-Prefetch-Control": "off",
    "X-Download-Options": "noopen",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-XSS-Protection": "0",
  };

  if (isProduction) {
    headers["Content-Security-Policy"] = PRODUCTION_CSP;
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

export function securityHeaders(isProduction: boolean): RequestHandler {
  const headers = getSecurityHeaders(isProduction);
  return (_req, res, next) => {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    next();
  };
}

export function requireHttps(publicOrigin: string): RequestHandler {
  return (req, res, next) => {
    if (req.secure) return next();
    return res.redirect(308, `${publicOrigin}${req.originalUrl}`);
  };
}

export function getProductionPublicOrigin(configuredUrl: string | undefined): string {
  if (!configuredUrl?.trim()) {
    throw new Error("PUBLIC_BASE_URL is required when NODE_ENV=production.");
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error("PUBLIC_BASE_URL must be a valid HTTPS origin.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("PUBLIC_BASE_URL must be an HTTPS origin without credentials, path, query, or fragment.");
  }

  return parsed.origin;
}
