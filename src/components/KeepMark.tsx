export default function KeepMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 360"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      {/* building mass */}
      <rect x="170" y="110" width="260" height="200" rx="6" stroke="currentColor" strokeWidth="3" />
      <rect x="200" y="250" width="60" height="60" stroke="currentColor" strokeWidth="3" />

      {/* window grid */}
      <rect x="200" y="140" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <rect x="260" y="140" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <rect x="320" y="140" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <rect x="380" y="140" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <rect x="320" y="200" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <rect x="380" y="200" width="36" height="36" stroke="currentColor" strokeWidth="3" />

      {/* key bow + shaft — facilities "keep" */}
      <circle cx="230" cy="218" r="18" stroke="currentColor" strokeWidth="3" />
      <circle cx="230" cy="218" r="6" stroke="currentColor" strokeWidth="3" />
      <line x1="248" y1="218" x2="310" y2="218" stroke="currentColor" strokeWidth="3" />
      <line x1="300" y1="218" x2="300" y2="234" stroke="currentColor" strokeWidth="3" />
      <line x1="310" y1="218" x2="310" y2="230" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
