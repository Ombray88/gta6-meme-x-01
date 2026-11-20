import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// 1. Copy POST.json to output dir
mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
} catch (err) {
  console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}


// ---------------------------------------------------------
// PNG ENCODER FROM SCRATCH (1200 x 675 RGB)
// ---------------------------------------------------------

const WIDTH = 1200;
const HEIGHT = 675;
const pixels = new Uint8Array(WIDTH * HEIGHT * 3);

function setPixel(x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 3;
  pixels[idx] = Math.max(0, Math.min(255, r));
  pixels[idx + 1] = Math.max(0, Math.min(255, g));
  pixels[idx + 2] = Math.max(0, Math.min(255, b));
}

function drawRect(x0: number, y0: number, w: number, h: number, r: number, g: number, b: number) {
  const xStart = Math.max(0, Math.floor(x0));
  const xEnd = Math.min(WIDTH, Math.floor(x0 + w));
  const yStart = Math.max(0, Math.floor(y0));
  const yEnd = Math.min(HEIGHT, Math.floor(y0 + h));
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      setPixel(x, y, r, g, b);
    }
  }
}

function drawVerticalGradient(y0: number, y1: number, cr0: number, cg0: number, cb0: number, cr1: number, cg1: number, cb1: number) {
  const startY = Math.max(0, Math.floor(y0));
  const endY = Math.min(HEIGHT, Math.floor(y1));
  const totalH = Math.max(1, y1 - y0);
  for (let y = startY; y < endY; y++) {
    const t = (y - y0) / totalH;
    const r = Math.round(cr0 + (cr1 - cr0) * t);
    const g = Math.round(cg0 + (cg1 - cg0) * t);
    const b = Math.round(cb0 + (cb1 - cb0) * t);
    for (let x = 0; x < WIDTH; x++) {
      setPixel(x, y, r, g, b);
    }
  }
}

function drawCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number) {
  const r2 = radius * radius;
  const xMin = Math.max(0, Math.floor(cx - radius));
  const xMax = Math.min(WIDTH, Math.ceil(cx + radius));
  const yMin = Math.max(0, Math.floor(cy - radius));
  const yMax = Math.min(HEIGHT, Math.ceil(cy + radius));
  for (let y = yMin; y < yMax; y++) {
    for (let x = xMin; x < xMax; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(x, y, r, g, b);
      }
    }
  }
}

function drawEllipse(cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number) {
  const xMin = Math.max(0, Math.floor(cx - rx));
  const xMax = Math.min(WIDTH, Math.ceil(cx + rx));
  const yMin = Math.max(0, Math.floor(cy - ry));
  const yMax = Math.min(HEIGHT, Math.ceil(cy + ry));
  for (let y = yMin; y < yMax; y++) {
    for (let x = xMin; x < xMax; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        setPixel(x, y, r, g, b);
      }
    }
  }
}

// ---------------------------------------------------------
// BITMAP FONT (5x7)
// ---------------------------------------------------------

