import { useState, useRef, useCallback, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, Play, Box, Video, Pause } from "lucide-react";
import { downloadCanvas, RESOLUTION_PRESETS } from "@/lib/export-utils";
import { exportAnimation } from "@/lib/animation-export";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ZoomBar } from "./NoiseGenerator";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  SettingsSection,
  SettingsRow,
  InlineSlider,
  SettingsCheckbox,
  FormatTabs,
} from "./shared";
import {
  ModelAsciiViewer,
  DEFAULT_MODEL_ANIM,
  type ModelAnimSettings,
  type ModelAnimMode,
} from "./ModelAsciiViewer";
import {
  renderDithering, renderMatrixRain, renderDots, renderContour, renderPixelSort, renderBlockify,
  renderThreshold, renderEdgeDetection, renderCrosshatch, renderWaveLines, renderNoiseField, renderVoronoi, renderVHS,
  DEFAULT_DITHERING, DEFAULT_MATRIX_RAIN, DEFAULT_DOTS, DEFAULT_CONTOUR, DEFAULT_PIXEL_SORT, DEFAULT_BLOCKIFY,
  DEFAULT_THRESHOLD, DEFAULT_EDGE_DETECTION, DEFAULT_CROSSHATCH, DEFAULT_WAVE_LINES, DEFAULT_NOISE_FIELD, DEFAULT_VORONOI, DEFAULT_VHS,
  type DitheringSettings, type MatrixRainSettings, type DotsSettings, type ContourSettings, type PixelSortSettings, type BlockifySettings,
  type ThresholdSettings, type EdgeDetectionSettings, type CrosshatchSettings, type WaveLinesSettings, type NoiseFieldSettings, type VoronoiSettings, type VHSSettings,
} from "./effect-renderers";

type EffectType = "ascii" | "glitch" | "halftone" | "dithering" | "matrix-rain" | "dots" | "contour" | "pixel-sort" | "blockify" | "threshold" | "edge-detection" | "crosshatch" | "wave-lines" | "noise-field" | "voronoi" | "vhs";

interface AdjustmentsSettings {
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
}
const DEFAULT_ADJUSTMENTS: AdjustmentsSettings = { brightness: 100, contrast: 100, hue: 0, saturation: 100 };

type InputSource = "image" | "video" | "model";

interface AsciiSettings {
  cellSize: number;
  invert: boolean;
  colorMode: boolean;
  characterRotation: boolean;
  charset: "standard" | "blocks" | "minimal" | "detailed" | "custom";
  customChars: string;
}

interface GlitchSettings {
  intensity: number;
  sliceCount: number;
  colorShift: number;
  scanlines: boolean;
  rgbSplit: boolean;
  corruption: number;
}

interface HalftoneSettings {
  dotSize: number;
  spacing: number;
  angle: number;
  shape: "circle" | "square" | "diamond" | "line";
  colorMode: boolean;
  contrast: number;
}

type AsciiAnimMode = "wave" | "matrix" | "flicker" | "scramble";

interface AsciiAnimSettings {
  enabled: boolean;
  mode: AsciiAnimMode;
  speed: number;
  intensity: number;
  duration: number;
  fps: number;
  exportFormat: "gif" | "webm";
}

const DEFAULT_ASCII: AsciiSettings = {
  cellSize: 11, invert: false, colorMode: true, characterRotation: false, charset: "standard", customChars: ""
};

const DEFAULT_GLITCH: GlitchSettings = {
  intensity: 50, sliceCount: 15, colorShift: 8, scanlines: true, rgbSplit: true, corruption: 20
};

const DEFAULT_HALFTONE: HalftoneSettings = {
  dotSize: 6, spacing: 8, angle: 45, shape: "circle", colorMode: false, contrast: 50
};

const DEFAULT_ASCII_ANIM: AsciiAnimSettings = {
  enabled: false,
  mode: "wave",
  speed: 50,
  intensity: 50,
  duration: 3,
  fps: 24,
  exportFormat: "webm",
};

const CHARSETS: Record<string, string> = {
  standard: " .:-=+*%@#",
  blocks: " ░▒▓█",
  minimal: " .-:+",
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
};

const MAX_PREVIEW_SIZE = 512;

