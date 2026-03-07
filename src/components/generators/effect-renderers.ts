/* ── Additional Effect Renderers ──────────────── */

export interface DitheringSettings {
  algorithm: "floyd-steinberg" | "ordered" | "atkinson" | "random";
  threshold: number;
  colorMode: boolean;
  scale: number;
}

export interface MatrixRainSettings {
  speed: number;
  density: number;
  trailLength: number;
  charset: "katakana" | "binary" | "ascii" | "standard";
  cellSize: number;
  spacing: number;
  direction: "down" | "up" | "left" | "right";
  glow: number;
  bgOpacity: number;
  brightness: number;
  contrast: number;
  threshold: number;
  rainColor: string;
}

export interface DotsSettings {
  dotSize: number;
  spacing: number;
  randomize: boolean;
  colorMode: boolean;
  shape: "circle" | "square" | "triangle";
  sizeByBrightness: boolean;
}

export interface ContourSettings {
  levels: number;
  lineWidth: number;
  colorMode: boolean;
  invert: boolean;
  smoothing: number;
}

export interface PixelSortSettings {
  direction: "horizontal" | "vertical";
  threshold: number;
  sortBy: "brightness" | "hue" | "saturation";
  intensity: number;
  reverse: boolean;
  streakLength: number;
  randomness: number;
  brightness: number;
  contrast: number;
}

export interface BlockifySettings {
  style: "full" | "outlined" | "rounded" | "dots";
  blockSize: number;
  borderWidth: number;
  colorMode: "preserve" | "grayscale" | "mono";
  borderColor: string;
  brightness: number;
  contrast: number;
}

export const DEFAULT_DITHERING: DitheringSettings = {
  algorithm: "floyd-steinberg",
  threshold: 50,
  colorMode: false,
  scale: 1,
};

export const DEFAULT_MATRIX_RAIN: MatrixRainSettings = {
  speed: 50,
  density: 50,
  trailLength: 18,
  charset: "standard",
  cellSize: 10,
  spacing: 0,
  direction: "down",
  glow: 0,
  bgOpacity: 0.1,
  brightness: 0,
  contrast: 0,
  threshold: 20,
  rainColor: "#FFFFFF",
};

export const DEFAULT_DOTS: DotsSettings = {
  dotSize: 6,
  spacing: 8,
  randomize: false,
  colorMode: true,
  shape: "circle",
  sizeByBrightness: true,
};

export const DEFAULT_CONTOUR: ContourSettings = {
  levels: 8,
  lineWidth: 1,
  colorMode: false,
  invert: false,
  smoothing: 2,
};

export const DEFAULT_PIXEL_SORT: PixelSortSettings = {
  direction: "horizontal",
  threshold: 30,
  sortBy: "brightness",
  intensity: 80,
  reverse: false,
  streakLength: 100,
  randomness: 30,
  brightness: 0,
  contrast: 0,
};

export const DEFAULT_BLOCKIFY: BlockifySettings = {
  style: "full",
  blockSize: 8,
  borderWidth: 1,
  colorMode: "preserve",
  borderColor: "#000000",
  brightness: 0,
  contrast: 0,
};

const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
const BINARY = "01";
const ASCII_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/* ── Dithering ──────────────────────────────── */

export function renderDithering(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: DitheringSettings) {
  const { algorithm, threshold, colorMode, scale } = settings;
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);

  const thresholdVal = (threshold / 100) * 255;

  if (algorithm === "ordered") {
    const matrix = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const mapVal = (matrix[y % 4][x % 4] / 16) * 255;
        const newVal = gray > mapVal ? 255 : 0;
        if (colorMode) {
          const factor = newVal / Math.max(1, gray);
          data[idx] = Math.min(255, data[idx] * factor);
          data[idx + 1] = Math.min(255, data[idx + 1] * factor);
          data[idx + 2] = Math.min(255, data[idx + 2] * factor);
        } else {
          data[idx] = data[idx + 1] = data[idx + 2] = newVal;
        }
      }
    }
  } else if (algorithm === "random") {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const rand = Math.random() * 255;
        const newVal = gray > rand * (thresholdVal / 128) ? 255 : 0;
        if (colorMode) {
          const factor = newVal / Math.max(1, gray);
          data[idx] = Math.min(255, data[idx] * factor);
          data[idx + 1] = Math.min(255, data[idx + 1] * factor);
          data[idx + 2] = Math.min(255, data[idx + 2] * factor);
        } else {
          data[idx] = data[idx + 1] = data[idx + 2] = newVal;
        }
      }
    }
  } else {
    // Floyd-Steinberg or Atkinson
    const errors = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const corrected = gray + errors[y * width + x];
        const newVal = corrected > thresholdVal ? 255 : 0;
        const error = corrected - newVal;

        if (colorMode) {
          const factor = newVal / Math.max(1, gray);
          data[idx] = Math.min(255, Math.max(0, data[idx] * factor));
          data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] * factor));
          data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] * factor));
        } else {
          data[idx] = data[idx + 1] = data[idx + 2] = newVal;
        }

        if (algorithm === "atkinson") {
          const d = error / 8;
          if (x + 1 < width) errors[y * width + x + 1] += d;
          if (x + 2 < width) errors[y * width + x + 2] += d;
          if (y + 1 < height) {
            if (x - 1 >= 0) errors[(y + 1) * width + x - 1] += d;
            errors[(y + 1) * width + x] += d;
            if (x + 1 < width) errors[(y + 1) * width + x + 1] += d;
          }
          if (y + 2 < height) errors[(y + 2) * width + x] += d;
        } else {
          // Floyd-Steinberg
          if (x + 1 < width) errors[y * width + x + 1] += error * 7 / 16;
          if (y + 1 < height) {
            if (x - 1 >= 0) errors[(y + 1) * width + x - 1] += error * 3 / 16;
            errors[(y + 1) * width + x] += error * 5 / 16;
            if (x + 1 < width) errors[(y + 1) * width + x + 1] += error * 1 / 16;
          }
        }
      }
    }
  }

  const result = new ImageData(data, width, height);
  ctx.putImageData(result, 0, 0);
}