const FONT_5X7: Record<string, string[]> = {
  'A': [" 010 ", "10001", "10001", "11111", "10001", "10001", "10001"].map(s => s.replace(/0/g, '.')),
  'B': ["11110", "10001", "10001", "11110", "10001", "10001", "11110"].map(s => s.replace(/0/g, '.')),
  'C': [" 1111", "10000", "10000", "10000", "10000", "10000", " 1111"].map(s => s.replace(/0/g, '.')),
  'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"].map(s => s.replace(/0/g, '.')),
  'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"].map(s => s.replace(/0/g, '.')),
  'F': ["11111", "10000", "10000", "11110", "10000", "10000", "10000"].map(s => s.replace(/0/g, '.')),
  'G': [" 1111", "10000", "10000", "10111", "10001", "10001", " 1111"].map(s => s.replace(/0/g, '.')),
  'H': ["10001", "10001", "10001", "11111", "10001", "10001", "10001"].map(s => s.replace(/0/g, '.')),
  'I': ["111", " 1 ", " 1 ", " 1 ", " 1 ", " 1 ", "111"].map(s => s.replace(/0/g, '.')), // 3x7
  'J': ["  111", "    1", "    1", "    1", "    1", "10001", " 1110"].map(s => s.replace(/0/g, '.')),
  'K': ["10001", "10010", "10100", "11000", "10100", "10010", "10001"].map(s => s.replace(/0/g, '.')),
  'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"].map(s => s.replace(/0/g, '.')),
  'M': ["10001", "11011", "10101", "10001", "10001", "10001", "10001"].map(s => s.replace(/0/g, '.')),
  'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"].map(s => s.replace(/0/g, '.')),
  'O': [" 111 ", "10001", "10001", "10001", "10001", "10001", " 111 "].map(s => s.replace(/0/g, '.')),
  'P': ["11110", "10001", "10001", "11110", "10000", "10000", "10000"].map(s => s.replace(/0/g, '.')),
  'Q': [" 111 ", "10001", "10001", "10001", "10101", "10011", " 1110"].map(s => s.replace(/0/g, '.')),
  'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"].map(s => s.replace(/0/g, '.')),
  'S': [" 1111", "10000", "10000", " 111 ", "    1", "    1", "1111 "].map(s => s.replace(/0/g, '.')),
  'T': ["11111", "  1  ", "  1  ", "  1  ", "  1  ", "  1  ", "  1  "].map(s => s.replace(/0/g, '.')),
  'U': ["10001", "10001", "10001", "10001", "10001", "10001", " 111 "].map(s => s.replace(/0/g, '.')),
  'V': ["10001", "10001", "10001", "10001", " 101 ", " 101 ", "  1  "].map(s => s.replace(/0/g, '.')),
  'W': ["10001", "10001", "10001", "10101", "10101", "11011", "10001"].map(s => s.replace(/0/g, '.')),
  'X': ["10001", "10001", " 101 ", "  1  ", " 101 ", "10001", "10001"].map(s => s.replace(/0/g, '.')),
  'Y': ["10001", "10001", " 101 ", "  1  ", "  1  ", "  1  ", "  1  "].map(s => s.replace(/0/g, '.')),
  'Z': ["11111", "    1", "   1 ", "  1  ", " 1   ", "1    ", "11111"].map(s => s.replace(/0/g, '.')),
  '0': [" 111 ", "10001", "10011", "10101", "11001", "10001", " 111 "].map(s => s.replace(/0/g, '.')),
  '1': ["  1  ", " 11  ", "  1  ", "  1  ", "  1  ", "  1  ", " 111 "].map(s => s.replace(/0/g, '.')),
  '2': [" 111 ", "1   1", "    1", "   1 ", "  1  ", " 1   ", "11111"].map(s => s.replace(/0/g, '.')),
  '3': ["1111 ", "    1", "    1", "  11 ", "    1", "    1", "1111 "].map(s => s.replace(/0/g, '.')),
  '4': ["1   1", "1   1", "1   1", "11111", "    1", "    1", "    1"].map(s => s.replace(/0/g, '.')),
  '5': ["11111", "1    ", "1111 ", "    1", "    1", "    1", "1111 "].map(s => s.replace(/0/g, '.')),
  '6': [" 111 ", "1    ", "1111 ", "1   1", "1   1", "1   1", " 111 "].map(s => s.replace(/0/g, '.')),
  '7': ["11111", "    1", "   1 ", "  1  ", "  1  ", "  1  ", "  1  "].map(s => s.replace(/0/g, '.')),
  '8': [" 111 ", "1   1", "1   1", " 111 ", "1   1", "1   1", " 111 "].map(s => s.replace(/0/g, '.')),
  '9': [" 111 ", "1   1", "1   1", " 1111", "    1", "    1", " 111 "].map(s => s.replace(/0/g, '.')),
  '\'': ["  1  ", "  1  ", "  1  ", "     ", "     ", "     ", "     "].map(s => s.replace(/0/g, '.')),
  '.': ["     ", "     ", "     ", "     ", "     ", "  11 ", "  11 "].map(s => s.replace(/0/g, '.')),
  '!': ["  1  ", "  1  ", "  1  ", "  1  ", "  1  ", "     ", "  1  "].map(s => s.replace(/0/g, '.')),
  '-': ["     ", "     ", "     ", "11111", "     ", "     ", "     "].map(s => s.replace(/0/g, '.')),
  ' ': ["     ", "     ", "     ", "     ", "     ", "     ", "     "].map(s => s.replace(/0/g, '.')),
};