export function EffectsGenerator() {
  const [effectType, setEffectType] = useState<EffectType>("ascii");
  const [inputSource, setInputSource] = useState<InputSource>("image");
  const [ascii, setAscii] = useState<AsciiSettings>({ ...DEFAULT_ASCII });
  const [glitch, setGlitch] = useState<GlitchSettings>({ ...DEFAULT_GLITCH });
  const [halftone, setHalftone] = useState<HalftoneSettings>({ ...DEFAULT_HALFTONE });
  const [dithering, setDithering] = useState<DitheringSettings>({ ...DEFAULT_DITHERING });
  const [matrixRain, setMatrixRain] = useState<MatrixRainSettings>({ ...DEFAULT_MATRIX_RAIN });
  const [dots, setDots] = useState<DotsSettings>({ ...DEFAULT_DOTS });
  const [contour, setContour] = useState<ContourSettings>({ ...DEFAULT_CONTOUR });
  const [pixelSort, setPixelSort] = useState<PixelSortSettings>({ ...DEFAULT_PIXEL_SORT });
  const [blockify, setBlockify] = useState<BlockifySettings>({ ...DEFAULT_BLOCKIFY });
  const [threshold, setThreshold] = useState<ThresholdSettings>({ ...DEFAULT_THRESHOLD });
  const [edgeDetection, setEdgeDetection] = useState<EdgeDetectionSettings>({ ...DEFAULT_EDGE_DETECTION });
  const [crosshatch, setCrosshatch] = useState<CrosshatchSettings>({ ...DEFAULT_CROSSHATCH });
  const [waveLines, setWaveLines] = useState<WaveLinesSettings>({ ...DEFAULT_WAVE_LINES });
  const [noiseField, setNoiseField] = useState<NoiseFieldSettings>({ ...DEFAULT_NOISE_FIELD });
  const [voronoi, setVoronoi] = useState<VoronoiSettings>({ ...DEFAULT_VORONOI });
  const [vhs, setVhs] = useState<VHSSettings>({ ...DEFAULT_VHS });
  const [adjustments, setAdjustments] = useState<AdjustmentsSettings>({ ...DEFAULT_ADJUSTMENTS });
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const getPreviewSize = useCallback(() => {
    let aspect = 1;
    if (crop && crop.width > 0 && crop.height > 0) {
      if (isImageMode && image) {
        aspect = (crop.width * image.width) / (crop.height * image.height);
      } else if (isVideoMode && videoRef.current) {
        aspect = (crop.width * videoRef.current.videoWidth) / (crop.height * videoRef.current.videoHeight);
      }
    } else if (isImageMode && image) {
      aspect = image.width / image.height;
    } else if (isVideoMode && videoRef.current) {
      aspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
    }

    let width = MAX_PREVIEW_SIZE;
    let height = MAX_PREVIEW_SIZE;

    if (aspect > 1) {
      height = MAX_PREVIEW_SIZE / aspect;
    } else {
      width = MAX_PREVIEW_SIZE * aspect;
    }

    return { width, height, aspect };
  }, [isImageMode, image, isVideoMode, crop]);

  const [asciiAnim, setAsciiAnim] = useState<AsciiAnimSettings>({ ...DEFAULT_ASCII_ANIM });
  const [modelAnim, setModelAnim] = useState<ModelAnimSettings>({ ...DEFAULT_MODEL_ANIM });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelFileName, setModelFileName] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [exportRes, setExportRes] = useState("HD");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [modelCapturing, setModelCapturing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const asciiCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const animStartRef = useRef(0);
  const modelFrameRef = useRef<HTMLCanvasElement | null>(null);

  const renderScale = Math.max(1, Math.min(Math.ceil(zoom), 4));

  const isImageMode = inputSource === "image";
  const isVideoMode = inputSource === "video";
  const isModelMode = inputSource === "model";
  const hasInput = isImageMode ? !!image : isVideoMode ? !!videoUrl : !!modelUrl;
  const isAnimating = effectType === "ascii" && isImageMode && asciiAnim.enabled && hasInput;

  // Shared effect application helper
  const applyCurrentEffect = useCallback((ctx: CanvasRenderingContext2D, imageData: ImageData, scale = 1) => {
    if (effectType === "ascii") renderAscii(ctx, imageData, { ...ascii, cellSize: ascii.cellSize * scale });
    else if (effectType === "glitch") renderGlitch(ctx, imageData, glitch);
    else if (effectType === "halftone") renderHalftone(ctx, imageData, { ...halftone, dotSize: halftone.dotSize * scale, spacing: halftone.spacing * scale });
    else if (effectType === "dithering") renderDithering(ctx, imageData, dithering);
    else if (effectType === "matrix-rain") renderMatrixRain(ctx, imageData, matrixRain);
    else if (effectType === "dots") renderDots(ctx, imageData, { ...dots, dotSize: dots.dotSize * scale, spacing: dots.spacing * scale });
    else if (effectType === "contour") renderContour(ctx, imageData, contour);
    else if (effectType === "pixel-sort") renderPixelSort(ctx, imageData, pixelSort);
    else if (effectType === "blockify") renderBlockify(ctx, imageData, { ...blockify, blockSize: blockify.blockSize * scale });
    else if (effectType === "threshold") renderThreshold(ctx, imageData, threshold);
    else if (effectType === "edge-detection") renderEdgeDetection(ctx, imageData, edgeDetection);
    else if (effectType === "crosshatch") renderCrosshatch(ctx, imageData, crosshatch);
    else if (effectType === "wave-lines") renderWaveLines(ctx, imageData, waveLines);
    else if (effectType === "noise-field") renderNoiseField(ctx, imageData, noiseField);
    else if (effectType === "voronoi") renderVoronoi(ctx, imageData, voronoi);
    else if (effectType === "vhs") renderVHS(ctx, imageData, vhs);
  }, [effectType, ascii, glitch, halftone, dithering, matrixRain, dots, contour, pixelSort, blockify, threshold, edgeDetection, crosshatch, waveLines, noiseField, voronoi, vhs]);

  // Model frame capture callback
  const handleModelFrame = useCallback((glCanvas: HTMLCanvasElement) => {
    modelFrameRef.current = glCanvas;
  }, []);

  // Render effects from model frames continuously (ALL effects, not just ASCII)
  useEffect(() => {
    if (!isModelMode || !modelUrl) return;
    const asciiCanvas = asciiCanvasRef.current;
    if (!asciiCanvas) return;

    const { width: canvasWidth, height: canvasHeight } = getPreviewSize();
    asciiCanvas.width = canvasWidth;
    asciiCanvas.height = canvasHeight;

    let running = true;
    const loop = () => {
      if (!running || !modelFrameRef.current) {
        if (running) requestAnimationFrame(loop);
        return;
      }

      const ctx = asciiCanvas.getContext("2d")!;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;

      ctx.drawImage(modelFrameRef.current, 0, 0, canvasWidth, canvasHeight);

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

      if (effectType === "ascii" && modelAnim.enabled) {
        const elapsed = performance.now() - animStartRef.current;
        const cycleDuration = (101 - modelAnim.speed) * 80;
        const progress = (elapsed % cycleDuration) / cycleDuration;
        renderAsciiAnimated(ctx, imageData, ascii, {
          enabled: true,
          mode: asciiAnim.mode,
          speed: asciiAnim.speed,
          intensity: asciiAnim.intensity,
          duration: asciiAnim.duration,
          fps: asciiAnim.fps,
          exportFormat: asciiAnim.exportFormat,
        }, progress);
      } else {
        applyCurrentEffect(ctx, imageData);
      }

      if (running) requestAnimationFrame(loop);
    };

    animStartRef.current = performance.now();
    setModelCapturing(true);
    requestAnimationFrame(loop);

    return () => {
      running = false;
      setModelCapturing(false);
    };
  }, [isModelMode, modelUrl, effectType, applyCurrentEffect, ascii, modelAnim, asciiAnim, getPreviewSize, adjustments.brightness, adjustments.contrast, adjustments.hue, adjustments.saturation]);

  // Video frame rendering loop
  useEffect(() => {
    if (!isVideoMode || !videoUrl) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const { width: canvasWidth, height: canvasHeight } = getPreviewSize();
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    let running = true;
    const loop = () => {
      if (!running || video.paused && video.currentTime === 0) {
        if (running) requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext("2d")!;

      // Video aspect ratio
      const scaleX = canvasWidth / video.videoWidth;
      const scaleY = canvasHeight / video.videoHeight;
      const scale = Math.min(scaleX, scaleY);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      const ox = (canvasWidth - w) / 2;
      const oy = (canvasHeight - h) / 2;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;

      if (crop && crop.width > 0 && crop.height > 0) {
        const cropX = (crop.x / 100) * video.videoWidth;
        const cropY = (crop.y / 100) * video.videoHeight;
        const cropW = (crop.width / 100) * video.videoWidth;
        const cropH = (crop.height / 100) * video.videoHeight;
        ctx.drawImage(video, cropX, cropY, cropW, cropH, ox, oy, w, h);
    ctx.filter = 'none';
      } else {
        ctx.drawImage(video, ox, oy, w, h);
    ctx.filter = 'none';
      }

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      applyCurrentEffect(ctx, imageData);

      if (running) requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => { running = false; };
  }, [isVideoMode, videoUrl, applyCurrentEffect, getPreviewSize, crop, adjustments.brightness, adjustments.contrast, adjustments.hue, adjustments.saturation]);

  // Static render for image mode
  useEffect(() => {
    if (!canvasRef.current || !image || isAnimating || isModelMode || isVideoMode) return;
    const canvas = canvasRef.current;
    const previewSize = getPreviewSize(); const canvasWidth = previewSize.width * renderScale; const canvasHeight = previewSize.height * renderScale;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d")!;


    const scaleX = canvasWidth / image.width;
    const scaleY = canvasHeight / image.height;
    const scale = Math.min(scaleX, scaleY);
    const w = image.width * scale;
    const h = image.height * scale;
    const ox = (canvasWidth - w) / 2;
    const oy = (canvasHeight - h) / 2;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;

    if (crop && crop.width > 0 && crop.height > 0) {
      const cropX = (crop.x / 100) * image.width;
      const cropY = (crop.y / 100) * image.height;
      const cropW = (crop.width / 100) * image.width;
      const cropH = (crop.height / 100) * image.height;
      ctx.drawImage(image, cropX, cropY, cropW, cropH, ox, oy, w, h);
    ctx.filter = 'none';
    } else {
      ctx.drawImage(image, ox, oy, w, h);
    ctx.filter = 'none';
    }

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    applyCurrentEffect(ctx, imageData, renderScale);
  }, [image, applyCurrentEffect, renderScale, isAnimating, isModelMode, isVideoMode, getPreviewSize, crop, adjustments.brightness, adjustments.contrast, adjustments.hue, adjustments.saturation]);

  // Animation loop for ASCII (image mode)
  useEffect(() => {
    if (!canvasRef.current || !image || !isAnimating || isModelMode) return;
    const canvas = canvasRef.current;
    const previewSize = getPreviewSize(); const canvasWidth = previewSize.width * renderScale; const canvasHeight = previewSize.height * renderScale;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    animStartRef.current = performance.now();
    const cycleDuration = (101 - asciiAnim.speed) * 80;

    const loop = () => {
      const ctx = canvas.getContext("2d")!;
      const elapsed = performance.now() - animStartRef.current;
      const progress = (elapsed % cycleDuration) / cycleDuration;


    const scaleX = canvasWidth / image.width;
    const scaleY = canvasHeight / image.height;
    const scale = Math.min(scaleX, scaleY);
      const w = image.width * scale;
      const h = image.height * scale;
      const ox = (canvasWidth - w) / 2;
      const oy = (canvasHeight - h) / 2;

      ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;

    if (crop && crop.width > 0 && crop.height > 0) {
      const cropX = (crop.x / 100) * image.width;
      const cropY = (crop.y / 100) * image.height;
      const cropW = (crop.width / 100) * image.width;
      const cropH = (crop.height / 100) * image.height;
      ctx.drawImage(image, cropX, cropY, cropW, cropH, ox, oy, w, h);
    ctx.filter = 'none';
    } else {
      ctx.drawImage(image, ox, oy, w, h);
    ctx.filter = 'none';
    }
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

      renderAsciiAnimated(ctx, imageData, { ...ascii, cellSize: ascii.cellSize * renderScale }, asciiAnim, progress);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [image, ascii, asciiAnim, renderScale, isAnimating, isModelMode, getPreviewSize, crop, adjustments.brightness, adjustments.contrast, adjustments.hue, adjustments.saturation]);

  const handleFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    // Auto-detect and route video files even if uploaded through image input
    if (file.type.startsWith("video/") || ["mp4", "webm", "mov", "avi"].includes(ext || "")) {
      setInputSource("video");
      handleVideoFile(file);
      return;
    }
    // Auto-detect and route 3D model files
    if (["glb", "gltf"].includes(ext || "")) {
      setInputSource("model");
      handleModelFile(file);
      return;
    }
    if (!file.type.startsWith("image/")) { toast.error("Unsupported file type"); return; }
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  };

  const handleModelFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["glb", "gltf"].includes(ext || "")) {
      toast.error("Please upload a .glb or .gltf file");
      return;
    }
    // Revoke old URL
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    const url = URL.createObjectURL(file);
    setModelUrl(url);
    setModelFileName(file.name);
    toast.success(`Loaded: ${file.name}`);
  };

  const handleVideoFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoFileName(file.name);
    setIsPlaying(false);
    toast.success(`Loaded: ${file.name}`);
    // Auto-load first frame after video metadata loads
    setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
      }
    }, 100);
  };

  const toggleVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (["glb", "gltf"].includes(ext || "")) {
      setInputSource("model");
      handleModelFile(file);
    } else if (file.type.startsWith("video/") || ["mp4", "webm", "mov", "avi"].includes(ext || "")) {
      setInputSource("video");
      handleVideoFile(file);
    } else if (file.type.startsWith("image/")) {
      setInputSource("image");
      handleFile(file);
    } else {
      toast.error("Unsupported file type. Use images, videos, or .glb/.gltf models.");
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isModelMode) return; // OrbitControls handles this
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan, isModelMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || isModelMode) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [isDragging, isModelMode]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleExport = useCallback(async () => {
    // Works for image and video (captures current frame)
    const source = isVideoMode ? videoRef.current : image;
    if (!source) return;
    setExporting(true);
    try {
      const res = RESOLUTION_PRESETS[exportRes] || RESOLUTION_PRESETS.HD;
      const offscreen = document.createElement("canvas");
      const srcW = isVideoMode ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).width;
      const srcH = isVideoMode ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).height;

      let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;
      if (crop && crop.width > 0 && crop.height > 0) {
        cropX = (crop.x / 100) * srcW;
        cropY = (crop.y / 100) * srcH;
        cropW = (crop.width / 100) * srcW;
        cropH = (crop.height / 100) * srcH;
      }

      // Compute the aspect ratio of what we are exporting
      const aspect = cropW / cropH;
      // Adjust export canvas size to match the crop aspect ratio, bounded by the selected preset max dimension
      const maxDim = Math.max(res.width, res.height);
      let outW = maxDim;
      let outH = maxDim;
      if (aspect > 1) {
        outH = maxDim / aspect;
      } else {
        outW = maxDim * aspect;
      }

      offscreen.width = outW;
      offscreen.height = outH;
      const offCtx = offscreen.getContext("2d")!;

      offCtx.fillStyle = "#0a0a0a";
      offCtx.fillRect(0, 0, outW, outH);
      offCtx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;

      if (crop && crop.width > 0 && crop.height > 0) {
        offCtx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
      } else {
        offCtx.drawImage(source, 0, 0, outW, outH);
      }
      offCtx.filter = 'none';
      const imgData = offCtx.getImageData(0, 0, outW, outH);
      applyCurrentEffect(offCtx, imgData);
      await downloadCanvas(offscreen, exportFormat, `grainto-${effectType}-${Date.now()}`);
      toast.success("Effect exported!");
    } catch {
      toast.error("Export failed. Try a smaller resolution.");
    } finally {
      setExporting(false);
    }
  }, [effectType, image, isVideoMode, exportFormat, exportRes, applyCurrentEffect, crop, adjustments]);

  const handleAnimExport = useCallback(async () => {
    if (!image) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const preset = RESOLUTION_PRESETS[exportRes] || RESOLUTION_PRESETS.HD;
      const srcW = image.width;
      const srcH = image.height;
      let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;
      if (crop && crop.width > 0 && crop.height > 0) {
        cropX = (crop.x / 100) * srcW;
        cropY = (crop.y / 100) * srcH;
        cropW = (crop.width / 100) * srcW;
        cropH = (crop.height / 100) * srcH;
      }

      const aspect = cropW / cropH;
      const maxDim = Math.max(preset.width, preset.height);
      let outW = maxDim;
      let outH = maxDim;
      if (aspect > 1) {
        outH = maxDim / aspect;
      } else {
        outW = maxDim * aspect;
      }

      await exportAnimation(
        { width: outW, height: outH, fps: asciiAnim.fps, duration: asciiAnim.duration, format: asciiAnim.exportFormat },
        (canvas, ctx, progress) => {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, outW, outH);
          ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;
          if (crop && crop.width > 0 && crop.height > 0) {
            ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
          } else {
            ctx.drawImage(image, 0, 0, outW, outH);
          }
          ctx.filter = 'none';
          const imageData = ctx.getImageData(0, 0, outW, outH);
          renderAsciiAnimated(ctx, imageData, ascii, asciiAnim, progress);
        },
        (pct) => setExportProgress(Math.round(pct))
      );
      toast.success(`Animation exported as ${asciiAnim.exportFormat.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      toast.error("Animation export failed.");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [image, ascii, asciiAnim, exportRes, crop, adjustments]);

  // Export for 3D model animation (all effects)
  const handleModelAnimExport = useCallback(async () => {
    if (!modelUrl || !modelFrameRef.current) {
      toast.error("No model loaded or no frame captured yet.");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    try {
      const res = RESOLUTION_PRESETS[exportRes] || RESOLUTION_PRESETS.HD;
      const fmt = modelAnim.exportFormat;

      await exportAnimation(
        {
          width: res.width,
          height: res.height,
          fps: modelAnim.fps,
          duration: modelAnim.duration,
          format: fmt,
        },
        (canvas, ctx) => {
          if (modelFrameRef.current) {
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, res.width, res.height);
            ctx.drawImage(modelFrameRef.current, 0, 0, res.width, res.height);
            const imageData = ctx.getImageData(0, 0, res.width, res.height);
            applyCurrentEffect(ctx, imageData);
          }
        },
        (pct) => setExportProgress(Math.round(pct))
      );
      toast.success(`Model animation exported as ${fmt.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      toast.error("Model animation export failed.");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [modelUrl, applyCurrentEffect, modelAnim, exportRes]);

  // Determine which export button to show
  const showModelExport = isModelMode && !!modelUrl;
  const showImageAnimExport = isImageMode && effectType === "ascii" && asciiAnim.enabled;
  const showVideoMode = isVideoMode && !!videoUrl;
  const showStaticExport = !showModelExport && !showImageAnimExport && !showVideoMode;

  return (
    <div className="flex h-full">
      {/* Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="flex-1 flex items-center justify-center overflow-hidden select-none relative"
          style={{ cursor: hasInput && isImageMode ? isDragging ? "grabbing" : "grab" : "default" }}
          onWheel={isImageMode ? handleWheel : undefined}
          onMouseDown={hasInput && isImageMode ? handleMouseDown : undefined}
          onMouseMove={hasInput && isImageMode ? handleMouseMove : undefined}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {!hasInput ? (
            <button
              onClick={() => isModelMode ? modelInputRef.current?.click() : isVideoMode ? videoInputRef.current?.click() : fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 border border-dashed rounded-sm w-72 h-56 transition-colors cursor-pointer ${
                dragOver ? "border-foreground/30 bg-foreground/[0.02]" : "border-border/30 hover:border-border/50"
              }`}
            >
              <span className="text-sm text-muted-foreground/40">
                {isModelMode ? "Drop 3D model" : isVideoMode ? "Drop video file" : "Awaiting input"}
              </span>
              <span className="text-[11px] text-muted-foreground/25">
                {isModelMode ? "Supports .glb and .gltf files" : isVideoMode ? "Supports .mp4, .webm, .mov files" : "Drop a file or select a source"}
              </span>
            </button>
          ) : isModelMode && modelUrl ? (
            <div className="relative" style={{ width: getPreviewSize().width, height: getPreviewSize().height }}>
              {/* 3D Model Viewer (hidden, captures frames for effect processing) */}
              <div className="absolute inset-0" style={{ opacity: 0, pointerEvents: "none" }}>
                <ModelAsciiViewer
                  modelUrl={modelUrl}
                  animSettings={modelAnim}
                  onFrameCapture={handleModelFrame}
                  capturing={true}
                  size={getPreviewSize().width}
                />
              </div>
              {/* Effect overlay canvas */}
              <canvas
                ref={asciiCanvasRef}
                className="rounded-sm border border-border/20 block absolute inset-0"
                style={{ width: getPreviewSize().width, height: getPreviewSize().height }}
              />
            </div>
          ) : isVideoMode && videoUrl ? (
            <div className="relative" style={{ width: getPreviewSize().width, height: getPreviewSize().height }}>
              <video
                ref={videoRef}
                src={videoUrl}
                className="hidden"
                loop
                muted
                playsInline
                crossOrigin="anonymous"
                onLoadedData={() => {
                  // Draw first frame
                  const video = videoRef.current;
                  const canvas = canvasRef.current;
                  if (!video || !canvas) return;
                  canvas.width = getPreviewSize().width;
                  canvas.height = getPreviewSize().height;
                  const ctx = canvas.getContext("2d")!;
                  const scale = Math.min(getPreviewSize().width / video.videoWidth, getPreviewSize().height / video.videoHeight);
                  const w = video.videoWidth * scale;
                  const h = video.videoHeight * scale;
                  ctx.fillStyle = "#0a0a0a";
                  ctx.fillRect(0, 0, getPreviewSize().width, getPreviewSize().height);
                  ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) hue-rotate(${adjustments.hue}deg) saturate(${adjustments.saturation}%)`;
                  if (crop && crop.width > 0 && crop.height > 0) {
                    const cropX = (crop.x / 100) * video.videoWidth;
                    const cropY = (crop.y / 100) * video.videoHeight;
                    const cropW = (crop.width / 100) * video.videoWidth;
                    const cropH = (crop.height / 100) * video.videoHeight;
                    ctx.drawImage(video, cropX, cropY, cropW, cropH, (getPreviewSize().width - w) / 2, (getPreviewSize().height - h) / 2, w, h);
                  ctx.filter = 'none';
                  } else {
                    ctx.drawImage(video, (getPreviewSize().width - w) / 2, (getPreviewSize().height - h) / 2, w, h);
                  ctx.filter = 'none';
                  }
                  const imageData = ctx.getImageData(0, 0, getPreviewSize().width, getPreviewSize().height);
                  applyCurrentEffect(ctx, imageData);
                }}
                onEnded={() => setIsPlaying(false)}
              />
              <canvas
                ref={canvasRef}
                className="rounded-sm border border-border/20 block"
                style={{ width: getPreviewSize().width, height: getPreviewSize().height }}
              />
              {/* Play/Pause overlay */}
              <button
                onClick={toggleVideoPlayback}
                className="absolute bottom-3 left-3 w-8 h-8 rounded-sm bg-background/80 border border-border/40 flex items-center justify-center hover:bg-background transition-colors"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="rounded-sm border border-border/20"
              style={{
                width: getPreviewSize().width,
                height: getPreviewSize().height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / renderScale})`,
                transition: isDragging ? "none" : "transform 0.1s ease-out",
              }}
            />
          )}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {(isImageMode || isVideoMode) && (image || videoUrl) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCropping(!isCropping)}
                className="bg-background/80 backdrop-blur-md border-border/40 hover:bg-background"
              >
                {isCropping ? "Finish Crop" : "Crop Source"}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
          />
          <input
            ref={modelInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleModelFile(e.target.files[0]); e.target.value = ""; }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleVideoFile(e.target.files[0]); e.target.value = ""; }}
          />
        </div>

        {isImageMode && <ZoomBar zoom={zoom} setZoom={setZoom} resetZoom={resetZoom} />}
      </div>

      {/* Settings Panel */}
      <div className="w-[280px] border-l border-border/40 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* Global Image Adjustments */}
          {(isImageMode || isVideoMode) && (
            <SettingsSection title="Image Adjustments" defaultOpen={false}>
              <InlineSlider label="Brightness" value={adjustments.brightness} min={0} max={200} onChange={(v) => setAdjustments(a => ({ ...a, brightness: v }))} onReset={() => setAdjustments(a => ({ ...a, brightness: 100 }))} />
              <InlineSlider label="Contrast" value={adjustments.contrast} min={0} max={200} onChange={(v) => setAdjustments(a => ({ ...a, contrast: v }))} onReset={() => setAdjustments(a => ({ ...a, contrast: 100 }))} />
              <InlineSlider label="Saturation" value={adjustments.saturation} min={0} max={200} onChange={(v) => setAdjustments(a => ({ ...a, saturation: v }))} onReset={() => setAdjustments(a => ({ ...a, saturation: 100 }))} />
              <InlineSlider label="Hue" value={adjustments.hue} min={-180} max={180} onChange={(v) => setAdjustments(a => ({ ...a, hue: v }))} onReset={() => setAdjustments(a => ({ ...a, hue: 0 }))} />
            </SettingsSection>
          )}

          {/* Settings depending on the type */}
{/* Effect Type */}
          <SettingsSection title="Settings" defaultOpen>
            <SettingsRow label="Effect">
              <Select value={effectType} onValueChange={(v) => setEffectType(v as EffectType)}>
                <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ascii">ASCII</SelectItem>
                  <SelectItem value="dithering">Dithering</SelectItem>
                  <SelectItem value="halftone">Halftone</SelectItem>
                  <SelectItem value="matrix-rain">Matrix Rain</SelectItem>
                  <SelectItem value="dots">Dots</SelectItem>
                  <SelectItem value="contour">Contour</SelectItem>
                  <SelectItem value="pixel-sort">Pixel Sort</SelectItem>
                  <SelectItem value="blockify">Blockify</SelectItem>
                  <SelectItem value="threshold">Threshold</SelectItem>
                  <SelectItem value="edge-detection">Edge Detection</SelectItem>
                  <SelectItem value="crosshatch">Crosshatch</SelectItem>
                  <SelectItem value="wave-lines">Wave Lines</SelectItem>
                  <SelectItem value="noise-field">Noise Field</SelectItem>
                  <SelectItem value="voronoi">Voronoi</SelectItem>
                  <SelectItem value="vhs">VHS</SelectItem>
                  <SelectItem value="glitch">Glitch</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>

          {effectType === "ascii" && <AsciiPanel settings={ascii} onChange={setAscii} />}
          {effectType === "glitch" && <GlitchPanel settings={glitch} onChange={setGlitch} />}
          {effectType === "halftone" && <HalftonePanel settings={halftone} onChange={setHalftone} />}
          {effectType === "dithering" && <DitheringPanel settings={dithering} onChange={setDithering} />}
          {effectType === "matrix-rain" && <MatrixRainPanel settings={matrixRain} onChange={setMatrixRain} />}
          {effectType === "dots" && <DotsPanel settings={dots} onChange={setDots} />}
          {effectType === "contour" && <ContourPanel settings={contour} onChange={setContour} />}
          {effectType === "pixel-sort" && <PixelSortPanel settings={pixelSort} onChange={setPixelSort} />}
          {effectType === "blockify" && <BlockifyPanel settings={blockify} onChange={setBlockify} />}
          {effectType === "threshold" && <ThresholdPanel settings={threshold} onChange={setThreshold} />}
          {effectType === "edge-detection" && <EdgeDetectionPanel settings={edgeDetection} onChange={setEdgeDetection} />}
          {effectType === "crosshatch" && <CrosshatchPanel settings={crosshatch} onChange={setCrosshatch} />}
          {effectType === "wave-lines" && <WaveLinesPanel settings={waveLines} onChange={setWaveLines} />}
          {effectType === "noise-field" && <NoiseFieldPanel settings={noiseField} onChange={setNoiseField} />}
          {effectType === "voronoi" && <VoronoiPanel settings={voronoi} onChange={setVoronoi} />}
          {effectType === "vhs" && <VHSPanel settings={vhs} onChange={setVhs} />}

          {/* ASCII Animation Section (image mode) */}
          {effectType === "ascii" && isImageMode && (
            <SettingsSection title="Animation" defaultOpen>
              <SettingsCheckbox
                label="Enable Animation"
                checked={asciiAnim.enabled}
                onChange={(v) => setAsciiAnim((a) => ({ ...a, enabled: v }))}
              />
              {asciiAnim.enabled && (
                <>
                  <SettingsRow label="Mode">
                    <Select value={asciiAnim.mode} onValueChange={(v) => setAsciiAnim((a) => ({ ...a, mode: v as AsciiAnimMode }))}>
                      <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wave">Wave</SelectItem>
                        <SelectItem value="matrix">Matrix</SelectItem>
                        <SelectItem value="flicker">Flicker</SelectItem>
                        <SelectItem value="scramble">Scramble</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingsRow>
                  <InlineSlider label="Speed" value={asciiAnim.speed} min={1} max={100} onChange={(v) => setAsciiAnim((a) => ({ ...a, speed: v }))} onReset={() => setAsciiAnim((a) => ({ ...a, speed: 50 }))} />
                  <InlineSlider label="Intensity" value={asciiAnim.intensity} min={1} max={100} onChange={(v) => setAsciiAnim((a) => ({ ...a, intensity: v }))} onReset={() => setAsciiAnim((a) => ({ ...a, intensity: 50 }))} />
                  <InlineSlider label="Duration" value={asciiAnim.duration} min={1} max={10} suffix="s" onChange={(v) => setAsciiAnim((a) => ({ ...a, duration: v }))} onReset={() => setAsciiAnim((a) => ({ ...a, duration: 3 }))} />
                  <InlineSlider label="FPS" value={asciiAnim.fps} min={10} max={60} onChange={(v) => setAsciiAnim((a) => ({ ...a, fps: v }))} onReset={() => setAsciiAnim((a) => ({ ...a, fps: 24 }))} />
                  <SettingsRow label="Format">
                    <div className="flex-1">
                      <FormatTabs
                        value={asciiAnim.exportFormat}
                        onChange={(v) => setAsciiAnim((a) => ({ ...a, exportFormat: v as "gif" | "webm" }))}
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
          )}

          {/* 3D Model Animation Section */}
          {isModelMode && modelUrl && (
            <SettingsSection title="Model Animation" defaultOpen>
              <SettingsCheckbox
                label="Enable Animation"
                checked={modelAnim.enabled}
                onChange={(v) => setModelAnim((a) => ({ ...a, enabled: v }))}
              />
              {modelAnim.enabled && (
                <>
                  <SettingsRow label="Mode">
                    <Select value={modelAnim.mode} onValueChange={(v) => setModelAnim((a) => ({ ...a, mode: v as ModelAnimMode }))}>
                      <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="turntable">Turntable</SelectItem>
                        <SelectItem value="bounce">Bounce</SelectItem>
                        <SelectItem value="swing">Swing</SelectItem>
                        <SelectItem value="float">Float</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingsRow>
                  <InlineSlider label="Speed" value={modelAnim.speed} min={1} max={100} onChange={(v) => setModelAnim((a) => ({ ...a, speed: v }))} onReset={() => setModelAnim((a) => ({ ...a, speed: 50 }))} />
                  <InlineSlider label="Intensity" value={modelAnim.intensity} min={1} max={100} onChange={(v) => setModelAnim((a) => ({ ...a, intensity: v }))} onReset={() => setModelAnim((a) => ({ ...a, intensity: 50 }))} />
                  <InlineSlider label="Duration" value={modelAnim.duration} min={1} max={10} suffix="s" onChange={(v) => setModelAnim((a) => ({ ...a, duration: v }))} onReset={() => setModelAnim((a) => ({ ...a, duration: 3 }))} />
                  <InlineSlider label="FPS" value={modelAnim.fps} min={10} max={60} onChange={(v) => setModelAnim((a) => ({ ...a, fps: v }))} onReset={() => setModelAnim((a) => ({ ...a, fps: 24 }))} />
                  <SettingsRow label="Format">
                    <div className="flex-1">
                      <FormatTabs
                        value={modelAnim.exportFormat}
                        onChange={(v) => setModelAnim((a) => ({ ...a, exportFormat: v as "gif" | "webm" }))}
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
          )}

          {/* Input Section */}
          <SettingsSection title="Input" defaultOpen>
            <SettingsRow label="Source">
              <div className="flex-1">
                <FormatTabs
                  value={inputSource}
                  onChange={(v) => setInputSource(v as InputSource)}
                  options={[
                    { value: "image", label: "Image" },
                    { value: "video", label: "Video" },
                    { value: "model", label: "3D" },
                  ]}
                />
              </div>
            </SettingsRow>
            <div className="px-4 py-1 space-y-1">
              {isImageMode ? (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1 text-[11px] text-muted-foreground/50 hover:text-foreground border border-dashed border-border/30 rounded-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload className="h-2.5 w-2.5" />
                    {image ? "Change image" : "Drop file or click to browse"}
                  </button>
                  {image && (
                    <button
                      onClick={() => setImage(null)}
                      className="w-full py-1 text-[10px] text-muted-foreground/30 hover:text-foreground transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </>
              ) : isVideoMode ? (
                <>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full py-1 text-[11px] text-muted-foreground/50 hover:text-foreground border border-dashed border-border/30 rounded-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Video className="h-2.5 w-2.5" />
                    {videoUrl ? "Change video" : "Upload .mp4, .webm, .mov"}
                  </button>
                  {videoUrl && (
                    <>
                      <p className="text-[10px] text-muted-foreground/40 text-center truncate">{videoFileName}</p>
                      <button
                        onClick={() => { if (videoUrl) URL.revokeObjectURL(videoUrl); setVideoUrl(null); setVideoFileName(""); setIsPlaying(false); }}
                        className="w-full py-1 text-[10px] text-muted-foreground/30 hover:text-foreground transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => modelInputRef.current?.click()}
                    className="w-full py-1 text-[11px] text-muted-foreground/50 hover:text-foreground border border-dashed border-border/30 rounded-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Box className="h-2.5 w-2.5" />
                    {modelUrl ? "Change model" : "Upload .glb or .gltf"}
                  </button>
                  {modelUrl && (
                    <>
                      <p className="text-[10px] text-muted-foreground/40 text-center truncate">{modelFileName}</p>
                      <button
                        onClick={() => { if (modelUrl) URL.revokeObjectURL(modelUrl); setModelUrl(null); setModelFileName(""); }}
                        className="w-full py-1 text-[10px] text-muted-foreground/30 hover:text-foreground transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </SettingsSection>

          {/* Export section */}
          {showStaticExport && (
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

          {(showImageAnimExport || showModelExport || showVideoMode) && (
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

        <div className="p-3 border-t border-border/40">
          {showModelExport ? (
            <Button onClick={handleModelAnimExport} disabled={exporting || !modelUrl} className="w-full h-8 text-xs">
              {exporting ? (
                <>Rendering… {exportProgress}%</>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1.5" />
                  Export {modelAnim.exportFormat === "gif" ? "GIF" : "Video"}
                </>
              )}
            </Button>
          ) : showImageAnimExport ? (
            <Button onClick={handleAnimExport} disabled={exporting || !image} className="w-full h-8 text-xs">
              {exporting ? (
                <>Rendering… {exportProgress}%</>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1.5" />
                  Export {asciiAnim.exportFormat === "gif" ? "GIF" : "Video"}
                </>
              )}
            </Button>
          ) : showVideoMode ? (
            <Button onClick={handleExport} disabled={exporting || !videoUrl} className="w-full h-8 text-xs">
              <Download className="h-3 w-3 mr-1.5" />
              {exporting ? "Rendering…" : "Export Frame"}
            </Button>
          ) : (
            <Button onClick={handleExport} disabled={exporting || !hasInput} className="w-full h-8 text-xs">
              <Download className="h-3 w-3 mr-1.5" />
              {exporting ? "Rendering…" : "Download"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Effect Panels ──────────────────────────── */

function AsciiPanel({ settings, onChange }: { settings: AsciiSettings; onChange: (s: AsciiSettings) => void }) {
  const update = <K extends keyof AsciiSettings>(key: K, value: AsciiSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <SettingsSection title="ASCII" defaultOpen>
      <SettingsRow label="Charset">
        <Select value={settings.charset} onValueChange={(v) => update("charset", v as AsciiSettings["charset"])}>
          <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="blocks">Blocks</SelectItem>
            <SelectItem value="minimal">Minimal</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      {settings.charset === "custom" && (
        <div className="px-4 py-1">
          <Input
            value={settings.customChars}
            onChange={(e) => update("customChars", e.target.value)}
            placeholder="e.g. @#%*+=-:. "
            className="h-7 text-xs font-mono bg-transparent border-border/40"
          />
          <p className="text-[9px] text-muted-foreground/30 mt-0.5">Dark → Light</p>
        </div>
      )}
      <InlineSlider label="Cell Size" value={settings.cellSize} min={4} max={24} onChange={(v) => update("cellSize", v)} onReset={() => update("cellSize", 11)} />
      <SettingsCheckbox label="Invert" checked={settings.invert} onChange={(v) => update("invert", v)} />
      <SettingsCheckbox label="Color" checked={settings.colorMode} onChange={(v) => update("colorMode", v)} />
      <SettingsCheckbox label="Rotation" checked={settings.characterRotation} onChange={(v) => update("characterRotation", v)} />
    </SettingsSection>
  );
}

function GlitchPanel({ settings, onChange }: { settings: GlitchSettings; onChange: (s: GlitchSettings) => void }) {
  const update = <K extends keyof GlitchSettings>(key: K, value: GlitchSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <SettingsSection title="Glitch" defaultOpen>
      <InlineSlider label="Intensity" value={settings.intensity} min={0} max={100} onChange={(v) => update("intensity", v)} onReset={() => update("intensity", 50)} />
      <InlineSlider label="Slices" value={settings.sliceCount} min={2} max={50} onChange={(v) => update("sliceCount", v)} onReset={() => update("sliceCount", 15)} />
      <InlineSlider label="Color Shift" value={settings.colorShift} min={0} max={50} onChange={(v) => update("colorShift", v)} onReset={() => update("colorShift", 8)} />
      <InlineSlider label="Corruption" value={settings.corruption} min={0} max={100} onChange={(v) => update("corruption", v)} onReset={() => update("corruption", 20)} />
      <SettingsCheckbox label="Scanlines" checked={settings.scanlines} onChange={(v) => update("scanlines", v)} />
      <SettingsCheckbox label="RGB Split" checked={settings.rgbSplit} onChange={(v) => update("rgbSplit", v)} />
    </SettingsSection>
  );
}

function HalftonePanel({ settings, onChange }: { settings: HalftoneSettings; onChange: (s: HalftoneSettings) => void }) {
  const update = <K extends keyof HalftoneSettings>(key: K, value: HalftoneSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <SettingsSection title="Halftone" defaultOpen>
      <InlineSlider label="Dot Size" value={settings.dotSize} min={2} max={20} onChange={(v) => update("dotSize", v)} onReset={() => update("dotSize", 6)} />
      <InlineSlider label="Spacing" value={settings.spacing} min={3} max={30} onChange={(v) => update("spacing", v)} onReset={() => update("spacing", 8)} />
      <InlineSlider label="Angle" value={settings.angle} min={0} max={180} suffix="°" onChange={(v) => update("angle", v)} onReset={() => update("angle", 45)} />
      <InlineSlider label="Contrast" value={settings.contrast} min={0} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 50)} />
      <SettingsRow label="Shape">
        <Select value={settings.shape} onValueChange={(v) => update("shape", v as HalftoneSettings["shape"])}>
          <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="diamond">Diamond</SelectItem>
            <SelectItem value="line">Line</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsCheckbox label="Color" checked={settings.colorMode} onChange={(v) => update("colorMode", v)} />
    </SettingsSection>
  );
}

function DitheringPanel({ settings, onChange }: { settings: DitheringSettings; onChange: (s: DitheringSettings) => void }) {
  const update = <K extends keyof DitheringSettings>(key: K, value: DitheringSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <SettingsSection title="Dithering" defaultOpen>
      <SettingsRow label="Algorithm">
        <Select value={settings.algorithm} onValueChange={(v) => update("algorithm", v as DitheringSettings["algorithm"])}>
          <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="floyd-steinberg">Floyd-Steinberg</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="atkinson">Atkinson</SelectItem>
            <SelectItem value="random">Random</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      <InlineSlider label="Threshold" value={settings.threshold} min={1} max={100} onChange={(v) => update("threshold", v)} onReset={() => update("threshold", 50)} />
      <SettingsCheckbox label="Color" checked={settings.colorMode} onChange={(v) => update("colorMode", v)} />
    </SettingsSection>
  );
}

function MatrixRainPanel({ settings, onChange }: { settings: MatrixRainSettings; onChange: (s: MatrixRainSettings) => void }) {
  const update = <K extends keyof MatrixRainSettings>(key: K, value: MatrixRainSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Matrix Rain" defaultOpen>
        <SettingsRow label="Character Set">
          <Select value={settings.charset} onValueChange={(v) => update("charset", v as MatrixRainSettings["charset"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">STANDARD</SelectItem>
              <SelectItem value="katakana">Katakana</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
              <SelectItem value="ascii">ASCII</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <InlineSlider label="Cell Size" value={settings.cellSize} min={4} max={24} onChange={(v) => update("cellSize", v)} onReset={() => update("cellSize", 10)} />
        <InlineSlider label="Spacing" value={settings.spacing} min={0} max={10} onChange={(v) => update("spacing", v)} onReset={() => update("spacing", 0)} />
        <InlineSlider label="Speed" value={settings.speed} min={1} max={100} onChange={(v) => update("speed", v)} onReset={() => update("speed", 50)} />
        <InlineSlider label="Trail Length" value={settings.trailLength} min={1} max={100} onChange={(v) => update("trailLength", v)} onReset={() => update("trailLength", 18)} />
        <SettingsRow label="Direction">
          <Select value={settings.direction} onValueChange={(v) => update("direction", v as MatrixRainSettings["direction"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="down">Down</SelectItem>
              <SelectItem value="up">Up</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <InlineSlider label="Glow" value={Math.round(settings.glow * 10)} min={0} max={100} onChange={(v) => update("glow", v / 10)} onReset={() => update("glow", 0)} />
        <InlineSlider label="BG Opacity" value={Math.round(settings.bgOpacity * 10)} min={0} max={10} onChange={(v) => update("bgOpacity", v / 10)} onReset={() => update("bgOpacity", 0.1)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
        <InlineSlider label="Threshold" value={Math.round(settings.threshold)} min={0} max={100} onChange={(v) => update("threshold", v)} onReset={() => update("threshold", 20)} />
      </SettingsSection>
      <SettingsSection title="Color" defaultOpen>
        <SettingsRow label="Rain Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.rainColor}
              onChange={(e) => update("rainColor", e.target.value)}
              className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent"
            />
            <Input
              value={settings.rainColor}
              onChange={(e) => update("rainColor", e.target.value)}
              className="h-7 text-xs font-mono bg-transparent border-border/40 w-24"
            />
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function DotsPanel({ settings, onChange }: { settings: DotsSettings; onChange: (s: DotsSettings) => void }) {
  const update = <K extends keyof DotsSettings>(key: K, value: DotsSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <SettingsSection title="Dots" defaultOpen>
      <InlineSlider label="Dot Size" value={settings.dotSize} min={2} max={20} onChange={(v) => update("dotSize", v)} onReset={() => update("dotSize", 6)} />
      <InlineSlider label="Spacing" value={settings.spacing} min={3} max={30} onChange={(v) => update("spacing", v)} onReset={() => update("spacing", 8)} />
      <SettingsRow label="Shape">
        <Select value={settings.shape} onValueChange={(v) => update("shape", v as DotsSettings["shape"])}>
          <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="triangle">Triangle</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsCheckbox label="Color" checked={settings.colorMode} onChange={(v) => update("colorMode", v)} />
      <SettingsCheckbox label="Size by Brightness" checked={settings.sizeByBrightness} onChange={(v) => update("sizeByBrightness", v)} />
      <SettingsCheckbox label="Randomize" checked={settings.randomize} onChange={(v) => update("randomize", v)} />
    </SettingsSection>
  );
}

function ContourPanel({ settings, onChange }: { settings: ContourSettings; onChange: (s: ContourSettings) => void }) {
  const update = <K extends keyof ContourSettings>(key: K, value: ContourSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <SettingsSection title="Contour" defaultOpen>
      <InlineSlider label="Levels" value={settings.levels} min={2} max={20} onChange={(v) => update("levels", v)} onReset={() => update("levels", 8)} />
      <InlineSlider label="Line Width" value={settings.lineWidth} min={1} max={5} onChange={(v) => update("lineWidth", v)} onReset={() => update("lineWidth", 1)} />
      <InlineSlider label="Smoothing" value={settings.smoothing} min={0} max={10} onChange={(v) => update("smoothing", v)} onReset={() => update("smoothing", 2)} />
      <SettingsCheckbox label="Color" checked={settings.colorMode} onChange={(v) => update("colorMode", v)} />
      <SettingsCheckbox label="Invert" checked={settings.invert} onChange={(v) => update("invert", v)} />
    </SettingsSection>
  );
}

function PixelSortPanel({ settings, onChange }: { settings: PixelSortSettings; onChange: (s: PixelSortSettings) => void }) {
  const update = <K extends keyof PixelSortSettings>(key: K, value: PixelSortSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Pixel Sort" defaultOpen>
        <SettingsRow label="Direction">
          <Select value={settings.direction} onValueChange={(v) => update("direction", v as PixelSortSettings["direction"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="vertical">Vertical</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Sort Mode">
          <Select value={settings.sortBy} onValueChange={(v) => update("sortBy", v as PixelSortSettings["sortBy"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brightness">Brightness</SelectItem>
              <SelectItem value="hue">Hue</SelectItem>
              <SelectItem value="saturation">Saturation</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <InlineSlider label="Threshold" value={Math.round(settings.threshold * 10) / 10} min={0} max={100} onChange={(v) => update("threshold", v)} onReset={() => update("threshold", 30)} />
        <InlineSlider label="Streak Length" value={settings.streakLength} min={10} max={500} onChange={(v) => update("streakLength", v)} onReset={() => update("streakLength", 100)} />
        <InlineSlider label="Intensity" value={Math.round(settings.intensity * 10) / 10} min={0} max={100} onChange={(v) => update("intensity", v)} onReset={() => update("intensity", 80)} />
        <InlineSlider label="Randomness" value={Math.round(settings.randomness * 10) / 10} min={0} max={100} onChange={(v) => update("randomness", v)} onReset={() => update("randomness", 30)} />
        <SettingsCheckbox label="Reverse" checked={settings.reverse} onChange={(v) => update("reverse", v)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
    </>
  );
}

function BlockifyPanel({ settings, onChange }: { settings: BlockifySettings; onChange: (s: BlockifySettings) => void }) {
  const update = <K extends keyof BlockifySettings>(key: K, value: BlockifySettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Blockify" defaultOpen>
        <SettingsRow label="Style">
          <Select value={settings.style} onValueChange={(v) => update("style", v as BlockifySettings["style"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Blocks</SelectItem>
              <SelectItem value="outlined">Outlined</SelectItem>
              <SelectItem value="rounded">Rounded</SelectItem>
              <SelectItem value="dots">Dots</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <InlineSlider label="Block Size" value={settings.blockSize} min={2} max={40} onChange={(v) => update("blockSize", v)} onReset={() => update("blockSize", 8)} />
        <InlineSlider label="Border Width" value={Math.round(settings.borderWidth * 10) / 10} min={0} max={50} onChange={(v) => update("borderWidth", v / 10)} onReset={() => update("borderWidth", 1)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
      <SettingsSection title="Color" defaultOpen>
        <SettingsRow label="Mode">
          <Select value={settings.colorMode} onValueChange={(v) => update("colorMode", v as BlockifySettings["colorMode"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preserve">Preserve Colors</SelectItem>
              <SelectItem value="grayscale">Grayscale</SelectItem>
              <SelectItem value="mono">Mono</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Border Color">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.borderColor} onChange={(e) => update("borderColor", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.borderColor} onChange={(e) => update("borderColor", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function ThresholdPanel({ settings, onChange }: { settings: ThresholdSettings; onChange: (s: ThresholdSettings) => void }) {
  const update = <K extends keyof ThresholdSettings>(key: K, value: ThresholdSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Threshold" defaultOpen>
        <InlineSlider label="Levels" value={settings.posterize} min={2} max={16} onChange={(v) => update("posterize", v)} onReset={() => update("posterize", 2)} />
        <InlineSlider label="Threshold Point" value={Math.round(settings.level * 10) / 10} min={1} max={100} onChange={(v) => update("level", v)} onReset={() => update("level", 50)} />
        <SettingsCheckbox label="Dither" checked={settings.dither} onChange={(v) => update("dither", v)} />
        <SettingsCheckbox label="Invert" checked={settings.invert} onChange={(v) => update("invert", v)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
      <SettingsSection title="Color" defaultOpen>
        <SettingsRow label="Mode">
          <Select value={settings.colorMode} onValueChange={(v) => update("colorMode", v as ThresholdSettings["colorMode"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mono">Mono</SelectItem>
              <SelectItem value="color">Color</SelectItem>
              <SelectItem value="duotone">Duotone</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Foreground">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.foreground} onChange={(e) => update("foreground", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.foreground} onChange={(e) => update("foreground", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
        <SettingsRow label="Background">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.background} onChange={(e) => update("background", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.background} onChange={(e) => update("background", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function EdgeDetectionPanel({ settings, onChange }: { settings: EdgeDetectionSettings; onChange: (s: EdgeDetectionSettings) => void }) {
  const update = <K extends keyof EdgeDetectionSettings>(key: K, value: EdgeDetectionSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Edge Detection" defaultOpen>
        <SettingsRow label="Algorithm">
          <Select value={settings.method} onValueChange={(v) => update("method", v as EdgeDetectionSettings["method"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sobel">Sobel</SelectItem>
              <SelectItem value="prewitt">Prewitt</SelectItem>
              <SelectItem value="laplacian">Laplacian</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <InlineSlider label="Threshold" value={Math.round(settings.threshold * 10) / 10} min={1} max={100} onChange={(v) => update("threshold", v)} onReset={() => update("threshold", 30)} />
        <InlineSlider label="Line Width" value={Math.round(settings.lineWidth * 10) / 10} min={1} max={50} onChange={(v) => update("lineWidth", v / 10)} onReset={() => update("lineWidth", 1)} />
        <SettingsCheckbox label="Invert" checked={settings.invert} onChange={(v) => update("invert", v)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
      <SettingsSection title="Color" defaultOpen>
        <SettingsRow label="Mode">
          <Select value={settings.colorMode} onValueChange={(v) => update("colorMode", v as EdgeDetectionSettings["colorMode"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mono">Mono</SelectItem>
              <SelectItem value="color">Color</SelectItem>
              <SelectItem value="overlay">Overlay</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Edge Color">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.edgeColor} onChange={(e) => update("edgeColor", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.edgeColor} onChange={(e) => update("edgeColor", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
        <SettingsRow label="Background">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.bgColor} onChange={(e) => update("bgColor", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.bgColor} onChange={(e) => update("bgColor", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function CrosshatchPanel({ settings, onChange }: { settings: CrosshatchSettings; onChange: (s: CrosshatchSettings) => void }) {
  const update = <K extends keyof CrosshatchSettings>(key: K, value: CrosshatchSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Crosshatch" defaultOpen>
        <InlineSlider label="Density" value={settings.density} min={1} max={10} onChange={(v) => update("density", v)} onReset={() => update("density", 6)} />
        <InlineSlider label="Layers" value={settings.layers} min={1} max={5} onChange={(v) => update("layers", v)} onReset={() => update("layers", 3)} />
        <InlineSlider label="Angle" value={settings.angle} min={0} max={180} suffix="°" onChange={(v) => update("angle", v)} onReset={() => update("angle", 45)} />
        <InlineSlider label="Line Width" value={Math.round(settings.lineWidth * 10) / 10} min={1} max={40} onChange={(v) => update("lineWidth", v / 10)} onReset={() => update("lineWidth", 0.1)} />
        <InlineSlider label="Randomness" value={Math.round(settings.randomness * 10) / 10} min={0} max={100} onChange={(v) => update("randomness", v)} onReset={() => update("randomness", 0)} />
        <SettingsCheckbox label="Invert" checked={settings.invert} onChange={(v) => update("invert", v)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
      <SettingsSection title="Color" defaultOpen>
        <SettingsRow label="Line Color">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.lineColor} onChange={(e) => update("lineColor", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.lineColor} onChange={(e) => update("lineColor", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
        <SettingsRow label="Background">
          <div className="flex items-center gap-2">
            <input type="color" value={settings.bgColor} onChange={(e) => update("bgColor", e.target.value)} className="w-6 h-6 border border-border/40 rounded-sm cursor-pointer bg-transparent" />
            <Input value={settings.bgColor} onChange={(e) => update("bgColor", e.target.value)} className="h-7 text-xs font-mono bg-transparent border-border/40 w-24" />
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function WaveLinesPanel({ settings, onChange }: { settings: WaveLinesSettings; onChange: (s: WaveLinesSettings) => void }) {
  const update = <K extends keyof WaveLinesSettings>(key: K, value: WaveLinesSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Wave Lines" defaultOpen>
        <InlineSlider label="Line Count" value={settings.lineCount} min={10} max={200} onChange={(v) => update("lineCount", v)} onReset={() => update("lineCount", 105)} />
        <InlineSlider label="Amplitude" value={settings.amplitude} min={1} max={40} onChange={(v) => update("amplitude", v)} onReset={() => update("amplitude", 13)} />
        <InlineSlider label="Frequency" value={Math.round(settings.frequency * 10) / 10} min={1} max={200} onChange={(v) => update("frequency", v)} onReset={() => update("frequency", 60)} />
        <InlineSlider label="Line Thickness" value={Math.round(settings.lineWidth * 10) / 10} min={1} max={60} onChange={(v) => update("lineWidth", v / 10)} onReset={() => update("lineWidth", 0.6)} />
        <SettingsRow label="Direction">
          <Select value={settings.direction} onValueChange={(v) => update("direction", v as WaveLinesSettings["direction"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="vertical">Vertical</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsCheckbox label="Animate" checked={settings.animate} onChange={(v) => update("animate", v)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
      <SettingsSection title="Color" defaultOpen>
        <SettingsRow label="Mode">
          <Select value={settings.colorMode} onValueChange={(v) => update("colorMode", v as WaveLinesSettings["colorMode"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="grayscale">Grayscale</SelectItem>
              <SelectItem value="mono">Mono</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function NoiseFieldPanel({ settings, onChange }: { settings: NoiseFieldSettings; onChange: (s: NoiseFieldSettings) => void }) {
  const update = <K extends keyof NoiseFieldSettings>(key: K, value: NoiseFieldSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <SettingsSection title="Noise Field" defaultOpen>
      <InlineSlider label="Scale" value={settings.scale} min={10} max={100} onChange={(v) => update("scale", v)} onReset={() => update("scale", 50)} />
      <InlineSlider label="Density" value={settings.density} min={10} max={100} onChange={(v) => update("density", v)} onReset={() => update("density", 40)} />
      <InlineSlider label="Length" value={settings.lineLength} min={3} max={40} onChange={(v) => update("lineLength", v)} onReset={() => update("lineLength", 15)} />
      <InlineSlider label="Width" value={settings.lineWidth} min={1} max={4} onChange={(v) => update("lineWidth", v)} onReset={() => update("lineWidth", 1)} />
      <SettingsCheckbox label="Color" checked={settings.colorMode} onChange={(v) => update("colorMode", v)} />
    </SettingsSection>
  );
}

function VoronoiPanel({ settings, onChange }: { settings: VoronoiSettings; onChange: (s: VoronoiSettings) => void }) {
  const update = <K extends keyof VoronoiSettings>(key: K, value: VoronoiSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="Voronoi" defaultOpen>
        <InlineSlider label="Cell Size" value={settings.cellSize} min={5} max={80} onChange={(v) => update("cellSize", v)} onReset={() => update("cellSize", 30)} />
        <InlineSlider label="Edge Width" value={Math.round(settings.edgeWidth * 10) / 10} min={1} max={50} onChange={(v) => update("edgeWidth", v / 10)} onReset={() => update("edgeWidth", 0.3)} />
        <SettingsRow label="Edge Color">
          <Select value={settings.edgeColor} onValueChange={(v) => update("edgeColor", v as VoronoiSettings["edgeColor"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="black">Black</SelectItem>
              <SelectItem value="white">White</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Color Mode">
          <Select value={settings.colorMode} onValueChange={(v) => update("colorMode", v as VoronoiSettings["colorMode"])}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cell-average">Cell Average</SelectItem>
              <SelectItem value="center-sample">Center Sample</SelectItem>
              <SelectItem value="grayscale">Grayscale</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <InlineSlider label="Randomize" value={settings.randomize} min={0} max={100} onChange={(v) => update("randomize", v)} onReset={() => update("randomize", 80)} />
        <SettingsCheckbox label="Show Edges" checked={settings.showEdges} onChange={(v) => update("showEdges", v)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
    </>
  );
}

function VHSPanel({ settings, onChange }: { settings: VHSSettings; onChange: (s: VHSSettings) => void }) {
  const update = <K extends keyof VHSSettings>(key: K, value: VHSSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SettingsSection title="VHS" defaultOpen>
        <InlineSlider label="Distortion" value={Math.round(settings.distortion * 10) / 10} min={0} max={100} onChange={(v) => update("distortion", v)} onReset={() => update("distortion", 50)} />
        <InlineSlider label="Noise" value={Math.round(settings.noise * 10) / 10} min={0} max={100} onChange={(v) => update("noise", v)} onReset={() => update("noise", 30)} />
        <InlineSlider label="Color Bleed" value={Math.round(settings.colorBleed * 10) / 10} min={0} max={100} onChange={(v) => update("colorBleed", v)} onReset={() => update("colorBleed", 50)} />
        <InlineSlider label="Scanlines" value={Math.round(settings.scanlines * 10) / 10} min={0} max={100} onChange={(v) => update("scanlines", v)} onReset={() => update("scanlines", 30)} />
        <InlineSlider label="Tracking Error" value={Math.round(settings.tracking * 10) / 10} min={0} max={100} onChange={(v) => update("tracking", v)} onReset={() => update("tracking", 20)} />
      </SettingsSection>
      <SettingsSection title="Adjustments" defaultOpen>
        <InlineSlider label="Brightness" value={settings.brightness} min={-100} max={100} onChange={(v) => update("brightness", v)} onReset={() => update("brightness", 0)} />
        <InlineSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update("contrast", v)} onReset={() => update("contrast", 0)} />
      </SettingsSection>
    </>
  );
}


function renderAscii(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: AsciiSettings) {
  const { cellSize, invert, colorMode, charset, characterRotation, customChars } = settings;
  const chars = charset === "custom" && customChars.length > 0 ? customChars : CHARSETS[charset] || CHARSETS.standard;
  const { width, height, data } = imageData;

  ctx.fillStyle = invert ? "#e8e8e8" : "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${cellSize}px monospace`;
  ctx.textBaseline = "top";

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      let brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (invert) brightness = 1 - brightness;
      const charIdx = Math.floor(brightness * (chars.length - 1));
      const char = chars[charIdx];

      if (colorMode) ctx.fillStyle = `rgb(${r},${g},${b})`;
      else {
        const v = invert ? Math.round((1 - brightness) * 255) : Math.round(brightness * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
      }

      if (characterRotation) {
        ctx.save();
        ctx.translate(x + cellSize / 2, y + cellSize / 2);
        ctx.rotate(brightness * Math.PI / 2);
        ctx.fillText(char, -cellSize / 4, -cellSize / 2);
        ctx.restore();
      } else {
        ctx.fillText(char, x, y);
      }
    }
  }
}

function renderAsciiAnimated(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  settings: AsciiSettings,
  anim: AsciiAnimSettings,
  progress: number
) {
  const { cellSize, invert, colorMode, charset, customChars } = settings;
  const chars = charset === "custom" && customChars.length > 0 ? customChars : CHARSETS[charset] || CHARSETS.standard;
  const { width, height, data } = imageData;
  const intensityFactor = anim.intensity / 50;

  ctx.fillStyle = invert ? "#e8e8e8" : "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${cellSize}px monospace`;
  ctx.textBaseline = "top";

  const t = progress * Math.PI * 2;

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      let brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (invert) brightness = 1 - brightness;

      let charIdx = Math.floor(brightness * (chars.length - 1));
      let drawX = x;
      let drawY = y;
      let alpha = 1;

      if (anim.mode === "wave") {
        const wave = Math.sin(t + (y / height) * 6 * intensityFactor) * cellSize * 2 * intensityFactor;
        drawX = x + wave;
        const vertWave = Math.cos(t + (x / width) * 4 * intensityFactor) * cellSize * intensityFactor;
        drawY = y + vertWave;
      } else if (anim.mode === "matrix") {
        const col = x / cellSize;
        const row = y / cellSize;
        const fallOffset = (progress * height / cellSize * 2 * intensityFactor + col * 3.7) % (height / cellSize);
        const dist = (row - fallOffset + height / cellSize) % (height / cellSize);
        if (dist < 3) {
          alpha = 1;
          charIdx = Math.floor(Math.random() * chars.length);
        } else if (dist < 8 * intensityFactor) {
          alpha = 1 - dist / (8 * intensityFactor);
        } else {
          alpha = 0.15;
        }
      } else if (anim.mode === "flicker") {
        const flicker = (Math.sin(t * 3 + x * 0.1 + y * 0.13) + 1) / 2;
        alpha = 0.3 + 0.7 * flicker * intensityFactor;
      } else if (anim.mode === "scramble") {
        const hash = Math.sin(x * 127.1 + y * 311.7 + progress * 1000) * 43758.5453;
        const scrambleChance = intensityFactor * 0.5;
        if ((hash - Math.floor(hash)) < scrambleChance) {
          charIdx = Math.floor(Math.abs(Math.sin(hash * 100 + t)) * chars.length) % chars.length;
        }
      }

      const char = chars[Math.max(0, Math.min(chars.length - 1, charIdx))];

      if (anim.mode === "matrix") {
        const g_val = Math.round(brightness * 255 * alpha);
        ctx.fillStyle = `rgba(0,${g_val},${Math.round(g_val * 0.3)},${alpha})`;
      } else if (colorMode) {
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      } else {
        const v = invert ? Math.round((1 - brightness) * 255) : Math.round(brightness * 255);
        ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      }

      ctx.fillText(char, drawX, drawY);
    }
  }
}

function renderGlitch(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: GlitchSettings) {
  const { intensity, sliceCount, colorShift, scanlines, rgbSplit, corruption } = settings;
  const { width, height } = imageData;

  ctx.putImageData(imageData, 0, 0);

  if (rgbSplit && colorShift > 0) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const shifted = ctx.createImageData(width, height);
    const src = imgData.data;
    const dst = shifted.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const rIdx = (y * width + Math.min(width - 1, x + colorShift)) * 4;
        const bIdx = (y * width + Math.max(0, x - colorShift)) * 4;
        dst[i] = src[rIdx];
        dst[i + 1] = src[i + 1];
        dst[i + 2] = src[bIdx + 2];
        dst[i + 3] = 255;
      }
    }
    ctx.putImageData(shifted, 0, 0);
  }

  const sliceHeight = Math.max(1, Math.ceil(height / sliceCount));
  for (let i = 0; i < sliceCount; i++) {
    if (Math.random() * 100 > intensity) continue;
    const sy = i * sliceHeight;
    const sh = Math.min(sliceHeight, height - sy);
    if (sh <= 0) continue;
    const displacement = (Math.random() - 0.5) * intensity * 0.6;
    const sliceData = ctx.getImageData(0, sy, width, sh);
    ctx.putImageData(sliceData, displacement, sy);
  }

  if (corruption > 0) {
    const blockCount = Math.floor(corruption / 5);
    for (let i = 0; i < blockCount; i++) {
      const bx = Math.random() * width;
      const by = Math.random() * height;
      const bw = 10 + Math.random() * 60;
      const bh = 2 + Math.random() * 10;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${0.1 + Math.random() * 0.3})`;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  if (scanlines) {
    for (let y = 0; y < height; y += 2) {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, y, width, 1);
    }
  }
}

function renderHalftone(ctx: CanvasRenderingContext2D, imageData: ImageData, settings: HalftoneSettings) {
  const { dotSize, spacing, angle, shape, colorMode: useColor, contrast } = settings;
  const { width, height, data } = imageData;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  const contrastFactor = 1 + (contrast - 50) / 50;
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (let gy = -spacing; gy < height + spacing; gy += spacing) {
    for (let gx = -spacing; gx < width + spacing; gx += spacing) {
      const rx = Math.round(cos * gx - sin * gy + width / 2 * (1 - cos) + height / 2 * sin);
      const ry = Math.round(sin * gx + cos * gy - width / 2 * sin + height / 2 * (1 - cos));
      if (rx < 0 || rx >= width || ry < 0 || ry >= height) continue;

      const idx = (ry * width + rx) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      let brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      brightness = 0.5 + (brightness - 0.5) * contrastFactor;
      brightness = Math.max(0, Math.min(1, brightness));

      const radius = brightness * dotSize / 2;
      if (radius < 0.3) continue;

      ctx.fillStyle = useColor ? `rgb(${r},${g},${b})` : `rgb(${Math.round(brightness * 255)},${Math.round(brightness * 255)},${Math.round(brightness * 255)})`;

      ctx.beginPath();
      if (shape === "circle") ctx.arc(rx, ry, radius, 0, Math.PI * 2);
      else if (shape === "square") ctx.rect(rx - radius, ry - radius, radius * 2, radius * 2);
      else if (shape === "diamond") {
        ctx.moveTo(rx, ry - radius);
        ctx.lineTo(rx + radius, ry);
        ctx.lineTo(rx, ry + radius);
        ctx.lineTo(rx - radius, ry);
      } else ctx.rect(rx - radius, ry - 0.5, radius * 2, 1);
      ctx.fill();
    }
  }
}
