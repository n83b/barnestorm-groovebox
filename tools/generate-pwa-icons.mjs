import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const outputDirectory = new URL("../web/icons/", import.meta.url);
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let result = value;
  for (let bit = 0; bit < 8; bit += 1) {
    result = (result & 1) !== 0 ? 0xedb88320 ^ (result >>> 1) : result >>> 1;
  }
  return result >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function roundedRectangleDistance(x, y, left, top, right, bottom, radius) {
  const centerX = Math.min(Math.max(x, left + radius), right - radius);
  const centerY = Math.min(Math.max(y, top + radius), bottom - radius);
  return Math.hypot(x - centerX, y - centerY) - radius;
}

function mix(base, overlay, amount) {
  return base.map((channel, index) =>
    Math.round(channel + (overlay[index] - channel) * Math.max(0, Math.min(1, amount)))
  );
}

function createIcon(size, maskable = false) {
  const scale = 4;
  const width = size * scale;
  const pixels = Buffer.alloc(width * width * 4);
  const background = [8, 9, 9, 255];
  const panel = [18, 19, 19, 255];
  const orange = [255, 139, 14, 255];
  const cyan = [0, 217, 210, 255];
  const inset = width * (maskable ? 0.18 : 0.11);
  const panelRadius = width * 0.16;
  const gridGap = width * 0.035;
  const gridWidth = width - inset * 2;
  const padSize = (gridWidth - gridGap * 3) / 4;
  const activePads = new Set([0, 4, 6, 9, 12, 14, 15]);

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const panelDistance = roundedRectangleDistance(
        x,
        y,
        inset * 0.55,
        inset * 0.55,
        width - inset * 0.55,
        width - inset * 0.55,
        panelRadius
      );
      const vignette = Math.hypot(x - width / 2, y - width / 2) / (width * 0.72);
      let color = mix(background, [0, 0, 0, 255], Math.max(0, vignette - 0.48) * 0.55);

      if (panelDistance < 0) {
        color = mix(panel, color, Math.max(0, panelDistance + width * 0.035) / (width * 0.035));
      }

      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const index = row * 4 + column;
          const left = inset + column * (padSize + gridGap);
          const top = inset + row * (padSize + gridGap);
          const distance = roundedRectangleDistance(
            x,
            y,
            left,
            top,
            left + padSize,
            top + padSize,
            padSize * 0.2
          );
          if (distance < padSize * 0.16) {
            const active = activePads.has(index);
            const accent = index === 15 ? cyan : orange;
            const glow = Math.max(0, 1 - Math.max(0, distance) / (padSize * 0.16));
            if (active) {
              color = mix(color, accent, distance < 0 ? 0.98 : glow * 0.32);
            } else if (distance < 0) {
              color = mix(color, [58, 60, 59, 255], 0.82);
            }
          }
        }
      }

      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }

  const downsampled = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < scale; sampleY += 1) {
        for (let sampleX = 0; sampleX < scale; sampleX += 1) {
          const source = ((y * scale + sampleY) * width + x * scale + sampleX) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            totals[channel] += pixels[source + channel];
          }
        }
      }
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        downsampled[target + channel] = Math.round(totals[channel] / (scale * scale));
      }
    }
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    downsampled.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL("apple-touch-icon.png", outputDirectory), createIcon(180)),
  writeFile(new URL("icon-192.png", outputDirectory), createIcon(192)),
  writeFile(new URL("icon-512.png", outputDirectory), createIcon(512)),
  writeFile(new URL("icon-maskable-512.png", outputDirectory), createIcon(512, true))
]);
