/**
 * Vivienda in silhouette, for the top of the footer: palms, the string lights
 * with their warm bulbs, the glass A-frame, the villa with a lit window, the
 * pavilion, and the hedge line, drawn in the footer's own colour so the dark
 * footer seems to rise out of the page as the resort's outline.
 */
export function Skyline({ className = "" }: { className?: string }) {
  const bulbs = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 1) / 10;
    // The light string sags between its two poles (x 250 → 520).
    const x = 250 + 270 * t;
    const y = 74 + 38 * 4 * t * (1 - t) * 0.5;
    return { x, y };
  });
  return (
    <svg
      viewBox="0 0 1440 170"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={`block h-24 w-full text-espresso sm:h-32 lg:h-40 ${className}`}
    >
      <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* the hedge and the ground, a long low line */}
        <path
          stroke="none"
          d="M0 150 C 80 138, 140 146, 210 140 S 330 132, 420 141 S 560 136, 640 142 S 980 134, 1080 141 S 1260 132, 1340 140 S 1420 138, 1440 136 L1440 170 L0 170 Z"
        />

        {/* palm, far left */}
        <path fill="none" strokeWidth="7" d="M150 150 C 156 120, 158 96, 170 64" />
        <path fill="none" strokeWidth="6" d="M170 64 C 150 54, 128 56, 112 70" />
        <path fill="none" strokeWidth="6" d="M170 64 C 160 44, 142 36, 124 38" />
        <path fill="none" strokeWidth="6" d="M170 64 C 180 42, 198 34, 216 38" />
        <path fill="none" strokeWidth="6" d="M170 64 C 192 58, 212 64, 226 80" />
        <path fill="none" strokeWidth="5" d="M170 64 C 168 50, 172 38, 178 28" />

        {/* string-light poles and the wire between them */}
        <path fill="none" strokeWidth="4" d="M250 146 V 70 M520 146 V 70" />
        <path fill="none" strokeWidth="1.5" d={`M250 74 Q 385 112 520 74`} />

        {/* the glass A-frame, with its mullions left open */}
        <path stroke="none" d="M560 150 L 640 22 L 720 150 Z" />
        <path fill="none" stroke="var(--color-espresso-soft)" strokeWidth="2" d="M640 60 V 150 M612 104 H 668" opacity="0.6" />

        {/* the villa: two storeys under a gable, one window lit */}
        <path stroke="none" d="M705 150 V 78 L 790 40 L 875 78 V 150 Z" />
        <path stroke="none" d="M690 82 L 790 36 L 890 82 L 884 86 L 790 44 L 696 86 Z" />

        {/* the pavilion: a long flat roof on thin posts */}
        <path stroke="none" d="M895 104 H 1110 V 112 H 895 Z" />
        <path fill="none" strokeWidth="4" d="M905 112 V 146 M960 112 V 146 M1040 112 V 146 M1100 112 V 146" />

        {/* two palms on the right, one tall, one short */}
        <path fill="none" strokeWidth="7" d="M1190 150 C 1186 118, 1192 92, 1206 58" />
        <path fill="none" strokeWidth="6" d="M1206 58 C 1186 46, 1162 48, 1146 62" />
        <path fill="none" strokeWidth="6" d="M1206 58 C 1196 38, 1178 30, 1160 32" />
        <path fill="none" strokeWidth="6" d="M1206 58 C 1218 36, 1236 28, 1254 32" />
        <path fill="none" strokeWidth="6" d="M1206 58 C 1228 52, 1248 58, 1262 74" />
        <path fill="none" strokeWidth="6" d="M1290 150 C 1294 130, 1300 112, 1310 92" />
        <path fill="none" strokeWidth="5" d="M1310 92 C 1294 84, 1276 86, 1264 96" />
        <path fill="none" strokeWidth="5" d="M1310 92 C 1304 76, 1290 70, 1276 72" />
        <path fill="none" strokeWidth="5" d="M1310 92 C 1320 76, 1334 70, 1348 72" />
        <path fill="none" strokeWidth="5" d="M1310 92 C 1326 88, 1340 94, 1350 106" />
      </g>

      {/* warm things: the bulbs and the lit window */}
      <g fill="#f3c77a">
        {bulbs.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y + 5} r="3.2" />
        ))}
        <rect x="815" y="92" width="22" height="18" rx="1.5" opacity="0.9" />
        <rect x="738" y="92" width="22" height="18" rx="1.5" opacity="0.55" />
      </g>
    </svg>
  );
}