/* ── Matrix Rain ──────────────────────────────── */

export function renderMatrixRain(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: MatrixRainSettings) {
  const { density, trailLength, charset, cellSize: cSize, spacing: sp, direction, glow, bgOpacity, brightness: br, contrast: ct, threshold: th, rainColor } = settings;
  const { width, height, data } = imageData;

  const STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const chars = charset === "katakana" ? KATAKANA : charset === "binary" ? BINARY : charset === "ascii" ? ASCII_CHARS : STANDARD;
  const cellSize = Math.max(4, cSize);
  const effectiveSpacing = sp;
  const cols = Math.floor(width / (cellSize + effectiveSpacing));
  const rows = Math.floor(height / (cellSize + effectiveSpacing));
  const trail = trailLength / 10;

  // Parse rain color
  const rc = parseHexColor(rainColor);

  // Brightness/contrast adjustments
  const contrastFactor = 1 + ct / 50;

  ctx.fillStyle = `rgba(10,10,10,${bgOpacity})`;
  ctx.fillRect(0, 0, width, height);

  if (glow > 0) {
    ctx.shadowColor = `rgb(${rc.r},${rc.g},${rc.b})`;
    ctx.shadowBlur = glow * 2;
  }

  ctx.font = `${cellSize}px monospace`;
  ctx.textBaseline = "top";

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = col * (cellSize + effectiveSpacing);
      const y = row * (cellSize + effectiveSpacing);
      const idx = (Math.min(y, height - 1) * width + Math.min(x, width - 1)) * 4;
      let rawBrightness = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;

      // Apply brightness/contrast
      rawBrightness = 0.5 + (rawBrightness - 0.5) * contrastFactor + br / 100;
      rawBrightness = Math.max(0, Math.min(1, rawBrightness));

      if (rawBrightness < th / 100) continue;

      const charIdx = Math.floor(Math.abs(Math.sin(col * 127.1 + row * 311.7) * 43758.5453) % chars.length);
      const alpha = rawBrightness * Math.min(1, trail * 0.3);
      const l = 30 + rawBrightness * 50;
      const factor = l / 100;
      ctx.fillStyle = `rgba(${Math.round(rc.r * factor)},${Math.round(rc.g * factor)},${Math.round(rc.b * factor)},${alpha})`;
      ctx.fillText(chars[charIdx], x, y);
    }
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 255,
    g: parseInt(h.substring(2, 4), 16) || 255,
    b: parseInt(h.substring(4, 6), 16) || 255,
  };
}

/* ── Dots ──────────────────────────────────────── */

export function renderDots(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: DotsSettings) {
  const { dotSize, spacing, randomize, colorMode, shape, sizeByBrightness } = settings;
  const { width, height, data } = imageData;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x += spacing) {
      const px = randomize ? x + (Math.random() - 0.5) * spacing * 0.5 : x;
      const py = randomize ? y + (Math.random() - 0.5) * spacing * 0.5 : y;

      const sx = Math.min(Math.round(px), width - 1);
      const sy = Math.min(Math.round(py), height - 1);
      if (sx < 0 || sy < 0) continue;

      const idx = (sy * width + sx) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      const radius = sizeByBrightness ? brightness * dotSize / 2 : dotSize / 2;
      if (radius < 0.3) continue;

      ctx.fillStyle = colorMode ? `rgb(${r},${g},${b})` : `rgb(${Math.round(brightness * 255)},${Math.round(brightness * 255)},${Math.round(brightness * 255)})`;

      ctx.beginPath();
      if (shape === "circle") {
        ctx.arc(px, py, radius, 0, Math.PI * 2);
      } else if (shape === "square") {
        ctx.rect(px - radius, py - radius, radius * 2, radius * 2);
      } else {
        // triangle
        ctx.moveTo(px, py - radius);
        ctx.lineTo(px + radius, py + radius);
        ctx.lineTo(px - radius, py + radius);
        ctx.closePath();
      }
      ctx.fill();
    }
  }
}

