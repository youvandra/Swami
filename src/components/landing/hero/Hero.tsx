"use client";

import { useEffect, useRef } from "react";
import { nav, site } from "@/lib/site";
import { Chevron, Logo } from "../Logo";
import { TAU, clamp01, hash, rng, voice } from "./voice";
import s from "./Hero.module.css";

const VOICE_START = 1.1; // seconds after load

// The audience, seen from behind against the stage glow. Drawn in a 1000 x 520 box, bottom edge on the floor.
const CROWD_W = 1000;
const CROWD_H = 520;
const CROWD_RATIO = CROWD_H / CROWD_W;
type Fan = { x: number; s: number; arm?: "phone" | "fist" };
const FANS: Fan[] = [
  { x: 95, s: 0.62 },
  { x: 250, s: 0.7 },
  { x: 430, s: 0.74, arm: "phone" },
  { x: 610, s: 0.7 },
  { x: 790, s: 0.68 },
  { x: 930, s: 0.6 },
  { x: 170, s: 0.86 },
  { x: 345, s: 0.95 },
  { x: 525, s: 1 },
  { x: 705, s: 0.94, arm: "fist" },
  { x: 865, s: 0.84 },
];

function Fan({ x, s: k, arm }: Fan) {
  const f = CROWD_H;
  const headY = f - 250 * k;
  const sx = 112 * k;
  const shoulders = `M${x - sx},${f} C${x - sx},${f - 120 * k} ${x - 80 * k},${f - 168 * k} ${x},${f - 172 * k} C${x + 80 * k},${f - 168 * k} ${x + sx},${f - 120 * k} ${x + sx},${f} Z`;
  const side = arm === "phone" ? -1 : 1;
  const hand = { x: x + side * 118 * k, y: f - 430 * k };
  return (
    <g>
      <path d={shoulders} />
      <rect x={x - 17 * k} y={headY + 20 * k} width={34 * k} height={70 * k} rx={10 * k} />
      <ellipse cx={x} cy={headY} rx={37 * k} ry={42 * k} />
      {arm && (
        <>
          <line x1={x + side * 72 * k} y1={f - 150 * k} x2={hand.x} y2={hand.y + 18 * k} strokeWidth={30 * k} strokeLinecap="round" />
          {arm === "fist" ? (
            <circle cx={hand.x} cy={hand.y} r={21 * k} />
          ) : (
            <>
              <rect x={hand.x - 15 * k} y={hand.y - 34 * k} width={30 * k} height={52 * k} rx={5 * k} />
              <rect className={s.screen} x={hand.x - 11 * k} y={hand.y - 30 * k} width={22 * k} height={40 * k} rx={3 * k} />
            </>
          )}
        </>
      )}
    </g>
  );
}

// Row colour: pale at the glow, cyan higher up.
const STOPS = [
  [0.0, 236, 252, 255, 0.95],
  [0.16, 176, 243, 250, 0.95],
  [0.42, 104, 228, 241, 0.92],
  [1.0, 54, 196, 222, 0.72],
];
function rowColour(f: number): [string, string] {
  let i = 0;
  while (i < STOPS.length - 2 && f > STOPS[i + 1][0]) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = clamp01((f - a[0]) / (b[0] - a[0]));
  const m = (j: number) => a[j] + (b[j] - a[j]) * k;
  return [`rgb(${m(1) | 0},${m(2) | 0},${m(3) | 0})`, m(4).toFixed(3)];
}

