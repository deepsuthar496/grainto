export interface GradientStop {
  color: string;
  position: number; // 0-100
}

export interface GradientConfig {
  type: "linear" | "radial" | "mesh";
  angle: number;
  stops: GradientStop[];
  softness: number;
  grainOverlay: boolean;
}

export function renderGradient(
  canvas: HTMLCanvasElement,
  config: GradientConfig,
  width: number,
  height: number
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, width, height);

  if (config.type === "linear") {
    renderLinearGradient(ctx, config, width, height);
  } else if (config.type === "radial") {
    renderRadialGradient(ctx, config, width, height);
  } else {
    renderMeshGradient(ctx, config, width, height);
  }

  if (config.grainOverlay) {
    addGrainOverlay(ctx, width, height);
  }
}

function renderLinearGradient(
  ctx: CanvasRenderingContext2D,
  config: GradientConfig,
  w: number,
  h: number
) {
  const angleRad = (config.angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const len = Math.abs(w * cos) + Math.abs(h * sin);

  const cx = w / 2;
  const cy = h / 2;

  const gradient = ctx.createLinearGradient(
    cx - (cos * len) / 2,
    cy - (sin * len) / 2,
    cx + (cos * len) / 2,
    cy + (sin * len) / 2
  );

  config.stops.forEach((stop) => {
    gradient.addColorStop(stop.position / 100, stop.color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function renderRadialGradient(
  ctx: CanvasRenderingContext2D,
  config: GradientConfig,
  w: number,
  h: number
) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.max(w, h) * 0.7;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

  config.stops.forEach((stop) => {
    gradient.addColorStop(stop.position / 100, stop.color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function renderMeshGradient(
  ctx: CanvasRenderingContext2D,
  config: GradientConfig,
  w: number,
  h: number
) {
  // Fill with first stop color
  ctx.fillStyle = config.stops[0]?.color || "#000000";
  ctx.fillRect(0, 0, w, h);

  // Soft mesh positions
  const positions = [
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.2 },
    { x: 0.5, y: 0.7 },
    { x: 0.1, y: 0.8 },
    { x: 0.9, y: 0.9 },
    { x: 0.5, y: 0.1 },
  ];

  const softFactor = config.softness / 50;

  config.stops.forEach((stop, i) => {
    const pos = positions[i % positions.length];
    const px = pos.x * w;
    const py = pos.y * h;
    const radius = Math.max(w, h) * 0.5 * softFactor;

    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, stop.color);
    gradient.addColorStop(1, stop.color + "00"); // transparent

    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });

  ctx.globalCompositeOperation = "source-over";
}

function addGrainOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 30;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }

  ctx.putImageData(imageData, 0, 0);
}

export function generateCSSCode(config: GradientConfig): string {
  const stops = config.stops
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");

  if (config.type === "linear") {
    return `background: linear-gradient(${config.angle}deg, ${stops});`;
  }

  if (config.type === "radial") {
    return `background: radial-gradient(circle, ${stops});`;
  }

  // Mesh approximation
  const layers = config.stops
    .map((s, i) => {
      const x = Math.round(
        [20, 80, 50, 10, 90, 50][i % 6]
      );
      const y = Math.round(
        [30, 20, 70, 80, 90, 10][i % 6]
      );
      return `radial-gradient(circle at ${x}% ${y}%, ${s.color}, transparent 70%)`;
    })
    .join(",\n    ");

  return `background: ${layers};`;
}
