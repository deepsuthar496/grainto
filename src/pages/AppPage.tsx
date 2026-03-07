import { useState } from "react";
import { NoiseGenerator } from "@/components/generators/NoiseGenerator";
import { GradientGenerator } from "@/components/generators/GradientGenerator";
import { EffectsGenerator } from "@/components/generators/EffectsGenerator";

type Generator = "noise" | "gradient" | "effects";

interface NavItem {
  id: string;
  label: string;
  enabled: boolean;
}

const GENERATORS: NavItem[] = [
  { id: "noise", label: "Noise / Grain", enabled: true },
  { id: "gradient", label: "Gradients", enabled: true },
  { id: "effects", label: "Effects", enabled: true },
];

export default function AppPage() {
  const [active, setActive] = useState<Generator>("noise");
  const [generatorsOpen, setGeneratorsOpen] = useState(true);

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-52 border-r border-border/40 flex flex-col shrink-0">
        <div className="h-11 flex items-center px-4 border-b border-border/40">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Grainto
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2 space-y-0.5">
          <SectionToggle
            label="Generators"
            open={generatorsOpen}
            onToggle={() => setGeneratorsOpen(!generatorsOpen)}
          />
          {generatorsOpen && (
            <div className="space-y-0.5 ml-1">
              {GENERATORS.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={active === item.id}
                  onClick={() => setActive(item.id as Generator)}
                />
              ))}
            </div>
          )}
        </nav>

        <div className="px-4 py-2.5 border-t border-border/40">
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            Canvas2D
          </span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-11 border-b border-border/40 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/60" />
            <span className="text-sm text-foreground/90">
              {active === "noise" ? "Noise / Grain" : active === "gradient" ? "Gradients" : "Effects"}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/40 ml-1">
              [Canvas2D]
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {active === "noise" ? <NoiseGenerator /> : active === "gradient" ? <GradientGenerator /> : <EffectsGenerator />}
        </div>
      </div>
    </div>
  );
}

function SectionToggle({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors"
    >
      <span className="text-muted-foreground text-[10px]">{open ? "−" : "+"}</span>
      {label}
    </button>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!item.enabled}
      className={`flex items-center gap-2 w-full px-2 py-1 text-[13px] transition-colors ${
        active
          ? "text-foreground"
          : item.enabled
          ? "text-muted-foreground/60 hover:text-muted-foreground"
          : "text-muted-foreground/25 cursor-not-allowed"
      }`}
    >
      <span
        className={`w-1 h-1 rounded-full shrink-0 ${
          active
            ? "bg-foreground"
            : item.enabled
            ? "bg-muted-foreground/30"
            : "bg-muted-foreground/15"
        }`}
      />
      {item.label}
    </button>
  );
}
