#!/usr/bin/env node
/**
 * Generates PNG app icons (180, 192, 512) from scratch using only Node.js builtins.
 * Design: dark maroon rounded-square + pink sine wave mark — matches the favicon.
 */

const zlib = require('node:zlib');
const fs   = require('node:fs');
const path = require('node:path');

// ─── PNG encoder ────────────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(w, h, pixels /* Uint8Array RGBA row-major */) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const stride = 1 + w * 4;
  const raw    = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter = None
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * stride + 1 + x * 4;
      raw[d] = pixels[s]; raw[d+1] = pixels[s+1];
      raw[d+2] = pixels[s+2]; raw[d+3] = pixels[s+3];
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon rasteriser ────────────────────────────────────────────────────────

function generateIconPixels(S) {
  const pixels = new Uint8Array(S * S * 4);

  // Palette
  const [bgR, bgG, bgB]  = [26,  8,  18]; // #1a0812
  const [pR,  pG,  pB]   = [212, 104, 140]; // #d4688c

  // Rounded-rect corner radius (~22% — matches favicon rx=7/32)
  const cornerR = Math.round(S * 0.22);

  // Wave params (match favicon proportions)
  const w1Y  = S * 0.500, w1A = S * 0.145, w1SW = S * 0.038;
  const w2Y  = S * 0.615, w2A = S * 0.120, w2SW = S * 0.025;
  const TAU  = Math.PI * 2;
  const PERIOD = 2.5; // full cycles visible across the icon width

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5, py = y + 0.5;

      // ── Rounded-rect clip ──────────────────────────────────────────────
      const dx = Math.max(0, Math.abs(px - S / 2) - (S / 2 - cornerR));
      const dy = Math.max(0, Math.abs(py - S / 2) - (S / 2 - cornerR));
      if (Math.sqrt(dx * dx + dy * dy) > cornerR) {
        // transparent — leave pixels[idx+3] = 0 (already zeroed)
        continue;
      }

      // ── Subtle radial glow ────────────────────────────────────────────
      const gdx = (px - S * 0.50) / (S * 0.40);
      const gdy = (py - S * 0.55) / (S * 0.18);
      const glowA = Math.max(0, 1 - Math.sqrt(gdx*gdx + gdy*gdy)) * 0.10;

      // ── Wave perpendicular-distance (exact for sine) ──────────────────
      const t = (px / S) * PERIOD * TAU;

      const wy1 = w1Y + w1A * Math.sin(t);
      const s1  = w1A * PERIOD * TAU / S * Math.cos(t); // dy/dx at this x
      const d1  = Math.abs(py - wy1) / Math.sqrt(1 + s1 * s1);

      const wy2 = w2Y + w2A * Math.sin(t);
      const s2  = w2A * PERIOD * TAU / S * Math.cos(t);
      const d2  = Math.abs(py - wy2) / Math.sqrt(1 + s2 * s2);

      // Anti-aliased soft edge (1.5px feather)
      const AA    = 1.5;
      const wave1 = Math.max(0, Math.min(1, (w1SW + AA - d1) / AA));
      const wave2 = Math.max(0, Math.min(1, (w2SW + AA - d2) / AA)) * 0.40;
      const waveA = Math.min(1, wave1 + wave2 * (1 - wave1));

      // ── Composite over background ─────────────────────────────────────
      const a    = glowA + waveA * (1 - glowA);
      const idx  = (y * S + x) * 4;
      pixels[idx]   = Math.round(bgR + a * (pR - bgR));
      pixels[idx+1] = Math.round(bgG + a * (pG - bgG));
      pixels[idx+2] = Math.round(bgB + a * (pB - bgB));
      pixels[idx+3] = 255;
    }
  }

  return pixels;
}

// ─── Run ────────────────────────────────────────────────────────────────────

const publicDir = path.join(__dirname, '..', 'public');

for (const size of [180, 192, 512]) {
  process.stdout.write(`Generating icon-${size}.png … `);
  const pxl = generateIconPixels(size);
  const png = makePNG(size, size, pxl);
  fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), png);
  console.log(`${(png.length / 1024).toFixed(1)} KB`);
}

console.log('Icons generated.');
