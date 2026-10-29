"use client";

import { useEffect, useRef } from "react";
import { nav, site } from "@/lib/site";
import { Chevron, Logo } from "../Logo";
import { colour } from "@/lib/crowdmap";
import { CYCLE, hash, heatAt, pulse } from "./heat";
import s from "./Hero.module.css";


// The audience, seen from behind against the stage glow: a transparent silhouette, bottom edge on the floor.
const CROWD_SRC = "/hero/crowd.png";
const CROWD_RATIO = 393 / 1761;

const smoothstep = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

type Dot = { x: number; y: number; u: number; v: number; fade: number; i: number };

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const personRef = useRef<HTMLImageElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  const showRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hero = heroRef.current!;
    const bg = bgRef.current!;
    const heat = heatRef.current!;
    const person = personRef.current!;
    const copy = copyRef.current!;
    const ctas = ctasRef.current!;
    const show = showRef.current!;
    const chat = chatRef.current!;
    const mic = micRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let phone = false;
    let dots: Dot[] = [];
    let dotSize = 0;
    let aspect = 1;

    let glowBase = 0;
    let dip = 0;
    // The stage edge: a flat line of light that sags a little under the centre of the stage.
    const glowY = (x: number) => glowBase + dip * Math.exp(-(((x / W - 0.5) / 0.11) ** 2));

    // Navy house, faint stage beams from the rig, and the lit stage edge fading into the white floor below.
    function drawBg() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      bg.width = Math.round(W * dpr);
      bg.height = Math.round(H * dpr);
      const g = bg.getContext("2d");
      if (!g || !W || !H) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#09131f";
      g.fillRect(0, 0, W, H);

      // The stage edge: one opaque strip with a flat line of light, copied column by column with the sag.
      const strip = document.createElement("canvas");
      strip.width = 1;
      strip.height = bg.height;
      const o = strip.getContext("2d");
      if (!o) return;
      const reach = H * 0.17;
      const line = glowBase * dpr;
      const grad = o.createLinearGradient(0, line - reach * dpr, 0, line + 64 * dpr);
      grad.addColorStop(0, "#09131f");
      grad.addColorStop(0.5, "#0c2c3b");
      grad.addColorStop(0.78, "#128aa0");
      grad.addColorStop(0.85, "#46dcec");
      grad.addColorStop(0.91, "#ddf8fb");
      grad.addColorStop(1, "#ffffff");
      o.fillStyle = "#09131f";
      o.fillRect(0, 0, 1, strip.height);
      o.fillStyle = grad;
      o.fillRect(0, line - reach * dpr, 1, strip.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (let px = 0; px < bg.width; px++) {
        const sag = Math.round((glowY(px / dpr) - glowBase) * dpr);
        g.drawImage(strip, 0, 0, 1, strip.height, px, sag, 1, strip.height);
        if (sag > 0) {
          g.fillStyle = "#09131f";
          g.fillRect(px, 0, 1, sag);
        }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      // a wide, flat bloom where the stage is brightest
      g.save();
      g.translate(W / 2, glowBase + dip);
      g.scale(1, 0.32);
      const bloom = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.42);
      bloom.addColorStop(0, "rgba(70,220,236,0.28)");
      bloom.addColorStop(1, "rgba(70,220,236,0)");
      g.fillStyle = bloom;
      g.fillRect(-W, -H * 4, W * 2, H * 4);
      g.restore();

      const beams = phone ? [0.5] : [0.3, 0.42, 0.58, 0.7];
      for (const u of beams) {
        const top = W * (0.5 + (u - 0.5) * 0.35);
        const foot = W * u;
        const half = W * (phone ? 0.16 : 0.07);
        const grad = g.createLinearGradient(0, 0, 0, glowBase);
        grad.addColorStop(0, "rgba(70,220,236,0)");
        grad.addColorStop(1, "rgba(70,220,236,0.07)");
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(top - 6, 0);
        g.lineTo(top + 6, 0);
        g.lineTo(foot + half, glowY(foot));
        g.lineTo(foot - half, glowY(foot));
        g.closePath();
        g.fill();
      }
    }

    function layout() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      phone = W <= 640;

      glowBase = H * (phone ? 0.81 : 0.78);
      dip = H * 0.022;
      drawBg();

      const ctaBottom = copy.offsetTop + ctas.offsetTop + ctas.offsetHeight;
      let silW: number;
      let silH: number;
      let silX: number;
      if (phone) {
        silW = W * 1.12;
        silH = silW * CROWD_RATIO;
        silX = W * 0.5 - silW * 0.5;
      } else {
        silW = Math.min(W * 0.8, 1180, Math.max(640, (H - ctaBottom) / CROWD_RATIO));
        silH = silW * CROWD_RATIO;
        silX = W * 0.5 - silW * 0.5;
      }
      const silY = H - silH + 2;
      Object.assign(person.style, { left: `${silX}px`, top: `${silY}px`, width: `${silW}px`, height: `${silH}px` });

      const aw = show.offsetWidth;
      const ah = show.offsetHeight;
      const cw = chat.offsetWidth;
      const ch = chat.offsetHeight;
      let ax: number, ay: number, cx: number, cy: number;
      if (phone) {
        ax = 14;
        ay = H - ah - 66;
        cx = W - cw - 14;
        cy = H - ch - 18;
      } else {
        // the cards float over the house on either side, just above the stage line
        ax = Math.max(24, W * 0.13);
        ay = glowBase - ah - H * 0.02;
        cx = Math.min(W * 0.87 - cw, W - cw - 28);
        cy = glowBase - ch - H * 0.05;
      }
      // Never over the headline or the buttons: on short or narrow screens a card drops below the CTAs, and when
      // there is no room left under them it steps aside rather than cover anything.
      const clear = ctaBottom + (phone ? 18 : 28);
      ay = Math.max(ay, clear);
      cy = Math.max(cy, clear);
      const fits = (top: number, h: number) => top + h <= H - 12;
      const overlap = ax + aw + 12 > cx && ay < cy + ch && cy < ay + ah;
      Object.assign(show.style, { left: `${ax}px`, top: `${ay}px`, visibility: fits(ay, ah) && !overlap ? "visible" : "hidden" });
      Object.assign(chat.style, { left: `${cx}px`, top: `${cy}px`, visibility: fits(cy, ch) ? "visible" : "hidden" });

      buildHeat();
    }

    // A dot grid over the house, sitting on the stage edge: the crowd map, live.
    function buildHeat() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      heat.width = Math.round(W * dpr);
      heat.height = Math.round(H * dpr);
      const pitch = phone ? 9 : Math.max(10, Math.min(13, W / 120));
      const band = H * (phone ? 0.3 : 0.38);
      const n = Math.floor(W / pitch);
      const rows = Math.floor(band / pitch);
      const x0 = (W - (n - 1) * pitch) / 2;
      dotSize = pitch * 0.58;
      aspect = band / W;
      dots = [];
      for (let c = 0; c < n; c++) {
        const x = x0 + c * pitch;
        const u = x / W;
        const edge = Math.min(1, u / 0.08, (1 - u) / 0.08);
        for (let r = 0; r < rows; r++) {
          const v = (r + 0.5) / rows;
          dots.push({ x, y: glowY(x) - pitch * (r + 0.9), u, v, fade: edge * (1 - smoothstep((v - 0.25) / 0.75)), i: c * 131 + r });
        }
      }
    }

    // Draws the grid at time t, dots bucketed by colour so each shade is one fill.
    function render(t: number) {
      const dpr = heat.width / (W || 1);
      const g = heat.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      // buckets by shade and by opacity, so the grid can fade out toward the top without one fill per dot
      const LEVELS = 24;
      const FADES = 10;
      const buckets = new Map<number, { x: number; y: number; sz: number }[]>();
      const tick = Math.floor(t * 4);
      for (const d of dots) {
        if (d.fade <= 0.02) continue;
        const shimmer = (hash(d.i, tick) - 0.5) * 0.06;
        const h = Math.max(0, Math.min(1, heatAt(t, d.u, d.v, aspect) + shimmer)) * d.fade;
        const k = Math.min(LEVELS - 1, Math.floor(h * LEVELS));
        const f = Math.min(FADES - 1, Math.floor(d.fade * FADES));
        const key = k * FADES + f;
        const list = buckets.get(key) ?? [];
        list.push({ x: d.x, y: d.y, sz: dotSize * (0.62 + 0.38 * h) });
        buckets.set(key, list);
      }
      for (const [key, list] of buckets) {
        const k = Math.floor(key / FADES);
        const f = ((key % FADES) + 0.5) / FADES;
        const h = (k + 0.5) / LEVELS;
        g.fillStyle = colour(h);
        g.globalAlpha = f * (0.6 + 0.4 * h);
        for (const p of list) g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
      }
      g.globalAlpha = 1;
      mic.style.setProperty("--v", (pulse(t) * 0.8).toFixed(3));
    }

    // A long Web Animation is the page clock: recorders that step document timelines step this too.
    const clock = reduced ? null : new Animation(new KeyframeEffect(null, null, { duration: 1e9 }), document.timeline);
    clock?.play();
    const now = () => Number(clock?.currentTime ?? 0) / 1000;

    // without motion the map holds a moment when two new neighbourhoods are lit
    const still = CYCLE * 0.3;
    layout();
    render(clock ? now() : still);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      layout();
      render(clock ? now() : still);
    });

    let pending = 0;
    const onResize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        layout();
        render(clock ? now() : still);
      });
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    if (clock) {
      const frame = () => {
        render(now());
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      window.removeEventListener("resize", onResize);
      clock?.cancel();
    };
  }, []);

  return (
    <section className={s.hero} ref={heroRef} aria-label={site.name}>
      <canvas className={s.bg} ref={bgRef} aria-hidden="true" />
      <canvas className={s.eq} ref={heatRef} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element -- positioned by the layout code */}
      <img className={s.person} ref={personRef} src={CROWD_SRC} alt="" decoding="async" />

      <header className={s.nav}>
        <a className={s.brand} href="#" aria-label={`${site.name} home`}>
          <Logo className={s.logo} variant="mark" />
          {site.name}
        </a>
        <nav className={s.links} aria-label="Primary">
          {nav.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className={s.navCta}>
          <a className={s.open} href={site.appHref}>
            Open app
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 11 11 5M6 5h5v5" />
            </svg>
          </a>
        </div>
      </header>

      <div className={s.copy} ref={copyRef}>
        <h1 className={s.title}>
          <span className={s.l1}>Pick openers</span> <span className={s.l2}>who bring</span>{" "}
          <span className={s.l3}>a crowd of their own</span>
        </h1>
        <p className={s.sub}>{site.description}</p>
        <div className={s.ctas} ref={ctasRef}>
          <a className={`${s.btn} ${s.btnCream}`} href="/login">
            Get started free
          </a>
          <a className={`${s.btn} ${s.btnGlass}`} href={site.tourHref}>
            See how it works
          </a>
        </div>
      </div>

      <div className={`${s.card} ${s.show}`} ref={showRef}>
        <div className={s.showHead}>
          <Logo className={s.logo} />
          New Show
        </div>
        <div className={s.field}>
          Select headliner
          <Chevron />
        </div>
        <button className={s.rank}>Rank Openers</button>
      </div>

      <div className={`${s.card} ${s.chat}`} ref={chatRef}>
        <div className={s.tools} aria-hidden="true">
          <span className={s.tool}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </span>
          <span className={s.tool}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 5 6 9.5a1.4 1.4 0 0 0 2 2l4.6-4.6a2.8 2.8 0 0 0-4-4L4 7.5a4.2 4.2 0 0 0 6 6l3-3" />
            </svg>
          </span>
          <span className={s.tool}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="8" cy="8" r="5.5" />
              <path d="M2.5 8h11M8 2.5c1.8 2 1.8 9 0 11M8 2.5c-1.8 2-1.8 9 0 11" />
            </svg>
          </span>
          <span className={s.tool}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M3 5h10M3 11h10" />
              <circle cx="6" cy="5" r="1.6" fill="#fff" />
              <circle cx="10.5" cy="11" r="1.6" fill="#fff" />
            </svg>
          </span>
        </div>
        <div className={s.bubble}>Halcyon Drive adds a crowd in Logan Square and Pilsen, where Marlow Vane runs cold.</div>
        <div className={s.composer}>
          <div className={s.input}>
            <span>Who opens Chicago, Mar 14…</span>
            <span className={s.send} aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M2.5 7.6 13.5 2.5 9 13.5 7.4 9 2.5 7.6Z" />
                <path d="m7.4 9 2.3-2.3" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <span className={s.mic} ref={micRef} aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="5.5" y="1.8" width="5" height="8" rx="2.5" />
              <path d="M3.3 7.8a4.7 4.7 0 0 0 9.4 0M8 12.5v2" />
            </svg>
          </span>
        </div>
      </div>
    </section>
  );
}
