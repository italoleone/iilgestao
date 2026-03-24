interface LeoneLogoProps {
  className?: string;
  variant?: "light" | "dark";
  showSubtext?: boolean;
}

export function LeoneLogo({ className = "", variant = "light", showSubtext = true }: LeoneLogoProps) {
  const mainColor = variant === "light" ? "#FFFFFF" : "#1A1A1A";
  const accentColor = "#D2E100";

  return (
    <div className={className}>
      <svg viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* L */}
        <rect x="0" y="4" width="4" height="30" fill={mainColor} />
        <rect x="0" y="30" width="18" height="4" fill={mainColor} />
        {/* E — three horizontal bars only (no vertical) */}
        <rect x="24" y="4" width="18" height="4" fill={mainColor} />
        <rect x="24" y="16" width="14" height="4" fill={accentColor} />
        <rect x="24" y="30" width="18" height="4" fill={mainColor} />
        {/* O */}
        <ellipse cx="62" cy="19" rx="12" ry="15" stroke={mainColor} strokeWidth="4" fill="none" />
        {/* N */}
        <rect x="80" y="4" width="4" height="30" fill={mainColor} />
        <rect x="104" y="4" width="4" height="30" fill={mainColor} />
        <line x1="84" y1="4" x2="104" y2="34" stroke={mainColor} strokeWidth="4" />
        {/* E — three horizontal bars only (no vertical) */}
        <rect x="114" y="4" width="18" height="4" fill={mainColor} />
        <rect x="114" y="16" width="14" height="4" fill={accentColor} />
        <rect x="114" y="30" width="18" height="4" fill={mainColor} />
      </svg>
      {showSubtext && (
        <p
          className="tracking-[0.35em] text-[0.55rem] uppercase mt-0.5"
          style={{ color: variant === "light" ? "rgba(255,255,255,0.6)" : "rgba(26,26,26,0.5)" }}
        >
          engenharia
        </p>
      )}
    </div>
  );
}
