import { useId } from "react";

/** The palm frond behind the hero, drawn the same way as Malaya's. */
export function FrondBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <Fern className="absolute -top-10 -left-24 h-[16rem] w-[16rem] opacity-60 sm:-top-8 sm:-left-16 sm:h-[24rem] sm:w-[24rem] sm:opacity-100 lg:-top-12 lg:-left-20 lg:h-[30rem] lg:w-[30rem]" />
      <Fern className="absolute -top-16 -right-28 hidden h-[26rem] w-[26rem] -scale-x-100 opacity-[0.07] blur-[3px] sm:block lg:-top-20 lg:-right-24 lg:h-[32rem] lg:w-[32rem]" />
    </div>
  );
}

// A quadratic stem with paired leaflets that lean toward the tip.
const FERN = (() => {
  const P0 = { x: -6, y: 150 };
  const P1 = { x: 130, y: 20 };
  const P2 = { x: 340, y: 200 };
  const pairs = 24;
  const leaflets: { x: number; y: number; angle: number; length: number; width: number }[] = [];
  for (let i = 0; i <= pairs; i++) {
    const t = 0.06 + (i / pairs) * 0.92;
    const u = 1 - t;
    const x = u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x;
    const y = u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y;
    const dx = 2 * u * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
    const dy = 2 * u * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
    const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;
    const profile = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.8;
    const length = 14 + 74 * profile * (1 - t * 0.35);
    const width = 3 + 5.5 * profile;
    const lean = 48 + 18 * t;
    leaflets.push({ x, y, angle: tangent - lean, length, width });
    leaflets.push({ x, y, angle: tangent + lean, length, width });
  }
  return { rachis: `M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`, leaflets };
})();

function leafletPath(l: number, w: number) {
  return `M0 0 C${l * 0.18} ${-w * 0.9}, ${l * 0.55} ${-w * 0.95}, ${l} ${-w * 0.12} C${l * 0.55} ${w * 0.55}, ${l * 0.18} ${w * 0.7}, 0 0 Z`;
}

function Fern({ className = "" }: { className?: string }) {
  const fade = useId();
  return (
    <svg viewBox="0 0 360 300" className={className} fill="none" style={{ color: "oklch(0.368 0.044 116)" }}>
      <defs>
        <linearGradient id={fade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="currentColor" stopOpacity="0.78" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g fill={`url(#${fade})`}>
        {FERN.leaflets.map((leaf, i) => (
          <path
            key={i}
            d={leafletPath(leaf.length, leaf.width)}
            transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.angle.toFixed(1)})`}
          />
        ))}
      </g>
      <path d={FERN.rachis} stroke={`url(#${fade})`} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
