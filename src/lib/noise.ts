export interface NoiseConfig {
  type: "film" | "fine" | "rough";
  scale: number;
  intensity: number;
  contrast: number;
  colorMode: "mono" | "tinted";
  tintColor: string;
  seed: number;
}

const TYPE_PARAMS = {
  film: { octaves: 1, baseFreq: 4, lacunarity: 2, persistence: 0.5 },
  fine: { octaves: 3, baseFreq: 8, lacunarity: 2, persistence: 0.5 },
  rough: { octaves: 4, baseFreq: 2, lacunarity: 2, persistence: 0.6 },
};

function hash(x: number, y: number, seed: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(
  x: number,
  y: number,
  period: number,
  seed: number
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const sx = smoothstep(fx);
  const sy = smoothstep(fy);

  const wrap = (v: number) => ((v % period) + period) % period;

  const n00 = hash(wrap(ix), wrap(iy), seed);
  const n10 = hash(wrap(ix + 1), wrap(iy), seed);
  const n01 = hash(wrap(ix), wrap(iy + 1), seed);
  const n11 = hash(wrap(ix + 1), wrap(iy + 1), seed);

  return (
    n00 * (1 - sx) * (1 - sy) +
    n10 * sx * (1 - sy) +
    n01 * (1 - sx) * sy +
    n11 * sx * sy
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function generateNoise(
  canvas: HTMLCanvasElement,
  config: NoiseConfig,
  width: number,
  height: number,
  transparent: boolean = false
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const params = TYPE_PARAMS[config.type];
  const frequency = params.baseFreq * (config.scale / 50);
  const period = Math.max(4, Math.round(frequency * 4));

  const [tintR, tintG, tintB] =
    config.colorMode === "tinted" ? hexToRgb(config.tintColor) : [255, 255, 255];

  const contrastFactor = 1 + (config.contrast - 50) / 25;
  const intensityFactor = config.intensity / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 1;
      let freq = frequency;
      let maxAmp = 0;

      for (let o = 0; o < params.octaves; o++) {
        value +=
          valueNoise(
            (x / width) * freq,
            (y / height) * freq,
            period * (o + 1),
            config.seed + o * 1000
          ) * amplitude;
        maxAmp += amplitude;
        amplitude *= params.persistence;
        freq *= params.lacunarity;
      }

      value /= maxAmp;

      // Film grain gets extra randomness
      if (config.type === "film") {
        const filmRand = hash(x, y, config.seed + 99999);
        value = value * 0.4 + filmRand * 0.6;
      }

      // Contrast
      value = 0.5 + (value - 0.5) * contrastFactor;
      // Intensity
      value = value * intensityFactor;
      value = Math.max(0, Math.min(1, value));

      const idx = (y * width + x) * 4;
      const v = Math.round(value * 255);

      if (config.colorMode === "mono") {
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
      } else {
        data[idx] = Math.round((v * tintR) / 255);
        data[idx + 1] = Math.round((v * tintG) / 255);
        data[idx + 2] = Math.round((v * tintB) / 255);
      }
      data[idx + 3] = transparent ? v : 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