/* ── Contour ──────────────────────────────────── */

export function renderContour(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: ContourSettings) {
  const { levels, lineWidth, colorMode, invert, smoothing } = settings;
  const { width, height, data } = imageData;

  // Build grayscale grid
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
  }

  // Simple box blur for smoothing
  if (smoothing > 0) {
    const temp = new Float32Array(gray);
    const r = Math.ceil(smoothing);
    for (let y = r; y < height - r; y++) {
      for (let x = r; x < width - r; x++) {
        let sum = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            sum += temp[(y + dy) * width + (x + dx)];
            count++;
          }
        }
        gray[y * width + x] = sum / count;
      }
    }
  }

  ctx.fillStyle = invert ? "#e8e8e8" : "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = lineWidth;

  // Draw contour lines using marching squares approximation
  for (let level = 0; level < levels; level++) {
    const threshold = (level + 1) / (levels + 1);
    const hue = colorMode ? (level / levels) * 300 : 0;
    const lightness = invert ? 20 + (level / levels) * 40 : 60 + (level / levels) * 30;
    ctx.strokeStyle = colorMode
      ? `hsl(${hue}, 80%, ${lightness}%)`
      : invert ? `rgba(30,30,30,${0.4 + (level / levels) * 0.5})` : `rgba(220,220,220,${0.3 + (level / levels) * 0.5})`;

    ctx.beginPath();
    const step = Math.max(2, 4 - Math.floor(smoothing / 2));
    for (let y = 0; y < height - step; y += step) {
      for (let x = 0; x < width - step; x += step) {
        const tl = gray[y * width + x] >= threshold ? 1 : 0;
        const tr = gray[y * width + (x + step)] >= threshold ? 1 : 0;
        const bl = gray[(y + step) * width + x] >= threshold ? 1 : 0;
        const br = gray[(y + step) * width + (x + step)] >= threshold ? 1 : 0;
        const code = tl * 8 + tr * 4 + br * 2 + bl;

        if (code === 0 || code === 15) continue;

        // Simplified edge drawing
        const mx = x + step / 2;
        const my = y + step / 2;

        if (code === 1 || code === 14) { ctx.moveTo(x, my); ctx.lineTo(mx, y + step); }
        else if (code === 2 || code === 13) { ctx.moveTo(mx, y + step); ctx.lineTo(x + step, my); }
        else if (code === 3 || code === 12) { ctx.moveTo(x, my); ctx.lineTo(x + step, my); }
        else if (code === 4 || code === 11) { ctx.moveTo(mx, y); ctx.lineTo(x + step, my); }
        else if (code === 6 || code === 9) { ctx.moveTo(mx, y); ctx.lineTo(mx, y + step); }
        else if (code === 7 || code === 8) { ctx.moveTo(x, my); ctx.lineTo(mx, y); }
        else if (code === 5 || code === 10) {
          ctx.moveTo(x, my); ctx.lineTo(mx, y);
          ctx.moveTo(mx, y + step); ctx.lineTo(x + step, my);
        }
      }
    }
    ctx.stroke();
  }
}

/* ── Pixel Sort ──────────────────────────────── */