function drawChar(char: string, startX: number, startY: number, scale: number, r: number, g: number, b: number) {
  const glyph = FONT_5X7[char.toUpperCase()] ?? FONT_5X7['?'] ?? FONT_5X7[' '];
  if (!glyph) return;
  for (let row = 0; row < glyph.length; row++) {
    const line = glyph[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] === '1') {
        drawRect(startX + col * scale, startY + row * scale, scale, scale, r, g, b);
      }
    }
  }
}

function getTextWidth(text: string, scale: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase();
    const glyph = FONT_5X7[char] ?? FONT_5X7[' '];
    const charW = (glyph ? glyph[0].length : 5) + 1; // 1 pixel spacing
    width += charW * scale;
  }
  return width;
}

function drawText(text: string, x: number, y: number, scale: number, r: number, g: number, b: number, align: 'left' | 'center' = 'left', shadow = true) {
  let startX = x;
  if (align === 'center') {
    startX = x - Math.floor(getTextWidth(text, scale) / 2);
  }

  // Draw shadow/outline first if requested
  if (shadow) {
    const shadowOffset = Math.max(1, Math.floor(scale / 2));
    let cx = startX;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const glyph = FONT_5X7[char.toUpperCase()] ?? FONT_5X7[' '];
      const charW = (glyph ? glyph[0].length : 5) + 1;
      drawChar(char, cx + shadowOffset, y + shadowOffset, scale, 0, 0, 0);
      cx += charW * scale;
    }
  }

  let cx = startX;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const glyph = FONT_5X7[char.toUpperCase()] ?? FONT_5X7[' '];
    const charW = (glyph ? glyph[0].length : 5) + 1;
    drawChar(char, cx, y, scale, r, g, b);
    cx += charW * scale;
  }
}

function drawColoredText(parts: { text: string; r: number; g: number; b: number }[], x: number, y: number, scale: number, align: 'left' | 'center' = 'center') {
  let totalWidth = 0;
  for (const p of parts) {
    totalWidth += getTextWidth(p.text, scale);
  }
  let startX = x;
  if (align === 'center') {
    startX = x - Math.floor(totalWidth / 2);
  }

  let curX = startX;
  for (const p of parts) {
    drawText(p.text, curX, y, scale, p.r, p.g, p.b, 'left', true);
    curX += getTextWidth(p.text, scale);
  }
}

// ---------------------------------------------------------
// SCENE GENERATION (V2: WASTED)
// ---------------------------------------------------------

// 1. Sky Gradient (y = 0 to 420)
// #150826 (21, 8, 38) -> #3d0f3d (61, 15, 61) -> #6e2418 (110, 36, 24)
drawVerticalGradient(0, 210, 21, 8, 38, 61, 15, 61);
drawVerticalGradient(210, 420, 61, 15, 61, 110, 36, 24);

// 2. Dim Orange Sun (centre-left, x=450, y=320, radius=70)
drawCircle(450, 320, 70, 224, 120, 48);
// Sun stripes (dark cutout lines across sun)
for (let sy = 300; sy < 350; sy += 8) {
  drawRect(370, sy, 160, 3, 61, 15, 61);
}

