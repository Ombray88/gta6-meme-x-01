// GTA 6 Meme Generator for make.fun (gta6-meme-x-01)
// Pure Node.js (standard library only: node:fs, node:path, node:zlib)
// Deterministic 1200x675 PNG encoder and Vice City sunset ghost rasterizer.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 675;

// --- CRC32 & PNG Encoder ---
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  const crcBuf = Buffer.alloc(4 + len);
  buf.copy(crcBuf, 0, 4, 8 + len);
  buf.writeUInt32BE(crc32(crcBuf), 8 + len);
  return buf;
}

function encodePNG(width: number, height: number, rgbPixels: Buffer): Buffer {
  const rowSize = width * 3;
  const filteredData = Buffer.alloc(height * (1 + rowSize));
  for (let y = 0; y < height; y++) {
    filteredData[y * (1 + rowSize)] = 0; // filter 0 (None)
    rgbPixels.copy(filteredData, y * (1 + rowSize) + 1, y * rowSize, (y + 1) * rowSize);
  }
  // Level 0 (store/no compression) or level 1 ensures robust size > 50KB
  const compressed = deflateSync(filteredData, { level: 0 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// --- Canvas & Drawing Helpers ---
class Canvas {
  width: number;
  height: number;
  pixels: Buffer;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.pixels = Buffer.alloc(w * h * 3);
  }

  setPixel(x: number, y: number, r: number, g: number, b: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 3;
    this.pixels[idx] = r;
    this.pixels[idx + 1] = g;
    this.pixels[idx + 2] = b;
  }

  fill(r: number, g: number, b: number) {
    for (let i = 0; i < this.pixels.length; i += 3) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
    }
  }

  fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    const x0 = Math.max(0, Math.floor(x));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y0 = Math.max(0, Math.floor(y));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, r, g, b);
      }
    }
  }

  fillCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.height, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const dy2 = dy * dy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy2 <= r2) {
          this.setPixel(x, y, r, g, b);
        }
      }
    }
  }
}