export function renderPixelSort(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: PixelSortSettings) {
  const { direction, threshold, sortBy, intensity, reverse } = settings;
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const thresholdVal = threshold / 100;
  const intensityVal = intensity / 100;

  function getValue(idx: number): number {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    if (sortBy === "brightness") return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (sortBy === "hue") {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max === min) return 0;
      let h = 0;
      if (max === r) h = (g - b) / (max - min);
      else if (max === g) h = 2 + (b - r) / (max - min);
      else h = 4 + (r - g) / (max - min);
      return ((h * 60 + 360) % 360) / 360;
    }
    // saturation
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  }

  if (direction === "horizontal") {
    for (let y = 0; y < height; y++) {
      let x = 0;
      while (x < width) {
        // Find start of sortable region
        while (x < width && getValue((y * width + x) * 4) < thresholdVal) x++;
        const start = x;
        while (x < width && getValue((y * width + x) * 4) >= thresholdVal) x++;
        const end = x;
        if (end - start < 2) continue;

        // Extract and sort pixels
        const pixels: number[][] = [];
        for (let i = start; i < end; i++) {
          const idx = (y * width + i) * 4;
          pixels.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
        }
        pixels.sort((a, b) => {
          const va = (a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114);
          const vb = (b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114);
          return reverse ? vb - va : va - vb;
        });

        // Blend sorted with original based on intensity
        for (let i = 0; i < pixels.length; i++) {
          const idx = (y * width + (start + i)) * 4;
          data[idx] = Math.round(data[idx] * (1 - intensityVal) + pixels[i][0] * intensityVal);
          data[idx + 1] = Math.round(data[idx + 1] * (1 - intensityVal) + pixels[i][1] * intensityVal);
          data[idx + 2] = Math.round(data[idx + 2] * (1 - intensityVal) + pixels[i][2] * intensityVal);
        }
      }
    }
  } else {
    for (let x = 0; x < width; x++) {
      let y = 0;
      while (y < height) {
        while (y < height && getValue((y * width + x) * 4) < thresholdVal) y++;
        const start = y;
        while (y < height && getValue((y * width + x) * 4) >= thresholdVal) y++;
        const end = y;
        if (end - start < 2) continue;

        const pixels: number[][] = [];
        for (let i = start; i < end; i++) {
          const idx = (i * width + x) * 4;
          pixels.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
        }
        pixels.sort((a, b) => {
          const va = (a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114);
          const vb = (b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114);
          return reverse ? vb - va : va - vb;
        });

        for (let i = 0; i < pixels.length; i++) {
          const idx = ((start + i) * width + x) * 4;
          data[idx] = Math.round(data[idx] * (1 - intensityVal) + pixels[i][0] * intensityVal);
          data[idx + 1] = Math.round(data[idx + 1] * (1 - intensityVal) + pixels[i][1] * intensityVal);
          data[idx + 2] = Math.round(data[idx + 2] * (1 - intensityVal) + pixels[i][2] * intensityVal);
        }
      }
    }
  }

  const result = new ImageData(data, width, height);
  ctx.putImageData(result, 0, 0);
}

/* ── Blockify ──────────────────────────────────── */

export function renderBlockify(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: BlockifySettings) {
  const { blockSize, borderWidth: gap, style, colorMode, borderColor } = settings;
  const rounded = style === "rounded";
  const outline = style === "outlined";
  const { width, height, data } = imageData;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      // Average color in block
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let by = 0; by < blockSize && y + by < height; by++) {
        for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
          const idx = ((y + by) * width + (x + bx)) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }
      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      if (brightness < 0.02) continue;

      const drawSize = blockSize - gap;
      if (drawSize < 1) continue;

      if (colorMode === "preserve") {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else if (colorMode === "mono") {
        ctx.fillStyle = brightness > 0.5 ? "#ffffff" : "#000000";
      } else {
        const v = Math.round(brightness * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
      }

      if (rounded) {
        const radius = Math.min(drawSize / 3, 4);
        drawRoundedRect(ctx, x, y, drawSize, drawSize, radius);
        ctx.fill();
        if (outline) {
          ctx.strokeStyle = borderColor || "rgba(255,255,255,0.1)";
          ctx.lineWidth = 0.5;
          drawRoundedRect(ctx, x, y, drawSize, drawSize, radius);
          ctx.stroke();
        }
      } else {
        ctx.fillRect(x, y, drawSize, drawSize);
        if (outline) {
          ctx.strokeStyle = borderColor || "rgba(255,255,255,0.1)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, drawSize, drawSize);
        }
      }
    }
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Threshold ──────────────────────────────── */

export interface ThresholdSettings {
  level: number;
  posterize: number;
  dither: boolean;
  invert: boolean;
  colorMode: "mono" | "color" | "duotone";
  foreground: string;
  background: string;
  brightness: number;
  contrast: number;
}

export const DEFAULT_THRESHOLD: ThresholdSettings = {
  level: 50,
  posterize: 2,
  dither: false,
  invert: false,
  colorMode: "mono",
  foreground: "#FFFFFF",
  background: "#000000",
  brightness: 0,
  contrast: 0,
};

export function renderThreshold(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: ThresholdSettings) {
  const { level, colorMode, invert, posterize, dither, foreground, background, brightness: br, contrast: ct } = settings;
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const thresholdVal = (level / 100) * 255;
  const levels = Math.max(2, posterize);
  const contrastFactor = 1 + ct / 50;
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    let r = data[idx], g = data[idx + 1], b = data[idx + 2];

    // Apply brightness/contrast
    if (br !== 0 || ct !== 0) {
      r = Math.max(0, Math.min(255, 128 + (r - 128) * contrastFactor + br * 2.55));
      g = Math.max(0, Math.min(255, 128 + (g - 128) * contrastFactor + br * 2.55));
      b = Math.max(0, Math.min(255, 128 + (b - 128) * contrastFactor + br * 2.55));
    }

    if (colorMode === "color") {
      data[idx] = Math.round(Math.round(r / 255 * (levels - 1)) / (levels - 1) * 255);
      data[idx + 1] = Math.round(Math.round(g / 255 * (levels - 1)) / (levels - 1) * 255);
      data[idx + 2] = Math.round(Math.round(b / 255 * (levels - 1)) / (levels - 1) * 255);
    } else {
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      let isLight: boolean;
      if (dither) {
        const x = i % width, y = Math.floor(i / width);
        const bayerVal = ((x & 3) * 4 + (y & 3)) / 16 * 255;
        isLight = gray > bayerVal * (thresholdVal / 128);
      } else if (levels <= 2) {
        isLight = gray >= thresholdVal;
      } else {
        const val = Math.round(Math.round(gray / 255 * (levels - 1)) / (levels - 1) * 255);
        isLight = val > 127;
      }
      if (invert) isLight = !isLight;
      if (colorMode === "mono") {
        data[idx] = isLight ? fg.r : bg.r;
        data[idx + 1] = isLight ? fg.g : bg.g;
        data[idx + 2] = isLight ? fg.b : bg.b;
      } else {
        const val = isLight ? 255 : 0;
        data[idx] = data[idx + 1] = data[idx + 2] = invert ? 255 - val : val;
      }
    }
  }

  ctx.putImageData(new ImageData(data, width, height), 0, 0);
}