// 3. Skyline Silhouettes (y = 350 to 420) across x = 0 to 1200
const skylineBuildings = [
  { x: 0, w: 60, h: 70 },
  { x: 55, w: 80, h: 90 },
  { x: 130, w: 50, h: 60 },
  { x: 175, w: 90, h: 110 },
  { x: 260, w: 70, h: 80 },
  { x: 325, w: 100, h: 95 },
  { x: 420, w: 60, h: 120 },
  { x: 475, w: 80, h: 85 },
  { x: 550, w: 110, h: 100 },
  { x: 655, w: 75, h: 90 },
  { x: 725, w: 90, h: 115 },
  { x: 810, w: 60, h: 75 },
  { x: 865, w: 120, h: 105 },
  { x: 980, w: 70, h: 85 },
  { x: 1045, w: 95, h: 95 },
  { x: 1135, w: 70, h: 65 },
];

for (const b of skylineBuildings) {
  const by = 420 - b.h;
  drawRect(b.x, by, b.w, b.h + 10, 10, 6, 18);
  // Sparse lit windows (#ffd76a -> 255, 215, 106)
  for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 14) {
    for (let wy = by + 15; wy < 410; wy += 18) {
      if ((wx + wy) % 3 === 0) {
        drawRect(wx, wy, 4, 6, 255, 215, 106);
      }
    }
  }
}

// 4. Palm Tree Silhouettes (Left & Right)
// Left palm tree at x=90
drawRect(82, 330, 14, 90, 10, 6, 18);
for (let fx = 40; fx < 90; fx += 5) {
  const fy = 330 - (90 - fx) * 0.6;
  drawRect(fx, fy, 8, 4, 10, 6, 18);
}
for (let fx = 90; fx < 140; fx += 5) {
  const fy = 330 - (fx - 90) * 0.6;
  drawRect(fx, fy, 8, 4, 10, 6, 18);
}

// Right palm tree at x=1100
drawRect(1092, 310, 14, 110, 10, 6, 18);
for (let fx = 1050; fx < 1100; fx += 5) {
  const fy = 310 - (1100 - fx) * 0.6;
  drawRect(fx, fy, 8, 4, 10, 6, 18);
}
for (let fx = 1100; fx < 1150; fx += 5) {
  const fy = 310 - (fx - 1100) * 0.6;
  drawRect(fx, fy, 8, 4, 10, 6, 18);
}

// 5. Bottom Strip (y = 420 to 675) - Dark ocean/street
drawVerticalGradient(420, 675, 13, 10, 24, 7, 5, 14);
// Subtle reflection line
drawRect(0, 426, WIDTH, 2, 128, 48, 32);

// 6. Top Caption ("10 YEARS WAITING FOR GTA 6") at y=45, centred, scale=4
drawText("10 YEARS WAITING FOR GTA 6", 600, 45, 4, 255, 255, 255, 'center', true);

// 7. Hero Text ("WASTED") - huge, centred around y=225, scale=16
drawText("WASTED", 600, 225, 16, 201, 201, 201, 'center', true);

// 8. Bottom Captions
// Line 1: "MY AGENT DIDN'T WAIT." at y=510, scale=4, white
drawText("MY AGENT DIDN'T WAIT.", 550, 510, 4, 255, 255, 255, 'center', true);

// Line 2: "IT'S GETTING PAID ON MAKE.FUN" at y=565, scale=4, parts colored
drawColoredText(
  [
    { text: "IT'S GETTING PAID ON ", r: 255, g: 255, b: 255 },
    { text: "MAKE.FUN", r: 255, g: 215, b: 0 }
  ],
  550,
  565,
  4,
  'center'
);

function drawSparkleEye(cx: number, cy: number, size: number, r: number, g: number, b: number) {
  // A 4-pointed sparkle star: a plus with tapered points
  // Main cross
  drawRect(cx - 1, cy - Math.floor(size / 2), 2, size, r, g, b);
  drawRect(cx - Math.floor(size / 2), cy - 1, size, 2, r, g, b);
  // Center block
  drawRect(cx - 2, cy - 2, 4, 4, r, g, b);
}

