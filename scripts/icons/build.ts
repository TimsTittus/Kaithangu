/**
 * Placeholder PWA icons (apps/web/public/icons): a white disc on the theme
 * green, drawn inside the maskable safe zone so one image serves both
 * "any" and "maskable". Plain PNG encoder, no image library.
 *
 *   bun run icons:build
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = fileURLToPath(new URL('../../apps/web/public/icons/', import.meta.url));
const THEME = [0x04, 0x78, 0x57] as const; // Tailwind emerald-700, the app's primary colour
const SIZES = [192, 512] as const;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function icon(size: number): Buffer {
  const rowBytes = size * 3 + 1;
  const pixels = Buffer.alloc(rowBytes * size);
  const centre = (size - 1) / 2;
  const radius = size * 0.28;
  for (let y = 0; y < size; y += 1) {
    pixels[y * rowBytes] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const inside = Math.hypot(x - centre, y - centre) <= radius;
      const offset = y * rowBytes + 1 + x * 3;
      pixels[offset] = inside ? 0xff : THEME[0];
      pixels[offset + 1] = inside ? 0xff : THEME[1];
      pixels[offset + 2] = inside ? 0xff : THEME[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(`${OUT_DIR}icon-${size}.png`, icon(size));
}
console.log(`icons written to ${OUT_DIR}`);
