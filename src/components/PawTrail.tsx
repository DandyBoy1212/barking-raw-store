import { Paw } from "./Paw";

// A dog walked through ink, bottom-left to top-right, the prints fading as the
// ink runs out. Alternating left/right offset mimics a real gait. Decorative.
type Spot = { left: string; top: string; size: number; opacity: number };

const WALK_ANGLE = -38; // paws point up the diagonal

// left climbs 6% -> 72%, top climbs 90% -> 8%; opacity fades 0.15 -> 0.02.
const STEPS = 9;
const TRAIL: Spot[] = Array.from({ length: STEPS }, (_, i) => {
  const t = i / (STEPS - 1);
  const gait = i % 2 === 0 ? -3.5 : 3.5; // perpendicular offset per step
  return {
    left: `${6 + t * 66 + gait}%`,
    top: `${90 - t * 82}%`,
    size: 72 + t * 40,
    opacity: 0.28 - t * 0.24,
  };
});

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
            transform: `rotate(${WALK_ANGLE}deg)`,
            opacity: s.opacity,
          }}
        >
          <Paw size={s.size} color="#000" />
        </div>
      ))}
    </div>
  );
}
