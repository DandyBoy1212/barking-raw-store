import { Paw } from "./Paw";

// A deterministic trail of fading black paw-prints, like a dog walked through
// ink across the white band. Purely decorative.
type Spot = { left: string; top: string; size: number; rotate: number; opacity: number };

const TRAIL: Spot[] = [
  { left: "4%", top: "12%", size: 54, rotate: 24, opacity: 0.05 },
  { left: "12%", top: "34%", size: 60, rotate: 16, opacity: 0.045 },
  { left: "20%", top: "58%", size: 66, rotate: 22, opacity: 0.04 },
  { left: "30%", top: "80%", size: 72, rotate: 12, opacity: 0.035 },
  { left: "78%", top: "8%", size: 58, rotate: -20, opacity: 0.05 },
  { left: "86%", top: "30%", size: 64, rotate: -14, opacity: 0.04 },
  { left: "92%", top: "56%", size: 70, rotate: -22, opacity: 0.03 },
  { left: "83%", top: "82%", size: 76, rotate: -10, opacity: 0.025 },
];

export function PawTrail() {
  return (
    <div className="paw-field" aria-hidden="true">
      {TRAIL.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            transform: `rotate(${s.rotate}deg)`,
            opacity: s.opacity,
          }}
        >
          <Paw size={s.size} color="#000" />
        </div>
      ))}
    </div>
  );
}
