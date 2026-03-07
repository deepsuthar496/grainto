import { useEffect, useRef, useState, useCallback } from "react";
import { generateNoise, type NoiseConfig } from "@/lib/noise";
import { downloadCanvas, RESOLUTION_PRESETS } from "@/lib/export-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Shuffle, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { toast } from "sonner";
import {
  SettingsSection,
  SettingsRow,
  InlineSlider,
  SettingsCheckbox,
  FormatTabs,
} from "./shared";

const PREVIEW_SIZE = 512;

const NOISE_PRESETS: { name: string; config: NoiseConfig }[] = [
  {
    name: "Film Grain",
    config: { type: "film", scale: 30, intensity: 60, contrast: 55, colorMode: "mono", tintColor: "#ff8844", seed: 42 },
  },
  {
    name: "Digital",
    config: { type: "fine", scale: 65, intensity: 50, contrast: 45, colorMode: "mono", tintColor: "#ff8844", seed: 123 },
  },
  {
    name: "Texture",
    config: { type: "rough", scale: 35, intensity: 55, contrast: 65, colorMode: "mono", tintColor: "#ff8844", seed: 456 },
  },
];

const DEFAULT_CONFIG: NoiseConfig = {
  type: "film",
  scale: 50,
  intensity: 50,
  contrast: 50,
  colorMode: "mono",
  tintColor: "#ff8844",
  seed: Math.floor(Math.random() * 10000),
};

export function NoiseGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<NoiseConfig>({ ...DEFAULT_CONFIG });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [exportRes, setExportRes] = useState("HD");
  const [transparentBg, setTransparentBg] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    generateNoise(canvasRef.current, config, PREVIEW_SIZE, PREVIEW_SIZE);
  }, [config]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = RESOLUTION_PRESETS[exportRes] || RESOLUTION_PRESETS.HD;
      const offscreen = document.createElement("canvas");
      generateNoise(offscreen, config, res.width, res.height, transparentBg);
      await downloadCanvas(offscreen, exportFormat, `grainto-noise-${config.type}-${Date.now()}`);
      toast.success("Noise texture downloaded!");
    } catch {
      toast.error("Export failed. Try a smaller resolution.");
    } finally {
      setExporting(false);
    }
  }, [config, exportFormat, exportRes, transparentBg]);

  const randomizeSeed = () =>
    setConfig((c) => ({ ...c, seed: Math.floor(Math.random() * 100000) }));
  const resetConfig = () =>
    setConfig({ ...DEFAULT_CONFIG, seed: Math.floor(Math.random() * 10000) });
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const update = <K extends keyof NoiseConfig>(key: K, value: NoiseConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="flex h-full">
      {/* Canvas Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none relative"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas
            ref={canvasRef}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            className="rounded-sm border border-border/20"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              imageRendering: zoom > 2 ? "pixelated" : "auto",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          />
        </div>

        {/* Zoom Bar */}
        <ZoomBar zoom={zoom} setZoom={setZoom} resetZoom={resetZoom} />
      </div>

      {/* Settings Panel */}
      <div className="w-[280px] border-l border-border/40 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <SettingsSection title="Settings" onReset={resetConfig} defaultOpen>
            <SettingsRow label="Type">
              <Select value={config.type} onValueChange={(v) => update("type", v as NoiseConfig["type"])}>
                <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="film">Film Grain</SelectItem>
                  <SelectItem value="fine">Fine Noise</SelectItem>
                  <SelectItem value="rough">Rough Texture</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Presets */}
            <div className="px-4 py-1.5">
              <div className="flex gap-1 flex-wrap">
                {NOISE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setConfig({ ...p.config })}
                    className="px-2 py-0.5 text-[10px] text-muted-foreground/60 hover:text-foreground border border-border/30 rounded-sm transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Adjustments" defaultOpen>
            <InlineSlider label="Scale" value={config.scale} min={1} max={100} onChange={(v) => update("scale", v)} onReset={() => update("scale", 50)} />
            <InlineSlider label="Intensity" value={config.intensity} min={0} max={100} onChange={(v) => update("intensity", v)} onReset={() => update("intensity", 50)} />
            <InlineSlider label="Contrast" value={config.contrast} min={0} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 50)} />
          </SettingsSection>

          <SettingsSection title="Color" defaultOpen>
            <SettingsRow label="Mode">
              <div className="flex gap-px">
                {(["mono", "tinted"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => update("colorMode", mode)}
                    className={`px-2 py-0.5 text-[10px] capitalize transition-colors ${
                      config.colorMode === mode
                        ? "text-foreground"
                        : "text-muted-foreground/40 hover:text-muted-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </SettingsRow>
            {config.colorMode === "tinted" && (
              <SettingsRow label="Tint">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.tintColor}
                    onChange={(e) => update("tintColor", e.target.value)}
                    className="w-5 h-5 rounded-sm cursor-pointer bg-transparent border border-border/40"
                  />
                  <span className="text-[10px] text-muted-foreground/50 font-mono uppercase">
                    {config.tintColor}
                  </span>
                </div>
              </SettingsRow>
            )}
          </SettingsSection>

          <SettingsSection title="Seed" defaultOpen>
            <div className="px-4 py-1 flex gap-2">
              <input
                type="number"
                value={config.seed}
                onChange={(e) => update("seed", parseInt(e.target.value) || 0)}
                className="flex-1 h-7 px-2 text-xs rounded-sm bg-transparent border border-border/40 text-foreground focus:outline-none focus:border-foreground/30 font-mono"
              />
              <button onClick={randomizeSeed} className="h-7 w-7 flex items-center justify-center rounded-sm border border-border/40 hover:border-foreground/30 transition-colors">
                <Shuffle className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </SettingsSection>

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
            <SettingsCheckbox
              label="Transparent"
              checked={transparentBg}
              onChange={setTransparentBg}
            />
          </SettingsSection>
        </div>

        {/* Download */}
        <div className="p-3 border-t border-border/40">
          <Button onClick={handleExport} disabled={exporting} className="w-full h-8 text-xs">
            <Download className="h-3 w-3 mr-1.5" />
            {exporting ? "Rendering…" : "Download"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Zoom Bar (shared pattern) ──────────────── */

export function ZoomBar({
  zoom,
  setZoom,
  resetZoom,
}: {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  resetZoom: () => void;
}) {
  return (
    <div className="h-8 border-t border-border/40 flex items-center justify-center gap-3 px-4 shrink-0">
      <button onClick={() => setZoom((z) => Math.max(0.25, z * 0.8))} className="text-muted-foreground/50 hover:text-foreground transition-colors">
        <ZoomOut className="h-3 w-3" />
      </button>
      <span className="text-[10px] text-muted-foreground/50 tabular-nums w-10 text-center font-mono">
        {Math.round(zoom * 100)}%
      </span>
      <button onClick={() => setZoom((z) => Math.min(8, z * 1.25))} className="text-muted-foreground/50 hover:text-foreground transition-colors">
        <ZoomIn className="h-3 w-3" />
      </button>
      <div className="w-px h-3 bg-border/40 mx-0.5" />
      <button onClick={resetZoom} className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors flex items-center gap-1">
        Reset {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}
