/** Centerpiece animation for onboarding: searching for a home. */
export function HouseSearchAnim({ className = "" }: { className?: string }) {
  return (
    <div className={`house-search-anim ${className}`.trim()} aria-hidden>
      <div className="hsa-glow" />
      <div className="hsa-ring hsa-ring--a" />
      <div className="hsa-ring hsa-ring--b" />
      <div className="hsa-ring hsa-ring--c" />

      <div className="hsa-card hsa-card--1" />
      <div className="hsa-card hsa-card--2" />
      <div className="hsa-card hsa-card--3" />

      <div className="hsa-pin">
        <span />
      </div>

      <div className="hsa-house-wrap">
        <svg className="hsa-house" viewBox="0 0 96 96" width="96" height="96">
          <defs>
            <linearGradient id="hsaGrad" x1="12%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stopColor="#ff5c86" />
              <stop offset="100%" stopColor="#ff9a5c" />
            </linearGradient>
            <linearGradient id="hsaFill" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ff5c86" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ff9a5c" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Soft ground shadow */}
          <ellipse cx="48" cy="84" rx="22" ry="4.5" fill="url(#hsaGrad)" opacity="0.18" />

          {/* House body — closed silhouette */}
          <path
            className="hsa-house-fill"
            d="M48 16 L82 44 V80 H14 V44 Z"
            fill="url(#hsaFill)"
          />
          <path
            className="hsa-house-body"
            d="M48 16 L82 44 V80 H14 V44 Z"
            fill="none"
            stroke="url(#hsaGrad)"
            strokeWidth="3.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Roof ridge accent */}
          <path
            className="hsa-roof"
            d="M20 46 L48 22 L76 46"
            fill="none"
            stroke="url(#hsaGrad)"
            strokeWidth="3.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Chimney */}
          <path
            className="hsa-chimney"
            d="M64 28 V18 H72 V35"
            fill="none"
            stroke="url(#hsaGrad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Door */}
          <rect
            className="hsa-door"
            x="40"
            y="54"
            width="16"
            height="26"
            rx="3.5"
            fill="none"
            stroke="url(#hsaGrad)"
            strokeWidth="3"
          />
          <circle className="hsa-knob" cx="51" cy="68" r="1.8" fill="url(#hsaGrad)" />

          {/* Window */}
          <rect
            className="hsa-window"
            x="22"
            y="52"
            width="12"
            height="12"
            rx="2.5"
            fill="url(#hsaGrad)"
            opacity="0.85"
          />
        </svg>

        <div className="hsa-lens">
          <svg viewBox="0 0 48 48" width="44" height="44">
            <circle
              cx="20"
              cy="20"
              r="11"
              fill="color-mix(in srgb, var(--surface) 88%, transparent)"
              stroke="currentColor"
              strokeWidth="2.8"
            />
            <path
              d="M28.5 28.5 L38 38"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <div className="hsa-scan" />
    </div>
  );
}
