export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#46DCEC" />
      <rect x="9" y="11.5" width="3.4" height="9" rx="1.7" fill="#0A1A24" />
      <rect x="14.3" y="7.5" width="3.4" height="17" rx="1.7" fill="#0A1A24" />
      <rect x="19.6" y="12.5" width="3.4" height="7" rx="1.7" fill="#0A1A24" />
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
