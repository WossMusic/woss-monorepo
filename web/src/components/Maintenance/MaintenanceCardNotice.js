import React from "react";

// Pure, memoized — all strokes/fills inherit #56BCB6 via currentColor
function MaintenanceCardNotice({ title = "This section" }) {
  const mint = "#56BCB6";

  return (
    <div className="text-center py-5">
      <div
        className="position-relative mx-auto mb-3"
        style={{ width: 280, height: 280 }}
      >
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          aria-hidden="true"
          className="position-absolute"
          style={{ inset: 0, color: mint }}  // <- sets currentColor = #56BCB6
        >
          {/* Faint full ring */}
          <circle
            cx="100"
            cy="100"
            r="84"
            fill="none"
            stroke="currentColor"
            opacity="0.22"
            strokeWidth="8"
          />

          {/* Animated mint arc */}
          <g>
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="260 520"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-780"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </circle>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="360 100 100"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </g>

          {/* Centered cog (mint) */}
          <g
            transform="translate(100 100)"
            style={{ animation: "wmSpin 2.2s linear infinite" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x={-6}
                y={-44}
                width={12}
                height={18}
                rx={3}
                fill="currentColor"
                transform={`rotate(${i * 45})`}
              />
            ))}
            <circle r="28" fill="currentColor" />
            <circle r="12" fill="#fff" />
          </g>
        </svg>
      </div>

      <div className="d-inline-flex align-items-center mb-2">
        <span
          className="badge text-uppercase font-weight-bold mr-2"
          style={{ backgroundColor: mint, color: "#fff" }}
        >
          <i className="fa fa-wrench mr-1" /> Maintenance
        </span>
        <span
          className="text-muted text-uppercase"
          style={{ letterSpacing: ".12em", fontSize: 12 }}
        >
          Updating in progress
        </span>
      </div>

      <h5 className="mb-1" style={{ color: mint, fontWeight: 800 }}>
        {title} is currently under maintenance
      </h5>
      <div className="text-muted mt-1">
        We’re updating things behind the scenes. Please check back soon.
      </div>

      {/* keyframes for the cog spin */}
      <style>{`
        @keyframes wmSpin {
          from { transform: translate(100px,100px) rotate(0); }
          to   { transform: translate(100px,100px) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default React.memo(MaintenanceCardNotice);
