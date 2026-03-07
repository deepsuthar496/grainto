import { useEffect, useRef, useState, useCallback } from "react";
import {
  renderGradient,
  generateCSSCode,
  type GradientConfig,
  type GradientStop,
} from "@/lib/gradient";
import { downloadCanvas, RESOLUTION_PRESETS, copyToClipboard } from "@/lib/export-utils";
import { exportAnimation } from "@/lib/animation-export";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Plus, X, Copy, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { GradientOverlay } from "./GradientOverlay";
import { ZoomBar } from "./NoiseGenerator";
import {
  SettingsSection,
  SettingsRow,
  InlineSlider,
  SettingsCheckbox,
  FormatTabs,
} from "./shared";

const PREVIEW_MAX = 512;

function getPreviewDimensions(resKey: string) {
  const res = RESOLUTION_PRESETS[resKey] || RESOLUTION_PRESETS.HD;
  const aspect = res.width / res.height;
  if (aspect >= 1) {
    return { width: PREVIEW_MAX, height: Math.round(PREVIEW_MAX / aspect) };
  }
  return { width: Math.round(PREVIEW_MAX * aspect), height: PREVIEW_MAX };
}

type GradientAnimMode = "rotate" | "hueShift" | "pulse";

interface GradientAnimSettings {
  enabled: boolean;
  mode: GradientAnimMode;
  speed: number; // 1-100
  duration: number; // seconds for export
  fps: number;
  exportFormat: "gif" | "webm";
}

const DEFAULT_ANIM: GradientAnimSettings = {
  enabled: false,
  mode: "rotate",
  speed: 50,
  duration: 3,
  fps: 24,
  exportFormat: "webm",
};

const GRADIENT_PRESETS: { name: string; config: GradientConfig }[] = [
  {
    name: "Sunset",
    config: { type: "linear", angle: 135, stops: [{ color: "#1a1a2e", position: 0 }, { color: "#e94560", position: 50 }, { color: "#f5a623", position: 100 }], softness: 50, grainOverlay: false },
  },
  {
    name: "Ocean",
    config: { type: "linear", angle: 180, stops: [{ color: "#0a0a1a", position: 0 }, { color: "#1a3a5c", position: 40 }, { color: "#2de2e6", position: 100 }], softness: 50, grainOverlay: false },
  },
  {
    name: "Aurora",
    config: { type: "mesh", angle: 0, stops: [{ color: "#0a0a1a", position: 0 }, { color: "#6b5ce7", position: 30 }, { color: "#00d4aa", position: 60 }, { color: "#ff6b9d", position: 100 }], softness: 60, grainOverlay: false },
  },
  {
    name: "Midnight",
    config: { type: "radial", angle: 0, stops: [{ color: "#1a1a3e", position: 0 }, { color: "#0a0a1a", position: 100 }], softness: 50, grainOverlay: false },
  },
];

const DEFAULT_CONFIG: GradientConfig = {
  type: "linear",
  angle: 135,
  stops: [
    { color: "#1a1a2e", position: 0 },
    { color: "#e94560", position: 50 },
    { color: "#0f3460", position: 100 },
  ],
  softness: 50,
  grainOverlay: false,
};