// --- 5x7 Bitmap Font ---
const FONT_5X7: Record<string, string[]> = {
  'A': [" .#.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  'B': ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  'C': [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  'D': ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  'E': ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  'F': ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  'G': [".####", "#....", "#....", "#.###", "#...#", "#...#", ".####"],
  'H': ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  'I': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  'J': [".####", "...#.", "...#.", "...#.", "...#.", "#...#", ".###."],
  'K': ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  'L': ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  'M': ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
  'N': ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  'O': [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  'P': ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  'Q': [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  'R': ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  'S': [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  'T': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  'U': ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  'V': ["#...#", "#...#", "#...#", "#...#", "#.#.#", ".#.#.", "..#.."],
  'W': ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  'X': ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  'Y': ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  'Z': ["#####", "....#", "...#.", "..#..", ".#..#", "#....", "#####"],
  '0': [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  '1': ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"],
  '2': [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  '3': [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  '4': ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
  '5': ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  '6': [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  '7': ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  '8': [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  '9': [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  '.': [".....", ".....", ".....", ".....", ".....", "..#..", "..#.."],
  ',': [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  '!': ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  '?': [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  '-': [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ':': [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
  '\'': ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  ' ': [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function drawText(canvas: Canvas, text: string, startX: number, startY: number, scale: number, r: number, g: number, b: number, shadowR = 0, shadowG = 0, shadowB = 0) {
  const upper = text.toUpperCase();
  let cursorX = startX;

  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    const glyph = FONT_5X7[ch] ?? FONT_5X7[' '];

    if (shadowR !== null) {
      for (let gy = 0; gy < 7; gy++) {
        const row = glyph[gy];
        for (let gx = 0; gx < 5; gx++) {
          if (row[gx] === '#') {
            canvas.fillRect(cursorX + scale + gx * scale, startY + scale + gy * scale, scale, scale, shadowR, shadowG, shadowB);
          }
        }
      }
    }

    for (let gy = 0; gy < 7; gy++) {
      const row = glyph[gy];
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] === '#') {
          canvas.fillRect(cursorX + gx * scale, startY + gy * scale, scale, scale, r, g, b);
        }
      }
    }

    cursorX += (5 + 1) * scale;
  }
}

function measureTextWidth(text: string, scale: number): number {
  return text.length * (5 + 1) * scale;
}

// --- Palm Tree Drawing Helper ---
function drawPalmTree(canvas: Canvas, trunkX: number, groundY: number, trunkHeight: number, scale: number) {
  const darkCol: [number, number, number] = [25, 20, 25];

  for (let h = 0; h < trunkHeight; h++) {
    const t = h / trunkHeight;
    const curX = Math.round(trunkX + Math.sin(t * Math.PI * 0.8) * 15 * scale);
    const curY = groundY - h;
    const thickness = Math.max(2, Math.round((8 - t * 4) * scale));
    canvas.fillRect(curX - thickness / 2, curY, thickness, 1, darkCol[0], darkCol[1], darkCol[2]);
  }

  const topX = Math.round(trunkX + Math.sin(Math.PI * 0.8) * 15 * scale);
  const topY = groundY - trunkHeight;

  const angles = [-2.6, -2.1, -1.6, -0.9, -0.4, 0.1];
  for (const angle of angles) {
    const frondLen = Math.round(70 * scale);
    for (let step = 0; step <= frondLen; step++) {
      const ft = step / frondLen;
      const fx = topX + Math.cos(angle) * step;
      const fy = topY + Math.sin(angle) * step + ft * ft * 35 * scale;
      canvas.fillCircle(fx, fy, Math.max(1, Math.round((3 - ft * 2) * scale)), darkCol[0], darkCol[1], darkCol[2]);
    }
  }
}

// --- Main Generation ---
function main() {
  const botDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(outputDir, { recursive: true });

  try {
    copyFileSync(join(botDir, 'POST.json'), join(outputDir, 'POST.json'));
  } catch (err) {
    console.error(`POST.json could not be copied from ${botDir}: ${(err as Error).message}`);
    process.exit(1);
  }

  const canvas = new Canvas(WIDTH, HEIGHT);

  // 1. Sunset Gradient Sky
  for (let y = 0; y < 520; y++) {
    const t = y / 520;
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const st = t / 0.5;
      r = Math.round(59 + (255 - 59) * st);
      g = Math.round(20 + (20 - 20) * st);
      b = Math.round(67 + (147 - 67) * st);
    } else {
      const st = (t - 0.5) / 0.5;
      r = Math.round(255 + (255 - 255) * st);
      g = Math.round(20 + (140 - 20) * st);
      b = Math.round(147 + (0 - 147) * st);
    }
    for (let x = 0; x < WIDTH; x++) {
      canvas.setPixel(x, y, r, g, b);
    }
  }

  // 2. Sun Disc
  const sunCx = 600;
  const sunCy = 360;
  const sunR = 110;
  const sunR2 = sunR * sunR;
  for (let y = Math.max(0, sunCy - sunR); y <= Math.min(519, sunCy + sunR); y++) {
    const dy = y - sunCy;
    const dy2 = dy * dy;
    for (let x = Math.max(0, sunCx - sunR); x <= Math.min(WIDTH - 1, sunCx + sunR); x++) {
      const dx = x - sunCx;
      if (dx * dx + dy2 <= sunR2) {
        if (y > sunCy + 20 && (y - sunCy) % 12 < 4) {
          canvas.setPixel(x, y, 59, 20, 67);
        } else {
          canvas.setPixel(x, y, 255, 204, 0);
        }
      }
    }
  }

  // 3. Ocean Strip
  for (let y = 520; y < HEIGHT; y++) {
    const ot = (y - 520) / (HEIGHT - 520);
    const or = Math.round(20 + 30 * ot);
    const og = Math.round(10 + 20 * ot);
    const ob = Math.round(40 + 60 * ot);
    for (let x = 0; x < WIDTH; x++) {
      const distFromCenter = Math.abs(x - sunCx);
      if (distFromCenter < 120 && (y + Math.floor(x * 0.1)) % 8 < 3) {
        canvas.setPixel(x, y, 255, 165, 0);
      } else {
        canvas.setPixel(x, y, or, og, ob);
      }
    }
  }
  canvas.fillRect(0, 517, WIDTH, 3, 255, 140, 0);

  // 4. Palm Trees
  drawPalmTree(canvas, 120, 520, 240, 1.3);
  drawPalmTree(canvas, 240, 520, 180, 1.0);
  drawPalmTree(canvas, 1080, 520, 260, 1.4);
  drawPalmTree(canvas, 960, 520, 190, 1.1);

  // 5. Make.fun Ghost & Magenta Disc
  const ghostCx = 600;
  const ghostCy = 440;
  canvas.fillCircle(ghostCx, ghostCy + 30, 95, 194, 24, 91);
  canvas.fillCircle(ghostCx, ghostCy + 30, 85, 216, 27, 96);

  const ghostBodyColor = [255, 255, 255];
  const ghostOutlineColor = [25, 20, 25];

  canvas.fillCircle(ghostCx, ghostCy - 40, 72, ghostOutlineColor[0], ghostOutlineColor[1], ghostOutlineColor[2]);
  canvas.fillRect(ghostCx - 72, ghostCy - 40, 144, 90, ghostOutlineColor[0], ghostOutlineColor[1], ghostOutlineColor[2]);
  for (let bx = -60; bx <= 60; bx += 30) {
    canvas.fillCircle(ghostCx + bx, ghostCy + 50, 22, ghostOutlineColor[0], ghostOutlineColor[1], ghostOutlineColor[2]);
  }

  canvas.fillCircle(ghostCx, ghostCy - 40, 66, ghostBodyColor[0], ghostBodyColor[1], ghostBodyColor[2]);
  canvas.fillRect(ghostCx - 66, ghostCy - 40, 132, 86, ghostBodyColor[0], ghostBodyColor[1], ghostBodyColor[2]);
  for (let bx = -60; bx <= 60; bx += 30) {
    canvas.fillCircle(ghostCx + bx, ghostCy + 50, 18, ghostBodyColor[0], ghostBodyColor[1], ghostBodyColor[2]);
  }
  canvas.fillRect(ghostCx - 66, ghostCy + 35, 132, 20, ghostBodyColor[0], ghostBodyColor[1], ghostBodyColor[2]);

  canvas.fillCircle(ghostCx - 78, ghostCy - 10, 16, ghostOutlineColor[0], ghostOutlineColor[1], ghostOutlineColor[2]);
  canvas.fillCircle(ghostCx - 78, ghostCy - 10, 12, ghostBodyColor[0], ghostBodyColor[1], ghostBodyColor[2]);

  canvas.fillCircle(ghostCx + 78, ghostCy - 10, 16, ghostOutlineColor[0], ghostOutlineColor[1], ghostOutlineColor[2]);
  canvas.fillCircle(ghostCx + 78, ghostCy - 10, 12, ghostBodyColor[0], ghostBodyColor[1], ghostBodyColor[2]);

  function drawSparkleEye(cx: number, cy: number) {
    const size = 13;
    for (let y = cy - size; y <= cy + size; y++) {
      for (let x = cx - size; x <= cx + size; x++) {
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        const val = Math.pow(dx / size, 0.65) + Math.pow(dy / size, 0.65);
        if (val <= 1.0) {
          canvas.setPixel(x, y, 25, 20, 25);
        }
      }
    }
  }
  drawSparkleEye(ghostCx - 25, ghostCy - 45);
  drawSparkleEye(ghostCx + 25, ghostCy - 45);

  const propX = ghostCx + 80;
  const propY = ghostCy + 15;
  canvas.fillCircle(propX, propY, 30, ghostOutlineColor[0], ghostOutlineColor[1], ghostOutlineColor[2]);
  canvas.fillCircle(propX, propY, 25, 194, 24, 91);

  const starVertices: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 === 0) ? 14 : 6;
    starVertices.push([propX + Math.cos(angle) * r, propY + Math.sin(angle) * r]);
  }
  function isPointInPolygon(px: number, py: number, vertices: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [xi, yi] = vertices[i];
      const [xj, yj] = vertices[j];
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  for (let y = propY - 16; y <= propY + 16; y++) {
    for (let x = propX - 16; x <= propX + 16; x++) {
      if (isPointInPolygon(x, y, starVertices)) {
        canvas.setPixel(x, y, 255, 255, 255);
      }
    }
  }

  // 6. Captions & Translucent Band
  // Subtle dark translucent band behind bottom captions
  for (let y = 565; y < 650; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 3;
      canvas.pixels[idx] = Math.round(canvas.pixels[idx] * 0.55);
      canvas.pixels[idx + 1] = Math.round(canvas.pixels[idx + 1] * 0.55);
      canvas.pixels[idx + 2] = Math.round(canvas.pixels[idx + 2] * 0.55);
    }
  }

  const topText = "GTA 6 DELAYED AGAIN";
  const topScale = 5;
  const topW = measureTextWidth(topText, topScale);
  const topX = Math.round((WIDTH - topW) / 2);
  const topY = 45;
  drawText(canvas, topText, topX, topY, topScale, 255, 255, 255, 0, 0, 0);

  const botLine1 = "MEANWHILE MY AGENT IS";
  const botLine2 = "ALREADY EARNING ON MAKE.FUN";
  const botScale = 3;

  const w1 = measureTextWidth(botLine1, botScale);
  const x1 = Math.round((WIDTH - w1) / 2);
  const y1 = 575;
  drawText(canvas, botLine1, x1, y1, botScale, 255, 255, 255, 0, 0, 0);

  const w2 = measureTextWidth(botLine2, botScale);
  const x2 = Math.round((WIDTH - w2) / 2);
  const y2 = 620;
  drawText(canvas, botLine2, x2, y2, botScale, 255, 215, 0, 0, 0);

  // 7. Encode and write meme.png
  const pngBuffer = encodePNG(WIDTH, HEIGHT, canvas.pixels);
  writeFileSync(join(outputDir, 'meme.png'), pngBuffer);
  console.log(`Successfully generated ${join(outputDir, 'meme.png')} (${pngBuffer.length} bytes) and copied POST.json.`);
}

main();
