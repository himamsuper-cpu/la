import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const colors = {
  background: [16, 18, 15, 255],
  lime: [197, 238, 88, 255],
  coral: [225, 126, 90, 255],
  ivory: [238, 238, 222, 255],
};

const densities = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

function colorAt(x, y, foregroundOnly, backgroundOnly) {
  if (backgroundOnly) return colors.background;

  const moon = (x - 0.42) ** 2 + (y - 0.47) ** 2 <= 0.265 ** 2;
  const shadow = (x - 0.56) ** 2 + (y - 0.36) ** 2 <= 0.25 ** 2;
  if (moon && !shadow) return colors.lime;

  const portal = Math.abs(x - 0.68) + Math.abs(y - 0.69) <= 0.105;
  if (portal) {
    if (Math.abs(x - 0.68) < 0.026 && Math.abs(y - 0.69) < 0.026) {
      return colors.background;
    }
    return colors.coral;
  }

  const largeStar = Math.abs(x - 0.74) + Math.abs(y - 0.25) <= 0.045;
  if (largeStar) return colors.ivory;

  const smallStar = Math.abs(x - 0.25) + Math.abs(y - 0.69) <= 0.022;
  if (smallStar) return colors.coral;

  return foregroundOnly ? [0, 0, 0, 0] : colors.background;
}

function renderPng(size, foregroundOnly = false, backgroundOnly = false) {
  const samples = 4;
  const rowLength = size * 4 + 1;
  const pixels = Buffer.alloc(rowLength * size);

  for (let y = 0; y < size; y += 1) {
    const row = y * rowLength;
    for (let x = 0; x < size; x += 1) {
      const sum = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < samples; sampleY += 1) {
        for (let sampleX = 0; sampleX < samples; sampleX += 1) {
          const color = colorAt(
            (x + (sampleX + 0.5) / samples) / size,
            (y + (sampleY + 0.5) / samples) / size,
            foregroundOnly,
            backgroundOnly,
          );
          for (let channel = 0; channel < 4; channel += 1) sum[channel] += color[channel];
        }
      }
      const offset = row + 1 + x * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[offset + channel] = Math.round(sum[channel] / (samples * samples));
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return chunk;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createIco(images) {
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;

  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    directory.writeUInt8(size === 256 ? 0 : size, entry);
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([directory, ...images.map(({ png }) => png)]);
}

export async function generateMoonAssets(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });

  const desktopSizes = [16, 24, 32, 48, 64, 128, 256];
  const desktopImages = [];
  for (const size of desktopSizes) {
    const png = renderPng(size);
    desktopImages.push({ size, png });
    await writeFile(path.join(outputDirectory, `moon-${size}.png`), png);
  }
  await writeFile(path.join(outputDirectory, 'moon.ico'), createIco(desktopImages));

  await generateMoonLogo(path.join(outputDirectory, 'moon-logo.png'));

  for (const [density, scale] of densities) {
    const iconSize = Math.round(48 * scale);
    const foregroundSize = Math.round(108 * scale);
    await writeFile(path.join(outputDirectory, `icon-${density}.png`), renderPng(iconSize));
    await writeFile(path.join(outputDirectory, `foreground-${density}.png`), renderPng(foregroundSize, true));
    await writeFile(path.join(outputDirectory, `background-${density}.png`), renderPng(foregroundSize, false, true));
  }
}

export async function generateMoonLogo(outputFile) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, renderPng(256));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Pass the output directory for generated Moon assets.');
  await generateMoonAssets(path.resolve(process.argv[2]));
}