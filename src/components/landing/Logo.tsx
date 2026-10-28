// The Swami mark: a block and two stacked slants, traced from the brand file.
const MARK = (
  <g fill="#46DCEC" stroke="#46DCEC" strokeWidth="48" strokeLinejoin="round">
    <rect x="48" y="1423" width="485" height="385" rx="2" />
    <polygon points="700,124 1285,124 1851,941 1267,941" />
    <polygon points="634,990 1215,990 1782,1808 1200,1808" />
  </g>
);

// "tile" sits on light surfaces (navy square, cyan mark); "mark" is the bare mark for dark surfaces.
export function Logo({ className, variant = "tile" }: { className?: string; variant?: "tile" | "mark" }) {
  if (variant === "mark") {
    return (
      <svg className={className} viewBox="0 76 1924 1780" aria-hidden="true">
        {MARK}
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#09131F" />
      <svg x="6.5" y="7.4" width="19" height="17.6" viewBox="0 76 1924 1780">
        {MARK}
      </svg>
    </svg>
  );
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}
