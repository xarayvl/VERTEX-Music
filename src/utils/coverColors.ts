// Extracts representative colors from an album cover image so UI chrome
// (Now Playing background, live EQ bars, glows) can theme itself off the
// actual artwork instead of relying on per-track accentColor/secondaryColor
// fields that are almost never set (nothing in the upload flow collects
// them, so real user-uploaded tracks are always undefined here).

export interface CoverPalette {
  accent: string;
  secondary: string;
  /** Darkened/desaturated tone, handy for background washes so text stays readable */
  ambient: string;
}

const DEFAULT_PALETTE: CoverPalette = {
  accent: '#A855F7',
  secondary: '#D946EF',
  ambient: '#2a1a3d',
};

// Small in-memory cache so we don't re-decode + re-sample the same cover
// image every time the user re-opens the Now Playing screen for a track
// they've already viewed this session.
const paletteCache = new Map<string, CoverPalette>();

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/**
 * Loads an image, samples a downscaled version of it on an offscreen canvas,
 * and buckets pixels by quantized color to find the most common vibrant
 * (non-black/white/gray) tones. Falls back to the default purple/pink
 * palette if the image fails to load or the canvas is CORS-tainted (some
 * hosts don't send Access-Control-Allow-Origin, which blocks pixel reads).
 */
export async function extractCoverPalette(imageUrl: string | undefined | null): Promise<CoverPalette> {
  if (!imageUrl) return DEFAULT_PALETTE;
  const cached = paletteCache.get(imageUrl);
  if (cached) return cached;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imageUrl;
    });

    const SAMPLE_SIZE = 48;
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_PALETTE;

    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    // Bucket pixels into quantized RGB cells, weighting by saturation so
    // vivid album-art colors win out over dull grays/blacks/whites.
    const buckets = new Map<string, { r: number; g: number; b: number; weight: number }>();
    const STEP = 24;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 200) continue;

      const { s, l } = rgbToHsl(r, g, b);
      // Skip near-black, near-white, and washed-out pixels — they rarely
      // make a good UI accent and would otherwise dominate quiet artwork.
      if (l < 0.08 || l > 0.92) continue;

      const key = `${Math.round(r / STEP)}-${Math.round(g / STEP)}-${Math.round(b / STEP)}`;
      const weight = 0.15 + s; // saturated pixels count for more
      const existing = buckets.get(key);
      if (existing) {
        existing.r += r * weight;
        existing.g += g * weight;
        existing.b += b * weight;
        existing.weight += weight;
      } else {
        buckets.set(key, { r: r * weight, g: g * weight, b: b * weight, weight });
      }
    }

    const ranked = Array.from(buckets.values())
      .map((b) => ({ r: b.r / b.weight, g: b.g / b.weight, b: b.b / b.weight, weight: b.weight }))
      .sort((a, b) => b.weight - a.weight);

    if (ranked.length === 0) {
      paletteCache.set(imageUrl, DEFAULT_PALETTE);
      return DEFAULT_PALETTE;
    }

    const top = ranked[0];
    // For the secondary color, prefer the next-ranked bucket that's
    // meaningfully different in hue from the top pick, so the gradient
    // actually has two distinct colors instead of two near-identical ones.
    const topHsl = rgbToHsl(top.r, top.g, top.b);
    let second = ranked.find((c) => {
      const hsl = rgbToHsl(c.r, c.g, c.b);
      const hueDiff = Math.min(Math.abs(hsl.h - topHsl.h), 360 - Math.abs(hsl.h - topHsl.h));
      return hueDiff > 30;
    });
    if (!second) second = ranked[Math.min(1, ranked.length - 1)] || top;

    const accent = rgbToHex(top.r, top.g, top.b);
    const secondary = rgbToHex(second.r, second.g, second.b);
    // Ambient tone: same hue family as accent but pulled dark, for use as a
    // full-bleed background wash that still leaves white text readable.
    const ambient = rgbToHex(top.r * 0.25, top.g * 0.25, top.b * 0.25);

    const palette: CoverPalette = { accent, secondary, ambient };
    paletteCache.set(imageUrl, palette);
    return palette;
  } catch {
    // CORS-tainted canvas or failed image load — silently fall back.
    return DEFAULT_PALETTE;
  }
}
