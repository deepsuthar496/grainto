export const RESOLUTION_PRESETS: Record<string, { width: number; height: number }> = {
  HD: { width: 1920, height: 1080 },
  "4K": { width: 3840, height: 2160 },
  "8K": { width: 7680, height: 4320 },
  Square: { width: 2048, height: 2048 },
};

export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  format: "png" | "jpg",
  filename: string
): Promise<void> {
  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to create blob"));
      },
      mimeType,
      0.95
    );
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
