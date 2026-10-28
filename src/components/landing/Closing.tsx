import { nav, site } from "@/lib/site";
import { Logo } from "./Logo";
import s from "./Closing.module.css";

// A still, full-width row of equaliser dots rising from the footer's glow line: the hero's motif at rest.
const PITCH = 8;
const ROWS = 14;
const BARS = Array.from({ length: 180 }, (_, i) => {
  const u = i / 179;
  const swell = 3 + 8 * Math.exp(-(((u - 0.5) / 0.22) ** 2));
  return Math.max(1, Math.min(ROWS, Math.round(swell + 1.6 * Math.sin(u * 47) + 1.1 * Math.sin(u * 113 + 1.7))));
});

export function Closing() {
  return (
    <footer className={`${s.closing} on-dark`}>
      <div className={`wrap ${s.cta}`}>
        <h2 className={`display ${s.title}`}>Your next show has an opening slot. Fill it with a crowd.</h2>
        <div className={s.actions}>
          <a className="button button-cream" href={site.demoHref}>
            Book a Demo
          </a>
          <a className="button button-glass" href={site.tryHref}>
            Try a Show
          </a>
        </div>
      </div>

      <svg className={s.bars} viewBox={`0 0 ${BARS.length * PITCH} ${ROWS * PITCH}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {BARS.flatMap((h, i) =>
          Array.from({ length: h }, (_, r) => (
            <rect
              key={`${i}-${r}`}
              x={i * PITCH + 2}
              y={(ROWS - 1 - r) * PITCH + 2}
              width={4.4}
              height={4.4}
              rx={0.8}
              fill={r < 2 ? "#BFF2F8" : "#46DCEC"}
              fillOpacity={+(0.95 - r * 0.05).toFixed(2)}
            />
          )),
        )}
      </svg>

      <div className={s.base}>
        <div className={`wrap ${s.row}`}>
          <a className={s.brand} href="#">
            <Logo className={s.logo} />
            {site.name}
          </a>
          <nav className={s.links} aria-label="Footer">
            {nav.map((n) => (
              <a key={n.label} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <p className={s.small}>Taste data from Qloo · © 2026 {site.name}</p>
        </div>
      </div>
    </footer>
  );
}
