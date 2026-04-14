export function HeroBg() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-25 pointer-events-none">
      {/* Grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Mathematical symbols */}
      <div className="absolute top-20 left-10 text-6xl font-mono text-white opacity-70">∑</div>
      <div className="absolute top-40 right-20 text-5xl font-mono text-white opacity-60">∫</div>
      <div className="absolute bottom-40 left-20 text-4xl font-mono text-white opacity-65">π</div>
      <div className="absolute top-60 right-40 text-5xl font-mono text-white opacity-60">≈</div>
      <div className="absolute bottom-60 right-60 text-4xl font-mono text-white opacity-70">∞</div>

      {/* Data points and connections */}
      <svg className="absolute inset-0 w-full h-full">
        <circle cx="15%" cy="25%" r="3" fill="white" opacity="0.7" />
        <circle cx="25%" cy="35%" r="3" fill="white" opacity="0.7" />
        <circle cx="35%" cy="28%" r="3" fill="white" opacity="0.7" />
        <line x1="15%" y1="25%" x2="25%" y2="35%" stroke="white" strokeWidth="1" opacity="0.5" />
        <line x1="25%" y1="35%" x2="35%" y2="28%" stroke="white" strokeWidth="1" opacity="0.5" />
        <circle cx="70%" cy="30%" r="3" fill="white" opacity="0.7" />
        <circle cx="80%" cy="40%" r="3" fill="white" opacity="0.7" />
        <circle cx="85%" cy="25%" r="3" fill="white" opacity="0.7" />
        <line x1="70%" y1="30%" x2="80%" y2="40%" stroke="white" strokeWidth="1" opacity="0.5" />
        <line x1="80%" y1="40%" x2="85%" y2="25%" stroke="white" strokeWidth="1" opacity="0.5" />
      </svg>

      {/* Binary numbers */}
      <div className="absolute top-10 right-10 text-xs font-mono text-white opacity-40">
        01001001 10101010 11010011
      </div>
      <div className="absolute bottom-20 left-40 text-xs font-mono text-white opacity-40">
        11100101 00110101 10010110
      </div>

      {/* Matrix notation */}
      <div className="absolute top-1/3 left-5 font-mono text-white opacity-40 text-sm">[x₁ x₂ x₃]</div>
      <div className="absolute bottom-1/3 right-10 font-mono text-white opacity-40 text-sm">∂f/∂x</div>
    </div>
  );
}
