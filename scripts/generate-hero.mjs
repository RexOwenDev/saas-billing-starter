#!/usr/bin/env node
/**
 * Generates the docs/hero.png showcase image using Google Gemini Imagen 4.0.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/generate-hero.mjs
 *   # or via package.json: npm run generate:hero
 *
 * Output: docs/hero.png  (1792×1024, overwritten if exists)
 *
 * Requirements:
 *   - Node.js 18+ (uses native fetch + fs/promises)
 *   - GEMINI_API_KEY env var (Imagen 4.0 access required on that key)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_PATH = join(ROOT, "docs", "hero.png");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("✗ GEMINI_API_KEY env var is required");
  process.exit(1);
}

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateImages?key=${API_KEY}`;

const PROMPT = [
  "A sleek, dark-mode SaaS dashboard hero image.",
  "Shows a billing overview UI with a subscription tier badge reading 'Pro',",
  "a usage progress bar at 73%, a Stripe payment card graphic, and a minimal",
  "line graph of monthly recurring revenue trending upward.",
  "Color palette: deep navy background (#0f172a), electric violet accents (#7c3aed),",
  "white typography, subtle glassmorphism card effect.",
  "Clean, professional, modern fintech aesthetic. No people. No text overlays.",
  "16:9 widescreen, ultra-high detail, product screenshot style.",
].join(" ");

async function generateHero() {
  console.log("→ Generating hero image via Gemini Imagen 4.0…");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: { text: PROMPT },
      numberOfImages: 1,
      aspectRatio: "16:9",
      safetyFilterLevel: "BLOCK_ONLY_HIGH",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`✗ Imagen API error ${response.status}: ${body}`);
    process.exit(1);
  }

  const data = await response.json();

  const imageData = data?.generatedImages?.[0]?.image?.imageBytes
    ?? data?.predictions?.[0]?.bytesBase64Encoded;

  if (!imageData) {
    console.error("✗ No image data in response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const buffer = Buffer.from(imageData, "base64");

  await mkdir(join(ROOT, "docs"), { recursive: true });
  await writeFile(OUTPUT_PATH, buffer);

  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`✓ Saved docs/hero.png (${kb} KB)`);
}

generateHero().catch((err) => {
  console.error("✗ Unexpected error:", err);
  process.exit(1);
});