/* ── Edge Detection ──────────────────────────── */

export interface EdgeDetectionSettings {
  method: "sobel" | "prewitt" | "laplacian";
  threshold: number;
  lineWidth: number;
  invert: boolean;
  colorMode: "mono" | "color" | "overlay";
  edgeColor: string;
  bgColor: string;
  brightness: number;
  contrast: number;
}

export const DEFAULT_EDGE_DETECTION: EdgeDetectionSettings = {
  method: "sobel",
  threshold: 30,
  lineWidth: 1,
  invert: false,
  colorMode: "mono",
  edgeColor: "#FFFFFF",
  bgColor: "#000000",
  brightness: 0,
  contrast: 0,
};

export function renderEdgeDetection(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: EdgeDetectionSettings) {
  const { method, threshold: thresholdPct, lineWidth: lw, invert, colorMode, edgeColor, bgColor, brightness: br, contrast: ct } = settings;
  const { width, height, data } = imageData;
  const strengthFactor = (thresholdPct / 25) || 1;
  const ec = parseHexColor(edgeColor);
  const bgc = parseHexColor(bgColor);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
  }

  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      let gx = 0, gy = 0;

      if (method === "laplacian") {
        const lap = -gray[idx - width] - gray[idx - 1] + 4 * gray[idx] - gray[idx + 1] - gray[idx + width];
        const mag = Math.min(1, Math.abs(lap) * strengthFactor);
        const v = invert ? Math.round((1 - mag) * 255) : Math.round(mag * 255);
        const oi = (y * width + x) * 4;
        if (colorMode === "color" && mag > 0.1) {
          output[oi] = Math.round(data[oi] * mag * strengthFactor);
          output[oi + 1] = Math.round(data[oi + 1] * mag * strengthFactor);
          output[oi + 2] = Math.round(data[oi + 2] * mag * strengthFactor);
        } else {
          const isEdge = mag > 0.1;
          output[oi] = isEdge ? (invert ? bgc.r : ec.r) : (invert ? ec.r : bgc.r);
          output[oi + 1] = isEdge ? (invert ? bgc.g : ec.g) : (invert ? ec.g : bgc.g);
          output[oi + 2] = isEdge ? (invert ? bgc.b : ec.b) : (invert ? ec.b : bgc.b);
        }
        output[oi + 3] = 255;
        continue;
      }

      const kx = method === "sobel"
        ? [[-1,0,1],[-2,0,2],[-1,0,1]]
        : [[-1,0,1],[-1,0,1],[-1,0,1]];
      const ky = method === "sobel"
        ? [[-1,-2,-1],[0,0,0],[1,2,1]]
        : [[-1,-1,-1],[0,0,0],[1,1,1]];

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const val = gray[(y + dy) * width + (x + dx)];
          gx += val * kx[dy + 1][dx + 1];
          gy += val * ky[dy + 1][dx + 1];
        }
      }

      const mag = Math.min(1, Math.sqrt(gx * gx + gy * gy) * strengthFactor);
      const v = invert ? Math.round((1 - mag) * 255) : Math.round(mag * 255);
      const oi = (y * width + x) * 4;
      if (colorMode === "color" && mag > 0.1) {
        output[oi] = Math.min(255, Math.round(data[oi] * mag * strengthFactor));
        output[oi + 1] = Math.min(255, Math.round(data[oi + 1] * mag * strengthFactor));
        output[oi + 2] = Math.min(255, Math.round(data[oi + 2] * mag * strengthFactor));
      } else {
        const isEdge = mag > 0.1;
        output[oi] = isEdge ? (invert ? bgc.r : ec.r) : (invert ? ec.r : bgc.r);
        output[oi + 1] = isEdge ? (invert ? bgc.g : ec.g) : (invert ? ec.g : bgc.g);
        output[oi + 2] = isEdge ? (invert ? bgc.b : ec.b) : (invert ? ec.b : bgc.b);
      }
      output[oi + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(output, width, height), 0, 0);
}