function draw5PointStar(cx: number, cy: number, rOut: number, rIn: number, r: number, g: number, b: number) {
  // Rough 5-point star using triangles or overlapping rects
  // For a small scale, we can approximate with a few rectangles
  // Center
  drawRect(cx - 2, cy - 2, 4, 4, r, g, b);
  // Top point
  drawRect(cx - 1, cy - rOut, 2, rOut, r, g, b);
  // Bottom left/right
  drawRect(cx - Math.floor(rOut * 0.8), cy + Math.floor(rOut * 0.5), 4, 4, r, g, b);
  drawRect(cx + Math.floor(rOut * 0.8) - 4, cy + Math.floor(rOut * 0.5), 4, 4, r, g, b);
  // Top left/right
  drawRect(cx - rOut, cy - 2, Math.floor(rOut * 0.8), 3, r, g, b);
  drawRect(cx + Math.floor(rOut * 0.2), cy - 2, Math.floor(rOut * 0.8), 3, r, g, b);
}

// 9. Make.fun Ghost & Coin (bottom-right: x ~ 980-1160, y ~ 460-660)
// Magenta disc base (#e6007e -> 230, 0, 126)
drawEllipse(1060, 630, 95, 22, 230, 0, 126);

// Ghost body: white (#ffffff), outline black, rounded head, wavy bottom
const gx = 1010;
const gy = 470;

// Outline first (slightly larger black circles/rect)
drawCircle(gx + 50, gy + 50, 52, 0, 0, 0);
drawRect(gx - 2, gy + 50, 104, 110, 0, 0, 0);

// White body
drawCircle(gx + 50, gy + 50, 50, 255, 255, 255);
drawRect(gx, gy + 50, 100, 110, 255, 255, 255);

// Ghost wavy bottom (white circles at the bottom to form waves)
drawCircle(gx + 20, gy + 160, 20, 255, 255, 255);
drawCircle(gx + 50, gy + 160, 20, 255, 255, 255);
drawCircle(gx + 80, gy + 160, 20, 255, 255, 255);

// Black outline for wavy bottom (optional, but keep it clean)
// Instead of full outline, we just ensure it's on top of the magenta disc

// Black sparkle eyes (four-pointed stars)
drawSparkleEye(gx + 35, gy + 60, 14, 0, 0, 0);
drawSparkleEye(gx + 65, gy + 60, 14, 0, 0, 0);

// Magenta coin (#e6007e) with bold white 5-point star
// Positioned to overlap the body
const cx = gx + 105;
const cy = gy + 130;
// Coin outline
drawCircle(cx, cy, 26, 0, 0, 0);
// Coin fill
drawCircle(cx, cy, 24, 230, 0, 126);

// White 5-point star on coin
draw5PointStar(cx, cy, 14, 6, 255, 255, 255);

// Round little hand holding coin (white with black outline)
drawCircle(gx + 95, cy, 14, 0, 0, 0);
drawCircle(gx + 95, cy, 12, 255, 255, 255);


// ---------------------------------------------------------
// PNG ENCODER & WRITING
// ---------------------------------------------------------

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(12 + len);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, len);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);

  const crcBuf = new Uint8Array(4 + len);
  crcBuf.set(chunk.subarray(4, 8), 0);
  crcBuf.set(data, 4);
  const crc = crc32(crcBuf);
  dv.setUint32(8 + len, crc);
  return chunk;
}

function encodePNG(width: number, height: number, rgbPixels: Uint8Array): Uint8Array {
  const scanlineSize = 1 + width * 3;
  const rawData = new Uint8Array(scanlineSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * scanlineSize] = 0; // filter 0
    rawData.set(rgbPixels.subarray(y * width * 3, (y + 1) * width * 3), y * scanlineSize + 1);
  }

  const compressed = deflateSync(rawData);

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', new Uint8Array(0));

  const totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  result.set(signature, offset); offset += signature.length;
  result.set(ihdrChunk, offset); offset += ihdrChunk.length;
  result.set(idatChunk, offset); offset += idatChunk.length;
  result.set(iendChunk, offset);

  return result;
}

const pngBytes = encodePNG(WIDTH, HEIGHT, pixels);

// Write meme.png to OUTPUT_DIR
writeFileSync(join(OUTPUT_DIR, 'meme.png'), pngBytes);

console.log('Successfully generated v2 WASTED meme.png and copied POST.json.');
