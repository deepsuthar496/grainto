/* eslint-disable react-refresh/only-export-components */
import { useRef, useEffect, useCallback, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Center } from "@react-three/drei";
import * as THREE from "three";

/* ── Types ───────────────────────────────────── */

export type ModelAnimMode = "turntable" | "bounce" | "swing" | "float";

export interface ModelAnimSettings {
  enabled: boolean;
  mode: ModelAnimMode;
  speed: number;
  intensity: number;
  duration: number;
  fps: number;
  exportFormat: "gif" | "webm";
}

export const DEFAULT_MODEL_ANIM: ModelAnimSettings = {
  enabled: false,
  mode: "turntable",
  speed: 50,
  intensity: 50,
  duration: 3,
  fps: 24,
  exportFormat: "webm",
};

/* ── Model Scene (rendered inside R3F Canvas) ── */

function Model({
  url,
  animSettings,
}: {
  url: string;
  animSettings: ModelAnimSettings;
}) {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Play embedded animations if any
  useEffect(() => {
    if (animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene);
      animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
      mixerRef.current = mixer;
      return () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      };
    }
  }, [scene, animations]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);

    if (!groupRef.current || !animSettings.enabled) return;
    const speed = (animSettings.speed / 50) * 0.02;
    const intensity = animSettings.intensity / 50;

    switch (animSettings.mode) {
      case "turntable":
        groupRef.current.rotation.y += speed;
        break;
      case "bounce":
        groupRef.current.position.y =
          Math.abs(Math.sin(Date.now() * speed * 0.5)) * intensity * 0.5;
        break;
      case "swing":
        groupRef.current.rotation.z =
          Math.sin(Date.now() * speed * 0.5) * intensity * 0.3;
        break;
      case "float":
        groupRef.current.position.y =
          Math.sin(Date.now() * speed * 0.3) * intensity * 0.3;
        groupRef.current.rotation.y += speed * 0.3;
        break;
    }
  });

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </Center>
  );
}

/* ── Frame Capturer ──────────────────────────── */

function FrameCapturer({
  onFrame,
  capturing,
}: {
  onFrame: (canvas: HTMLCanvasElement) => void;
  capturing: boolean;
}) {
  const { gl } = useThree();

  useFrame(() => {
    if (capturing) {
      onFrame(gl.domElement);
    }
  });

  return null;
}

/* ── Main Viewer Component ───────────────────── */

interface ModelAsciiViewerProps {
  modelUrl: string;
  animSettings: ModelAnimSettings;
  onFrameCapture?: (canvas: HTMLCanvasElement) => void;
  capturing?: boolean;
  size?: number;
}

export function ModelAsciiViewer({
  modelUrl,
  animSettings,
  onFrameCapture,
  capturing = false,
  size = 512,
}: ModelAsciiViewerProps) {
  const handleFrame = useCallback(
    (canvas: HTMLCanvasElement) => {
      onFrameCapture?.(canvas);
    },
    [onFrameCapture]
  );

  return (
    <div style={{ width: size, height: size }} className="relative">
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ position: [0, 1, 3], fov: 50 }}
        style={{ background: "#0a0a0a" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, 2, -3]} intensity={0.4} />
        <Suspense fallback={null}>
          <Model url={modelUrl} animSettings={animSettings} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={1}
          maxDistance={10}
        />
        <FrameCapturer onFrame={handleFrame} capturing={capturing} />
      </Canvas>
    </div>
  );
}

/* ── Export helper: renders 3D frames to ASCII ─ */

export function createModelExportRenderer(
  modelUrl: string,
  animSettings: ModelAnimSettings
) {
  // This creates an offscreen R3F renderer for export
  // We use the standard three.js renderer directly for export
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1, 3);
  camera.lookAt(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-3, 2, -3);
  scene.add(fillLight);

  let modelGroup: THREE.Group | null = null;
  const mixer: THREE.AnimationMixer | null = null;
  let loaded = false;

  const loader = new THREE.ObjectLoader();

  return {
    renderer,
    scene,
    camera,
    async loadModel(): Promise<void> {
      return new Promise((resolve, reject) => {
        const gltfLoader = new (
          // dynamic import workaround
          (window as { __THREE_GLTF_LOADER__?: unknown }).__THREE_GLTF_LOADER__ ||
          THREE.ObjectLoader
        )();
        
        // Use the simpler approach - load via useGLTF cache
        // For export, we'll capture from the live canvas instead
        resolve();
      });
    },
    setModelGroup(group: THREE.Group) {
      modelGroup = group;
      loaded = true;
    },
    renderFrame(
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      progress: number,
      width: number,
      height: number
    ) {
      if (!loaded || !modelGroup) return;

      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Animate
      const speed = (animSettings.speed / 50);
      const intensity = animSettings.intensity / 50;
      const t = progress * Math.PI * 2;

      switch (animSettings.mode) {
        case "turntable":
          modelGroup.rotation.y = t * speed;
          break;
        case "bounce":
          modelGroup.position.y = Math.abs(Math.sin(t * speed)) * intensity * 0.5;
          break;
        case "swing":
          modelGroup.rotation.z = Math.sin(t * speed) * intensity * 0.3;
          break;
        case "float":
          modelGroup.position.y = Math.sin(t * speed * 0.6) * intensity * 0.3;
          modelGroup.rotation.y = t * speed * 0.3;
          break;
      }

      renderer.render(scene, camera);

      // Copy WebGL canvas to 2D canvas
      ctx.drawImage(renderer.domElement, 0, 0, width, height);
    },
    dispose() {
      renderer.dispose();
    },
  };
}
