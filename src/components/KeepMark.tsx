/** Building + key mark for BidKeep (facilities / building services). */
export default function KeepMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 360"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M80 280 V140 L220 60 L360 140 V280"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="150"
        y="190"
        width="60"
        height="90"
        rx="4"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect x="110" y="170" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <rect x="274" y="170" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <circle cx="470" cy="160" r="42" stroke="currentColor" strokeWidth="3" />
      <circle cx="470" cy="160" r="16" stroke="currentColor" strokeWidth="3" />
      <path
        d="M510 176 L560 230 V260 H530 V236 L500 204"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="536" y1="244" x2="552" y2="244" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