/* ── Crosshatch ──────────────────────────────── */

export interface CrosshatchSettings {
  density: number;
  layers: number;
  angle: number;
  lineWidth: number;
  randomness: number;
  invert: boolean;
  lineColor: string;
  bgColor: string;
  brightness: number;
  contrast: number;
}

export const DEFAULT_CROSSHATCH: CrosshatchSettings = {
  density: 6,
  layers: 3,
  angle: 45,
  lineWidth: 0.1,
  randomness: 0,
  invert: false,
  lineColor: "#000000",
  bgColor: "#FFFFFF",
  brightness: 0,
  contrast: 0,
};

export function renderCrosshatch(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: CrosshatchSettings) {
  const { density, lineWidth, angle, layers, randomness, invert, lineColor, bgColor, brightness: br, contrast: ct } = settings;
  const { width, height, data } = imageData;

  const spacing = Math.max(3, 20 - density * 2);
  const contrastFactor = 1 + ct / 50;
  const lc = parseHexColor(lineColor);
  const bgc = parseHexColor(bgColor);

  ctx.fillStyle = `rgb(${bgc.r},${bgc.g},${bgc.b})`;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  const angles = [];
  for (let i = 0; i < layers; i++) {
    angles.push((angle + (i * 180 / layers)) * Math.PI / 180);
  }

  for (let level = 0; level < layers; level++) {
    const a = angles[level];
    const darkThreshold = (level + 1) / (layers + 1);
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(${lc.r},${lc.g},${lc.b},0.7)`;

    const diag = Math.sqrt(width * width + height * height);
    for (let d = -diag; d < diag; d += spacing) {
      const randOffset = randomness > 0 ? (Math.random() - 0.5) * randomness * 2 : 0;
      const startX = width / 2 + cos * (d + randOffset) - sin * diag;
      const startY = height / 2 + sin * (d + randOffset) + cos * diag;
      const endX = width / 2 + cos * (d + randOffset) + sin * diag;
      const endY = height / 2 + sin * (d + randOffset) - cos * diag;

      let moved = false;
      const steps = Math.ceil(diag * 2 / spacing);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = Math.round(startX + (endX - startX) * t);
        const py = Math.round(startY + (endY - startY) * t);
        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        const idx = (py * width + px) * 4;
        let brightness = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
        brightness = Math.max(0, Math.min(1, 0.5 + (brightness - 0.5) * contrastFactor + br / 100));
        if (invert) brightness = 1 - brightness;

        if (brightness < darkThreshold) {
          if (!moved) { ctx.moveTo(px, py); moved = true; }
          else ctx.lineTo(px, py);
        } else {
          moved = false;
        }
      }
    }
    ctx.stroke();
  }
}

/* ── Wave Lines ──────────────────────────────── */

export interface WaveLinesSettings {
  lineCount: number;
  amplitude: number;
  frequency: number;
  lineWidth: number;
  colorMode: "original" | "grayscale" | "mono";
  direction: "horizontal" | "vertical";
  animate: boolean;
  brightness: number;
  contrast: number;
}

export const DEFAULT_WAVE_LINES: WaveLinesSettings = {
  lineCount: 105,
  amplitude: 13,
  frequency: 60,
  lineWidth: 0.6,
  colorMode: "original",
  direction: "horizontal",
  animate: false,
  brightness: 0,
  contrast: 0,
};

export function renderWaveLines(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: WaveLinesSettings) {
  const { lineCount, amplitude, frequency, lineWidth, colorMode, direction, brightness: br, contrast: ct } = settings;
  const { width, height, data } = imageData;

  const contrastFactor = 1 + ct / 50;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  const isHoriz = direction === "horizontal";
  const primaryLen = isHoriz ? width : height;
  const secondaryLen = isHoriz ? height : width;
  const spacing = secondaryLen / lineCount;
  const freq = frequency / 500;

  for (let i = 0; i < lineCount; i++) {
    const basePos = i * spacing + spacing / 2;
    ctx.beginPath();

    for (let p = 0; p < primaryLen; p += 2) {
      const sx = isHoriz ? p : Math.round(basePos);
      const sy = isHoriz ? Math.round(basePos) : p;
      const clampX = Math.min(sx, width - 1);
      const clampY = Math.min(sy, height - 1);
      const idx = (clampY * width + clampX) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      let brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      brightness = Math.max(0, Math.min(1, 0.5 + (brightness - 0.5) * contrastFactor + br / 100));

      const wave = Math.sin(p * freq) * amplitude * brightness;
      const drawX = isHoriz ? p : basePos + wave;
      const drawY = isHoriz ? basePos + wave : p;

      if (p === 0) ctx.moveTo(drawX, drawY);
      else ctx.lineTo(drawX, drawY);
    }

    // Sample color from midpoint
    const midP = Math.floor(primaryLen / 2);
    const midX = isHoriz ? midP : Math.round(basePos);
    const midY = isHoriz ? Math.round(basePos) : midP;
    const midIdx = (Math.min(midY, height - 1) * width + Math.min(midX, width - 1)) * 4;
    if (colorMode === "original") {
      ctx.strokeStyle = `rgb(${data[midIdx]},${data[midIdx + 1]},${data[midIdx + 2]})`;
    } else if (colorMode === "mono") {
      ctx.strokeStyle = "#ffffff";
    } else {
      const bv = (data[midIdx] * 0.299 + data[midIdx + 1] * 0.587 + data[midIdx + 2] * 0.114) / 255;
      const v = Math.round(bv * 255);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
    }
    ctx.stroke();
  }
}

/* ── Noise Field ──────────────────────────────── */

export interface NoiseFieldSettings {
  scale: number;
  density: number;
  lineLength: number;
  colorMode: boolean;
  lineWidth: number;
}

export const DEFAULT_NOISE_FIELD: NoiseFieldSettings = {
  scale: 50,
  density: 40,
  lineLength: 15,
  colorMode: true,
  lineWidth: 1,
};

export function renderNoiseField(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: NoiseFieldSettings) {
  const { scale, density, lineLength, colorMode, lineWidth } = settings;
  const { width, height, data } = imageData;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  const step = Math.max(3, 20 - Math.floor(density / 6));
  const scaleFactor = scale / 50;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      if (brightness < 0.03) continue;

      // Use brightness and position to determine angle
      const angle = (Math.sin(x * 0.01 * scaleFactor) * Math.cos(y * 0.01 * scaleFactor) + brightness) * Math.PI * 2;
      const len = lineLength * brightness;

      const endX = x + Math.cos(angle) * len;
      const endY = y + Math.sin(angle) * len;

      if (colorMode) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.3 + brightness * 0.7})`;
      } else {
        const v = Math.round(brightness * 255);
        ctx.strokeStyle = `rgba(${v},${v},${v},${0.3 + brightness * 0.7})`;
      }

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }
}

