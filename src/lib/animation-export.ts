import { GIFEncoder, quantize, applyPalette } from "gifenc";

export interface AnimationExportConfig {
  width: number;
  height: number;
  fps: number;
  duration: number; // seconds
  format: "gif" | "webm";
}

/**
 * Export an animation as GIF or WebM video.
 * `renderFrame` is called for each frame with (canvas, ctx, progress 0-1, frameIndex).
 */
export async function exportAnimation(
  config: AnimationExportConfig,
  renderFrame: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame: number
  ) => void,
  onProgress?: (pct: number) => void
): Promise<void> {
  const { width, height, fps, duration, format } = config;
  const totalFrames = Math.round(fps * duration);

  if (format === "gif") {
    await exportGIF(width, height, fps, totalFrames, renderFrame, onProgress);
  } else {
    await exportWebM(width, height, fps, totalFrames, renderFrame, onProgress);
  }
}

async function exportGIF(
  width: number,
  height: number,
  fps: number,
  totalFrames: number,
  renderFrame: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame: number
  ) => void,
  onProgress?: (pct: number) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);

  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames;
    renderFrame(canvas, ctx, progress, i);

    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, width, height, {
      palette,
      delay,
      dispose: 1,
    });

    onProgress?.(((i + 1) / totalFrames) * 100);

    // Yield to UI thread every 5 frames
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  gif.finish();
  const bytes = gif.bytes();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
  downloadBlob(blob, `grainto-animation-${Date.now()}.gif`);
}

async function exportWebM(
  width: number,
  height: number,
  fps: number,
  totalFrames: number,
  renderFrame: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame: number
  ) => void,
  onProgress?: (pct: number) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];

  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 5_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  const frameDelay = 1000 / fps;

  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames;
    renderFrame(canvas, ctx, progress, i);

    // Request a frame from the stream
    if ("requestFrame" in track) {
      (track as { requestFrame: () => void }).requestFrame();
    }

    onProgress?.(((i + 1) / totalFrames) * 100);
    await new Promise((r) => setTimeout(r, frameDelay));
  }

  recorder.stop();
  await done;

  const blob = new Blob(chunks, { type: "video/webm" });
  downloadBlob(blob, `grainto-animation-${Date.now()}.webm`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
