export default function Meteors({ count = 10 }: { count?: number }) {
  return (
    <div className="clay-meteors" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="clay-meteor"
          style={{
            top: `${(i * 13) % 88}%`,
            left: `${(i * 23 + 8) % 96}%`,
            animationDelay: `${(i * 0.55) % 5}s`,
            animationDuration: `${2.4 + (i % 4) * 0.45}s`,
          }}
        />
      ))}
    </div>
  );
}
