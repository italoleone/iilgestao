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
        <rect x="0" y="30" width="20" height="4" fill={mainColor} />
        {/* E (with horizontal lines) */}
        <rect x="26" y="4" width="4" height="30" fill={mainColor} />
        <rect x="26" y="4" width="18" height="4" fill={mainColor} />
        <rect x="26" y="16" width="14" height="4" fill={accentColor} />
        <rect x="26" y="30" width="18" height="4" fill={mainColor} />
        {/* O */}
        <ellipse cx="66" cy="19" rx="13" ry="15" stroke={mainColor} strokeWidth="4" fill="none" />
        {/* N */}
        <rect x="84" y="4" width="4" height="30" fill={mainColor} />
        <rect x="108" y="4" width="4" height="30" fill={mainColor} />
        <line x1="88" y1="4" x2="108" y2="34" stroke={mainColor} strokeWidth="4" />
        {/* E (with horizontal lines) */}
        <rect x="118" y="4" width="4" height="30" fill={mainColor} />
        <rect x="118" y="4" width="18" height="4" fill={mainColor} />
        <rect x="118" y="16" width="14" height="4" fill={accentColor} />
        <rect x="118" y="30" width="18" height="4" fill={mainColor} />
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
