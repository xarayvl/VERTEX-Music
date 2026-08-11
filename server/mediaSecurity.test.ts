import assert from "node:assert/strict";
import test from "node:test";
import { InvalidImageUploadError, parseImageDataUrl, validateImageUpload } from "./mediaSecurity.js";

const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("image validation accepts a PNG whose signature and dimensions match", () => {
  const image = validateImageUpload(ONE_PIXEL_PNG, "image/png");
  assert.equal(image.mimeType, "image/png");
  assert.equal(image.extension, "png");
  assert.equal(image.width, 1);
  assert.equal(image.height, 1);
});

test("image validation rejects SVG data URLs", () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
  assert.throws(
    () => parseImageDataUrl(`data:image/svg+xml;base64,${svg}`),
    (error: unknown) => error instanceof InvalidImageUploadError && /SVG is not allowed/.test(error.message),
  );
});

test("image validation rejects a forged PNG MIME type", () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString("base64");
  assert.throws(
    () => validateImageUpload(svg, "image/png"),
    (error: unknown) => error instanceof InvalidImageUploadError && /does not match/.test(error.message),
  );
});