/* ── Voronoi ──────────────────────────────────── */

export interface VoronoiSettings {
  cellSize: number;
  colorMode: "cell-average" | "center-sample" | "grayscale";
  showEdges: boolean;
  edgeWidth: number;
  edgeColor: "black" | "white" | "auto";
  randomize: number;
  brightness: number;
  contrast: number;
}

export const DEFAULT_VORONOI: VoronoiSettings = {
  cellSize: 30,
  colorMode: "cell-average",
  showEdges: true,
  edgeWidth: 0.3,
  edgeColor: "black",
  randomize: 80,
  brightness: 0,
  contrast: 0,
};

export function renderVoronoi(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: VoronoiSettings) {
  const { cellSize: cs, colorMode, showEdges, edgeWidth, edgeColor, randomize, brightness: br, contrast: ct } = settings;
  const { width, height, data } = imageData;

  // Derive cell count from cellSize
  const cellCount = Math.max(10, Math.round((width * height) / (cs * cs)));
  const jitterFactor = randomize / 100;
  const cols = Math.ceil(Math.sqrt(cellCount * width / height));
  const rows = Math.ceil(cellCount / cols);
  const cellW = width / cols;
  const cellH = height / rows;
  const contrastFactor = 1 + ct / 50;

  const seeds: { x: number; y: number; r: number; g: number; b: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5 + (Math.random() - 0.5) * jitterFactor) * cellW;
      const cy = (row + 0.5 + (Math.random() - 0.5) * jitterFactor) * cellH;
      const sx = Math.min(Math.max(0, Math.round(cx)), width - 1);
      const sy = Math.min(Math.max(0, Math.round(cy)), height - 1);
      const idx = (sy * width + sx) * 4;
      seeds.push({ x: cx, y: cy, r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // For each pixel, find nearest seed
  const cellMap = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minDist = Infinity;
      let nearest = 0;
      for (let i = 0; i < seeds.length; i++) {
        const dx = x - seeds[i].x;
        const dy = y - seeds[i].y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) { minDist = dist; nearest = i; }
      }
      cellMap[y * width + x] = nearest;
    }
  }

  // Draw cells
  const output = ctx.createImageData(width, height);
  const od = output.data;
  const edgeVal = edgeColor === "white" ? 240 : edgeColor === "black" ? 20 : 128;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = cellMap[y * width + x];
      const s = seeds[cell];
      const oi = (y * width + x) * 4;

      let r = s.r, g = s.g, b = s.b;
      // Apply brightness/contrast
      if (br !== 0 || ct !== 0) {
        r = Math.max(0, Math.min(255, 128 + (r - 128) * contrastFactor + br * 2.55));
        g = Math.max(0, Math.min(255, 128 + (g - 128) * contrastFactor + br * 2.55));
        b = Math.max(0, Math.min(255, 128 + (b - 128) * contrastFactor + br * 2.55));
      }

      if (colorMode === "grayscale") {
        const v = Math.round((r * 0.299 + g * 0.587 + b * 0.114));
        od[oi] = od[oi + 1] = od[oi + 2] = v;
      } else {
        od[oi] = r; od[oi + 1] = g; od[oi + 2] = b;
      }
      od[oi + 3] = 255;

      // Edge detection
      if (showEdges && (x > 0 || y > 0)) {
        const left = x > 0 ? cellMap[y * width + x - 1] : cell;
        const top = y > 0 ? cellMap[(y - 1) * width + x] : cell;
        if (left !== cell || top !== cell) {
          od[oi] = od[oi + 1] = od[oi + 2] = edgeVal;
        }
      }
    }
  }
  ctx.putImageData(output, 0, 0);

  // Thicker edges
  if (showEdges && edgeWidth > 1) {
    ctx.strokeStyle = "rgba(20,20,20,0.8)";
    ctx.lineWidth = edgeWidth;
    for (let y = 1; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const cell = cellMap[y * width + x];
        if (cellMap[y * width + x - 1] !== cell || cellMap[(y - 1) * width + x] !== cell) {
          ctx.beginPath();
          ctx.arc(x, y, edgeWidth / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }
}

/* ── VHS ──────────────────────────────────────── */

export interface VHSSettings {
  distortion: number;
  noise: number;
  colorBleed: number;
  scanlines: number;
  tracking: number;
  chromatic: number;
  brightness: number;
  contrast: number;
}

export const DEFAULT_VHS: VHSSettings = {
  distortion: 50,
  noise: 30,
  colorBleed: 50,
  scanlines: 30,
  tracking: 20,
  chromatic: 8,
  brightness: 0,
  contrast: 0,
};

export function renderVHS(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: VHSSettings) {
  const { tracking, noise, colorBleed, scanlines, chromatic, distortion, brightness: br, contrast: ct } = settings;
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);

  // Chromatic aberration
  if (chromatic > 0) {
    const shifted = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const rIdx = (y * width + Math.min(width - 1, x + chromatic)) * 4;
        const bIdx = (y * width + Math.max(0, x - chromatic)) * 4;
        shifted[i] = data[rIdx]; // red shifted right
        shifted[i + 1] = data[i + 1]; // green stays
        shifted[i + 2] = data[bIdx + 2]; // blue shifted left
        shifted[i + 3] = 255;
      }
    }
    data.set(shifted);
  }

  // Color bleed (horizontal smearing)
  if (colorBleed > 0) {
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const i = (y * width + x) * 4;
        const pi = (y * width + x - 1) * 4;
        const blend = colorBleed / 100;
        data[i] = Math.round(data[i] * (1 - blend) + data[pi] * blend);
        data[i + 1] = Math.round(data[i + 1] * (1 - blend) + data[pi + 1] * blend);
        data[i + 2] = Math.round(data[i + 2] * (1 - blend) + data[pi + 2] * blend);
      }
    }
  }

  // Brightness/Contrast
  if (br !== 0 || ct !== 0) {
    const contrastFactor = 1 + ct / 50;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, 128 + (data[i] - 128) * contrastFactor + br * 2.55));
      data[i + 1] = Math.min(255, Math.max(0, 128 + (data[i + 1] - 128) * contrastFactor + br * 2.55));
      data[i + 2] = Math.min(255, Math.max(0, 128 + (data[i + 2] - 128) * contrastFactor + br * 2.55));
    }
  }

  // Noise
  if (noise > 0) {
    const noiseFactor = noise / 100;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 255 * noiseFactor * 0.3;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
  }

  ctx.putImageData(new ImageData(data, width, height), 0, 0);

  // Tracking lines (horizontal displacement)
  if (tracking > 0) {
    const lineCount = Math.floor(tracking / 10);
    for (let i = 0; i < lineCount; i++) {
      const y = Math.floor(Math.random() * height);
      const h = 2 + Math.floor(Math.random() * 8);
      const displacement = (Math.random() - 0.5) * tracking * 0.5;
      const slice = ctx.getImageData(0, y, width, Math.min(h, height - y));
      ctx.putImageData(slice, displacement, y);
    }
  }

  // Distortion (wavy horizontal lines)
  if (distortion > 0) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.drawImage(ctx.canvas, 0, 0);

    for (let y = 0; y < height; y++) {
      const offset = Math.sin(y * 0.05) * (distortion / 10);
      ctx.drawImage(tempCanvas, 0, y, width, 1, offset, y, width, 1);
    }
  }

  // Scanlines
  if (scanlines > 0) {
    const scanAlpha = scanlines / 100 * 0.4;
    ctx.fillStyle = `rgba(0,0,0,${scanAlpha})`;
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
  }

  // Slight green/warm tint
  ctx.fillStyle = "rgba(0,255,100,0.02)";
  ctx.fillRect(0, 0, width, height);
}