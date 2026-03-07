import { useState } from "react";
import { Slider } from "@/components/ui/slider";

/* ── Section ──────────────────────────────────── */

export function SettingsSection({
  title,
  defaultOpen = true,
  onReset,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground/90 hover:text-foreground transition-colors"
        >
          <span className="text-muted-foreground text-[10px]">{open ? "−" : "+"}</span>
          {title}
        </button>
        {onReset && open && (
          <button
            onClick={onReset}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      {open && <div className="pb-3 space-y-0.5">{children}</div>}
    </div>
  );
}

/* ── Row ──────────────────────────────────────── */

export function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-1 min-h-[28px]">
      <span className="text-[11px] text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* ── Inline Slider ────────────────────────────── */

export function InlineSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-1 min-h-[28px]">
      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-[11px] text-foreground tabular-nums w-10 text-right font-mono shrink-0">
        {value}{suffix || ""}
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        className="flex-1 min-w-0"
      />
      <button
        onClick={onReset}
        className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
      >
        reset
      </button>
    </div>
  );
}

/* ── Checkbox ─────────────────────────────────── */

export function SettingsCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-1 min-h-[28px]">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-3.5 h-3.5 border rounded-sm transition-colors flex items-center justify-center ${
          checked
            ? "border-foreground/60 bg-foreground/10"
            : "border-muted-foreground/30"
        }`}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/80" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ── Format Tabs ──────────────────────────────── */

export function FormatTabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex border border-border/40 rounded-sm overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1 text-[11px] font-mono transition-colors ${
            value === opt.value
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
