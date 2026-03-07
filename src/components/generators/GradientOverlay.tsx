import { useCallback, useRef, useState } from "react";

interface GradientOverlayProps {
  type: "linear" | "radial" | "mesh";
  angle: number;
  onAngleChange: (angle: number) => void;
  size: number;
}

export function GradientOverlay({ type, angle, onAngleChange, size }: GradientOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const lineLen = size * 0.38;

  const angleRad = ((angle - 90) * Math.PI) / 180;
  const x1 = cx - Math.cos(angleRad) * lineLen;
  const y1 = cy - Math.sin(angleRad) * lineLen;
  const x2 = cx + Math.cos(angleRad) * lineLen;
  const y2 = cy + Math.sin(angleRad) * lineLen;

  const calcAngle = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return angle;
      const rect = svgRef.current.getBoundingClientRect();
      const scale = size / rect.width;
      const mx = (clientX - rect.left) * scale - cx;
      const my = (clientY - rect.top) * scale - cy;
      let deg = (Math.atan2(my, mx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      return Math.round(deg) % 360;
    },
    [angle, cx, cy, size]
  );

  const handlePointerDown = useCallback(
    (endpoint: "start" | "end") => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as SVGElement).setPointerCapture(e.pointerId);
      setDragging(endpoint);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      let newAngle = calcAngle(e.clientX, e.clientY);
      if (dragging === "start") {
        newAngle = (newAngle + 180) % 360;
      }
      onAngleChange(newAngle);
    },
    [dragging, calcAngle, onAngleChange]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  if (type !== "linear") return null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {/* Gradient line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.5}
        strokeDasharray="4 3"
      />

      {/* Start handle */}
      <circle
        cx={x1} cy={y1} r={7}
        fill="transparent"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.7}
        className="pointer-events-auto cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown("start")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <circle cx={x1} cy={y1} r={3} fill="white" fillOpacity={0.8} className="pointer-events-none" />

      {/* End handle (arrow end) */}
      <circle
        cx={x2} cy={y2} r={7}
        fill="white"
        fillOpacity={0.9}
        stroke="white"
        strokeWidth={1.5}
        className="pointer-events-auto cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown("end")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Angle label */}
      <g transform={`translate(${cx}, ${cy})`}>
        <rect x={-18} y={-10} width={36} height={20} rx={4} fill="black" fillOpacity={0.6} />
        <text
          x={0} y={5}
          textAnchor="middle"
          fill="white"
          fontSize={11}
          fontFamily="monospace"
          fillOpacity={0.9}
        >
          {angle}°
        </text>
      </g>
    </svg>
  );
}
