import { colour } from "@/lib/crowdmap";
import { nav, site } from "@/lib/site";
import { IconArrowRight } from "../app/icons";
import { Logo } from "./Logo";
import s from "./Closing.module.css";

// The hero's crowd heatmap at rest: a dot grid rising from the footer's stage line, a few neighbourhoods lit,
// fading out toward the top.
const PITCH = 8;
const COLS = 180;
const ROWS = 16;
const SPOTS = [
  { u: 0.5, v: 0.3, r: 0.06, peak: 0.55 },
  { u: 0.24, v: 0.35, r: 0.05, peak: 1 },
  { u: 0.73, v: 0.4, r: 0.055, peak: 1 },
  { u: 0.08, v: 0.25, r: 0.04, peak: 0.8 },
  { u: 0.92, v: 0.3, r: 0.045, peak: 0.85 },
  { u: 0.4, v: 0.6, r: 0.035, peak: 0.7 },
];
const ASPECT = ROWS / COLS;
const DOTS = Array.from({ length: COLS * ROWS }, (_, n) => {
  const c = n % COLS;
  const r = Math.floor(n / COLS);
  const u = c / (COLS - 1);
  const v = r / (ROWS - 1);
  let h = 0;
  for (const s of SPOTS) {
    const du = u - s.u;
    const dv = (v - s.v) * ASPECT;
    h = Math.max(h, s.peak * Math.exp(-(du * du + dv * dv) / (s.r * s.r)));
  }
  const fade = 1 - Math.min(1, Math.max(0, (v - 0.2) / 0.8)) ** 1.6;
  const size = +(4.4 * (0.62 + 0.38 * h)).toFixed(2);
  return { x: c * PITCH + (PITCH - size) / 2, y: (ROWS - 1 - r) * PITCH + (PITCH - size) / 2, size, fill: colour(h), opacity: +(fade * (0.6 + 0.4 * h)).toFixed(2) };
}).filter((d) => d.opacity > 0.03);

export function Closing() {
  return (
    <footer className={`${s.closing} on-dark`}>
      <div className={`wrap ${s.cta}`}>
        <h2 className={`display ${s.title}`}>Your next show has an opening slot. Fill it with a crowd.</h2>
        <div className={s.actions}>
          <a className="button button-cream" href="/login">
            Get Started Free
            <IconArrowRight />
          </a>
          <a className="button button-glass" href={site.tourHref}>
            See How It Works
          </a>
        </div>
      </div>

      <svg className={s.bars} viewBox={`0 0 ${COLS * PITCH} ${ROWS * PITCH}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {DOTS.map((d) => (
          <rect key={`${d.x}-${d.y}`} x={d.x} y={d.y} width={d.size} height={d.size} rx={0.8} fill={d.fill} fillOpacity={d.opacity} />
        ))}
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
