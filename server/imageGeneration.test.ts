import assert from "node:assert/strict";
import test from "node:test";
import { buildImageGenerationsUrl, parseGeneratedImageResponse } from "./imageGeneration.js";

test("buildImageGenerationsUrl accepts a NIM root, v1 root, or full endpoint", () => {
  assert.equal(
    buildImageGenerationsUrl("http://localhost:8000"),
    "http://localhost:8000/v1/images/generations",
  );
  assert.equal(
    buildImageGenerationsUrl("https://images.example.com/nim/v1/"),
    "https://images.example.com/nim/v1/images/generations",
  );
  assert.equal(
    buildImageGenerationsUrl("https://images.example.com/v1/images/generations"),
    "https://images.example.com/v1/images/generations",
  );
});

test("parseGeneratedImageResponse accepts valid PNG output", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const result = parseGeneratedImageResponse({ data: [{ b64_json: pngHeader.toString("base64") }] });

  assert.equal(result.mimeType, "image/png");
  assert.equal(result.byteLength, pngHeader.length);
  assert.equal(result.base64Data, pngHeader.toString("base64"));
});

test("parseGeneratedImageResponse rejects missing or non-image output", () => {
  assert.throws(() => parseGeneratedImageResponse({ data: [] }), /no image data/i);
  assert.throws(
    () => parseGeneratedImageResponse({ data: [{ b64_json: Buffer.from("not an image").toString("base64") }] }),
    /unsupported image format/i,
  );
});
