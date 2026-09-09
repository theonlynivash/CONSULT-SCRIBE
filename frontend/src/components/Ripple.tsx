export default function Ripple({ rings = 7 }: { rings?: number }) {
  return (
    <div className="clay-ripple" aria-hidden="true">
      {Array.from({ length: rings }, (_, i) => (
        <span
          key={i}
          className="clay-ripple-ring"
          style={{
            width: `${140 + i * 72}px`,
            height: `${140 + i * 72}px`,
            opacity: Math.max(0.08, 0.42 - i * 0.045),
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}
