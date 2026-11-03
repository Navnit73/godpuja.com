// Decorative mandala / dharma-chakra. Purely visual, hidden from assistive tech.
function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [200 + r * Math.cos(a), 200 + r * Math.sin(a)] as const;
}

export default function Chakra({ className = "" }: { className?: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  const dots = Array.from({ length: 48 }, (_, i) => i * 7.5);

  return (
    <svg viewBox="0 0 400 400" aria-hidden="true" focusable="false" className={className}
      fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* outer beaded ring */}
      <circle cx="200" cy="200" r="192" strokeWidth="1" />
      {dots.map((d) => {
        const [x, y] = polar(184, d);
        return <circle key={d} cx={x} cy={y} r="1.8" fill="currentColor" stroke="none" />;
      })}
      <circle cx="200" cy="200" r="174" strokeWidth="2" />

      {/* slowly rotating wheel with 24 spokes */}
      <g className="origin-center motion-safe:animate-[spin_90s_linear_infinite]" style={{ transformOrigin: "200px 200px" }}>
        <circle cx="200" cy="200" r="160" strokeWidth="3" />
        <circle cx="200" cy="200" r="120" strokeWidth="1.5" />
        {spokes.map((d) => {
          const [x1, y1] = polar(40, d);
          const [x2, y2] = polar(120, d);
          const [cx, cy] = polar(140, d + 0);
          const [x3, y3] = polar(160, d - 7.5);
          const [x4, y4] = polar(160, d + 7.5);
          return (
            <g key={d}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="2" />
              <path d={`M${x3} ${y3} Q${cx} ${cy} ${x4} ${y4}`} strokeWidth="1.5" />
            </g>
          );
        })}
      </g>

      {/* lotus petals */}
      <g className="origin-center motion-safe:animate-[spin_140s_linear_infinite_reverse]" style={{ transformOrigin: "200px 200px" }}>
        {petals.map((d) => (
          <path key={d} d="M200 118 C 184 90, 184 62, 200 40 C 216 62, 216 90, 200 118 Z"
            strokeWidth="1.5" transform={`rotate(${d} 200 200)`} />
        ))}
      </g>

      {/* hub */}
      <circle cx="200" cy="200" r="40" strokeWidth="2" />
      <circle cx="200" cy="200" r="26" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="8" fill="currentColor" stroke="none" />
    </svg>
  );
}