type Column = {
  i: number;
  rest: number;
  dots: SVGRectElement[];
  cur: number;
  u: number;
  delay: number;
  ph: number;
  w: number;
};

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const eqRef = useRef<SVGSVGElement>(null);
  const personRef = useRef<SVGSVGElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  const showRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hero = heroRef.current!;
    const bg = bgRef.current!;
    const eq = eqRef.current!;
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
    let cols: Column[] = [];
    let headX = 0;
    let micDelay = 0;

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
        silW = Math.min(W * 1.05, 460);
        silH = silW * CROWD_RATIO;
        silX = W * 0.5 - silW * 0.5;
      } else {
        silW = Math.min(W * 0.62, 900, Math.max(520, (H - ctaBottom + 20) / CROWD_RATIO));
        silH = silW * CROWD_RATIO;
        silX = W * 0.5 - silW * 0.5;
      }
      const silY = H - silH + 2;
      Object.assign(person.style, { left: `${silX}px`, top: `${silY}px`, width: `${silW}px`, height: `${silH}px` });
      headX = silX + silW * 0.525;

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
        ax = Math.max(24, silX - aw * 0.35);
        ay = Math.min(silY + silH * 0.18, H - ah - 28);
        cx = Math.min(silX + silW - cw * 0.55, W - cw - 28);
        cy = Math.min(silY + silH * 0.05, H - ch - 28);
      }
      Object.assign(show.style, { left: `${ax}px`, top: `${ay}px` });
      Object.assign(chat.style, { left: `${cx}px`, top: `${cy}px` });
      micDelay = (Math.abs(cx + cw - 30 - headX) / W) * 0.34;

      buildEq();
    }

    function buildEq() {
      const NS = "http://www.w3.org/2000/svg";
      eq.setAttribute("viewBox", `0 0 ${W} ${H}`);
      eq.textContent = "";
      const pitch = phone ? 6.2 : Math.max(7.5, Math.min(10, W / 160));
      const n = Math.floor((W - pitch) / pitch) + 1;
      const x0 = (W - (n - 1) * pitch) / 2;
      const dot = pitch * 0.56;
      const maxRows = phone ? 22 : 24;
      const headU = headX / W;

      const r = rng(0xa11ce);
      const p1 = r() * TAU;
      const p2 = r() * TAU;
      const raw: number[] = [];
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const shape =
          0.3 +
          0.7 * Math.exp(-(((u - headU) / 0.22) ** 2)) +
          0.22 * Math.exp(-(((u - 0.16) / 0.08) ** 2)) +
          0.18 * Math.exp(-(((u - 0.86) / 0.07) ** 2));
        const tex = 0.74 + 0.16 * Math.sin(u * 23 + p1) + 0.1 * Math.sin(u * 61 + p2);
        raw.push(shape * tex * (0.78 + 0.44 * r()));
        sum += raw[i];
      }
      const k = (phone ? n * 11 : 2000) / sum;

      const palette: [string, string][] = [];
      for (let row = 0; row < maxRows + 4; row++) palette.push(rowColour(row / (maxRows + 3)));

      const frag = document.createDocumentFragment();
      cols = [];
      for (let i = 0; i < n; i++) {
        const x = x0 + i * pitch;
        const rest = Math.max(2, Math.min(maxRows, Math.round(raw[i] * k)));
        const base = glowY(x) + pitch * 0.4;
        const g = document.createElementNS(NS, "g");
        const dots: SVGRectElement[] = [];
        for (let row = 0; row < rest + 4; row++) {
          const d = document.createElementNS(NS, "rect");
          d.setAttribute("x", (x - dot / 2).toFixed(2));
          d.setAttribute("y", (base - row * pitch - dot).toFixed(2));
          d.setAttribute("width", dot.toFixed(2));
          d.setAttribute("height", dot.toFixed(2));
          d.setAttribute("rx", (dot * 0.18).toFixed(2));
          d.setAttribute("fill", palette[row][0]);
          d.setAttribute("fill-opacity", palette[row][1]);
          if (row >= rest) d.setAttribute("visibility", "hidden");
          g.appendChild(d);
          dots.push(d);
        }
        frag.appendChild(g);
        cols.push({ i, rest, dots, cur: rest, u: x / W, delay: (Math.abs(x - headX) / W) * 0.34, ph: r() * TAU, w: 0.75 + r() * 0.45 });
      }
      eq.appendChild(frag);
    }

    function setHeight(c: Column, h: number) {
      if (h === c.cur) return;
      const lo = Math.min(h, c.cur);
      const hi = Math.max(h, c.cur);
      for (let row = lo; row < hi; row++) c.dots[row].setAttribute("visibility", row < h ? "visible" : "hidden");
      c.cur = h;
    }

    // Everything here is a pure function of t (seconds on the page clock).
    function render(t: number) {
      const tv = t - VOICE_START;
      for (const c of cols) {
        if (tv <= 0) {
          setHeight(c, c.rest);
          continue;
        }
        const lv = voice(tv - c.delay, c.u);
        const band = c.w * (0.62 + 0.38 * Math.sin(TAU * (c.u * 1.3 + tv * 0.11) + c.ph) * Math.sin(TAU * (c.u * 0.45 - tv * 0.05) + 1.3));
        const jitter = (hash(c.i, Math.floor(tv * 14)) - 0.5) * 0.8 * lv;
        let extra = Math.round(lv * (band * 6.4 - 0.7) + jitter);
        extra = extra < -2 ? -2 : extra > 4 ? 4 : extra;
        setHeight(c, Math.max(1, c.rest + extra));
      }
      const mv = tv <= 0 ? 0 : voice(tv - micDelay, -1);
      mic.style.setProperty("--v", mv.toFixed(3));
    }

    // A long Web Animation is the page clock: recorders that step document timelines step this too.
    const clock = reduced ? null : new Animation(new KeyframeEffect(null, null, { duration: 1e9 }), document.timeline);
    clock?.play();
    const now = () => Number(clock?.currentTime ?? 0) / 1000;

    layout();
    let alive = true;
    document.fonts?.ready.then(() => alive && layout());

    let pending = 0;
    const onResize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        layout();
        if (clock) render(now());
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
      <svg className={s.eq} ref={eqRef} aria-hidden="true" />
      <svg className={s.person} ref={personRef} viewBox={`0 0 ${CROWD_W} ${CROWD_H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <g className={s.crowd}>
          {FANS.map((f) => (
            <Fan key={`${f.x}-${f.s}`} {...f} />
          ))}
        </g>
      </svg>

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