function hexToHSL(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getAnimatedConfig(base: GradientConfig, anim: GradientAnimSettings, progress: number): GradientConfig {
  const t = progress; // 0-1
  if (anim.mode === "rotate") {
    return { ...base, angle: (base.angle + t * 360) % 360 };
  }
  if (anim.mode === "hueShift") {
    const shift = t * 360;
    return {
      ...base,
      stops: base.stops.map((s) => {
        const [h, sat, l] = hexToHSL(s.color);
        return { ...s, color: hslToHex(h + shift, sat, l) };
      }),
    };
  }
  if (anim.mode === "pulse") {
    const pulse = 30 + 70 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
    return { ...base, softness: pulse };
  }
  return base;
}

export function GradientGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<GradientConfig>({ ...DEFAULT_CONFIG });
  const [anim, setAnim] = useState<GradientAnimSettings>({ ...DEFAULT_ANIM });
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [exportRes, setExportRes] = useState("HD");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const animStartRef = useRef(0);

  const previewDims = getPreviewDimensions(exportRes);

  // Static render
  useEffect(() => {
    if (!canvasRef.current || anim.enabled) return;
    renderGradient(canvasRef.current, config, previewDims.width, previewDims.height);
  }, [config, anim.enabled, previewDims.width, previewDims.height]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || !anim.enabled) return;
    const canvas = canvasRef.current;
    animStartRef.current = performance.now();
    const cycleDuration = (101 - anim.speed) * 80;

    const loop = () => {
      const elapsed = performance.now() - animStartRef.current;
      const progress = (elapsed % cycleDuration) / cycleDuration;
      const animConfig = getAnimatedConfig(config, anim, progress);
      renderGradient(canvas, animConfig, previewDims.width, previewDims.height);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [config, anim, previewDims.width, previewDims.height]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = RESOLUTION_PRESETS[exportRes] || RESOLUTION_PRESETS.HD;
      const offscreen = document.createElement("canvas");
      renderGradient(offscreen, config, res.width, res.height);
      await downloadCanvas(offscreen, exportFormat, `grainto-gradient-${config.type}-${Date.now()}`);
      toast.success("Gradient downloaded!");
    } catch {
      toast.error("Export failed.");
    } finally {
      setExporting(false);
    }
  }, [config, exportFormat, exportRes]);

  const handleAnimExport = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const res = RESOLUTION_PRESETS[exportRes] || RESOLUTION_PRESETS.HD;
      await exportAnimation(
        { width: res.width, height: res.height, fps: anim.fps, duration: anim.duration, format: anim.exportFormat },
        (canvas, _ctx, progress) => {
          const animConfig = getAnimatedConfig(config, anim, progress);
          renderGradient(canvas, animConfig, res.width, res.height);
        },
        (pct) => setExportProgress(Math.round(pct))
      );
      toast.success(`Animation exported as ${anim.exportFormat.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      toast.error("Animation export failed.");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [config, anim, exportRes]);

  const handleCopyCSS = async () => {
    const css = generateCSSCode(config);
    const ok = await copyToClipboard(css);
    if (ok) toast.success("CSS copied!");
    else toast.error("Failed to copy");
  };

  const resetConfig = () => setConfig({ ...DEFAULT_CONFIG });

  const updateStop = (index: number, updates: Partial<GradientStop>) => {
    setConfig((c) => ({ ...c, stops: c.stops.map((s, i) => (i === index ? { ...s, ...updates } : s)) }));
  };
  const addStop = () => {
    if (config.stops.length >= 6) return;
    setConfig((c) => ({ ...c, stops: [...c.stops, { color: "#888888", position: 50 }] }));
  };
  const removeStop = (index: number) => {
    if (config.stops.length <= 2) return;
    setConfig((c) => ({ ...c, stops: c.stops.filter((_, i) => i !== index) }));
  };

  return (
    <div className="flex h-full">
      {/* Canvas Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="relative group/canvas"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          >
            <canvas
              ref={canvasRef}
              width={previewDims.width}
              height={previewDims.height}
              className="rounded-sm border border-border/20 block"
              style={{ maxWidth: "512px", maxHeight: "512px", width: "100%", height: "auto" }}
            />
            <div className="opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-200">
              <GradientOverlay
                type={config.type}
                angle={config.angle}
                onAngleChange={(a) => setConfig((c) => ({ ...c, angle: a }))}
                size={previewDims.width}
              />
            </div>
          </div>
        </div>

        <ZoomBar zoom={zoom} setZoom={setZoom} resetZoom={resetZoom} />
      </div>

      {/* Settings Panel */}
      <div className="w-[280px] border-l border-border/40 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <SettingsSection title="Settings" onReset={resetConfig} defaultOpen>
            <SettingsRow label="Type">
              <Select value={config.type} onValueChange={(v) => setConfig((c) => ({ ...c, type: v as GradientConfig["type"] }))}>
                <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                  <SelectItem value="mesh">Mesh</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
            <div className="px-4 py-1.5">
              <div className="flex gap-1 flex-wrap">
                {GRADIENT_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => setConfig({ ...p.config })} className="px-2 py-0.5 text-[10px] text-muted-foreground/60 hover:text-foreground border border-border/30 rounded-sm transition-colors">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Adjustments" defaultOpen>
            {config.type === "linear" && (
              <InlineSlider label="Angle" value={config.angle} min={0} max={360} suffix="°" onChange={(v) => setConfig((c) => ({ ...c, angle: v }))} onReset={() => setConfig((c) => ({ ...c, angle: 135 }))} />
            )}
            {config.type === "mesh" && (
              <InlineSlider label="Softness" value={config.softness} min={10} max={100} onChange={(v) => setConfig((c) => ({ ...c, softness: v }))} onReset={() => setConfig((c) => ({ ...c, softness: 50 }))} />
            )}
            <SettingsCheckbox
              label="Grain Overlay"
              checked={config.grainOverlay}
              onChange={(v) => setConfig((c) => ({ ...c, grainOverlay: v }))}
            />
          </SettingsSection>

          <SettingsSection title="Color Stops" defaultOpen>
            <div className="px-4 py-1 space-y-1.5">
              {config.stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => updateStop(i, { color: e.target.value })}
                    className="w-5 h-5 rounded-sm cursor-pointer bg-transparent border border-border/40 shrink-0"
                  />
                  <span className="text-[9px] font-mono text-muted-foreground/40 w-12 uppercase">{stop.color}</span>
                  <Slider
                    value={[stop.position]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => updateStop(i, { position: v })}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground/40 w-5 text-right tabular-nums font-mono">{stop.position}</span>
                  {config.stops.length > 2 && (
                    <button onClick={() => removeStop(i)} className="p-0.5 hover:text-foreground transition-colors text-muted-foreground/30">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
              {config.stops.length < 6 && (
                <button onClick={addStop} className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors mt-1">
                  <Plus className="h-2.5 w-2.5" /> Add Stop
                </button>
              )}
            </div>
          </SettingsSection>

          {/* Animation */}
          <SettingsSection title="Animation" defaultOpen>
            <SettingsCheckbox
              label="Enable Animation"
              checked={anim.enabled}
              onChange={(v) => setAnim((a) => ({ ...a, enabled: v }))}
            />
            {anim.enabled && (
              <>
                <SettingsRow label="Mode">
                  <Select value={anim.mode} onValueChange={(v) => setAnim((a) => ({ ...a, mode: v as GradientAnimMode }))}>
                    <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rotate">Rotate</SelectItem>
                      <SelectItem value="hueShift">Hue Shift</SelectItem>
                      <SelectItem value="pulse">Pulse</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <InlineSlider label="Speed" value={anim.speed} min={1} max={100} onChange={(v) => setAnim((a) => ({ ...a, speed: v }))} onReset={() => setAnim((a) => ({ ...a, speed: 50 }))} />
                <InlineSlider label="Duration" value={anim.duration} min={1} max={10} suffix="s" onChange={(v) => setAnim((a) => ({ ...a, duration: v }))} onReset={() => setAnim((a) => ({ ...a, duration: 3 }))} />
                <InlineSlider label="FPS" value={anim.fps} min={10} max={60} onChange={(v) => setAnim((a) => ({ ...a, fps: v }))} onReset={() => setAnim((a) => ({ ...a, fps: 24 }))} />
                <SettingsRow label="Format">
                  <div className="flex-1">
                    <FormatTabs
                      value={anim.exportFormat}
                      onChange={(v) => setAnim((a) => ({ ...a, exportFormat: v as "gif" | "webm" }))}
                      options={[
                        { value: "gif", label: "GIF" },
                        { value: "webm", label: "Video" },
                      ]}
                    />
                  </div>
                </SettingsRow>
              </>
            )}
          </SettingsSection>

          {!anim.enabled && (
            <SettingsSection title="Export" defaultOpen>
              <div className="px-4 py-1">
                <FormatTabs
                  value={exportFormat}
                  onChange={(v) => setExportFormat(v as "png" | "jpg")}
                  options={[
                    { value: "png", label: "PNG" },
                    { value: "jpg", label: "JPEG" },
                  ]}
                />
              </div>
              <SettingsRow label="Resolution">
                <Select value={exportRes} onValueChange={setExportRes}>
                  <SelectTrigger className="h-7 text-xs w-20 bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HD">HD</SelectItem>
                    <SelectItem value="4K">4K</SelectItem>
                    <SelectItem value="Square">2K Sq</SelectItem>
                    <SelectItem value="8K">8K</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          )}

          {anim.enabled && (
            <SettingsSection title="Export" defaultOpen>
              <SettingsRow label="Resolution">
                <Select value={exportRes} onValueChange={setExportRes}>
                  <SelectTrigger className="h-7 text-xs w-20 bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HD">HD</SelectItem>
                    <SelectItem value="4K">4K</SelectItem>
                    <SelectItem value="Square">2K Sq</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          )}
        </div>

        {/* Bottom */}
        <div className="p-3 border-t border-border/40 space-y-1.5">
          {!anim.enabled && (
            <button onClick={handleCopyCSS} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground rounded-sm border border-border/30 transition-colors flex items-center justify-center gap-1 font-mono">
              <Copy className="h-2.5 w-2.5" /> Copy CSS
            </button>
          )}
          {anim.enabled ? (
            <Button onClick={handleAnimExport} disabled={exporting} className="w-full h-8 text-xs">
              {exporting ? (
                <>Rendering… {exportProgress}%</>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1.5" />
                  Export {anim.exportFormat === "gif" ? "GIF" : "Video"}
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleExport} disabled={exporting} className="w-full h-8 text-xs">
              <Download className="h-3 w-3 mr-1.5" />
              {exporting ? "Rendering…" : "Download"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
