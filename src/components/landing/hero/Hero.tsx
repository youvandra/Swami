"use client";

import { useEffect, useRef } from "react";
import { nav, site } from "@/lib/site";
import { Chevron, Logo } from "../Logo";
import { TAU, clamp01, hash, rng, voice } from "./voice";
import s from "./Hero.module.css";

const GLOW_SRC = "/hero/glow.png";
const SILHOUETTE_SRC = "/hero/silhouette.png";
const IW = 745; // glow source size
const IH = 194;
const SLICE = 48; // rows 0..48 flat navy: top slice; row 48 stretches; 48..194 anchored to the bottom
const FEATHER = 40;
const SIL_RATIO = 1134 / 900;
const VOICE_START = 1.1; // seconds after load

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
  const personRef = useRef<HTMLImageElement>(null);
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
    let sx = 1;
    let sy = 1;
    let offX = 0;
    let cols: Column[] = [];
    let headX = 0;
    let micDelay = 0;

    const glow = new Image();
    glow.decoding = "async";
    glow.onload = () => drawBg();
    glow.src = GLOW_SRC;

    function drawBg() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      bg.width = Math.round(W * dpr);
      bg.height = Math.round(H * dpr);
      const g = bg.getContext("2d");
      if (!g || !W || !H || !glow.complete || !glow.naturalWidth) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dw = IW * sx;
      const topH = SLICE * sy;
      const botH = (IH - SLICE) * sy;
      const botY = H - botH;
      g.drawImage(glow, 0, 0, IW, SLICE, offX, 0, dw, topH);
      g.drawImage(glow, 0, SLICE, IW, 1, offX, topH - 1, dw, Math.max(0, botY - topH + FEATHER + 1));
      const oc = document.createElement("canvas");
      oc.width = bg.width;
      oc.height = Math.ceil(botH * dpr);
      const o = oc.getContext("2d");
      if (!o || !oc.width || !oc.height) return;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.drawImage(glow, 0, SLICE, IW, IH - SLICE, offX, 0, dw, botH);
      o.globalCompositeOperation = "destination-in";
      const fade = o.createLinearGradient(0, 0, 0, FEATHER);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "#000");
      o.fillStyle = fade;
      o.fillRect(0, 0, W, botH);
      g.drawImage(oc, 0, 0, oc.width, oc.height, 0, botY, W, oc.height / dpr);
    }

    // Page y of a source-image row (the bottom slice is anchored to the bottom).
    const rowY = (row: number) => H - (IH - row) * sy;
    // Glow line in source rows: flat at 111, dipping to ~119 under the centre.
    const glowRow = (x: number) => {
      const u = (x - offX) / (IW * sx);
      return 113 + 9 * Math.exp(-(((u - 0.5) / 0.11) ** 2));
    };

    function layout() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      phone = W <= 640;

      sy = (H * (phone ? 0.2 : 0.235)) / (IH - 111);
      sx = Math.max(W / IW, sy * 0.72);
      offX = (W - IW * sx) / 2;
      drawBg();

      const ctaBottom = copy.offsetTop + ctas.offsetTop + ctas.offsetHeight;
      let silW: number;
      let silH: number;
      let silX: number;
      if (phone) {
        silW = Math.min(W * 0.8, 340);
        silH = silW * SIL_RATIO;
        silX = W * 0.5 - silW * 0.47;
      } else {
        silH = Math.max(300, Math.min(H * 0.64, H - ctaBottom + 36, 660));
        silW = silH / SIL_RATIO;
        silX = W * 0.54 - silW * 0.5;
      }
      const silY = H - silH + 2;
      Object.assign(person.style, { left: `${silX}px`, top: `${silY}px`, width: `${silW}px` });
      headX = silX + silW * 0.62;

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
        ax = Math.max(24, silX + silW * 0.45 - aw);
        ay = Math.min(silY + silH * 0.57, H - ah - 28);
        cx = Math.min(silX + silW * 0.9 + 12, W - cw - 28);
        cy = Math.min(silY + silH * 0.47, H - ch - 28);
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
        const base = rowY(glowRow(x)) + pitch * 0.4;
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
      glow.onload = null;
    };
  }, []);

  return (
    <section className={s.hero} ref={heroRef} aria-label={site.name}>
      <canvas className={s.bg} ref={bgRef} aria-hidden="true" />
      <svg className={s.eq} ref={eqRef} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element -- positioned by the layout code */}
      <img className={s.person} ref={personRef} src={SILHOUETTE_SRC} alt="" decoding="async" />

      <header className={s.nav}>
        <a className={s.brand} href="#" aria-label={`${site.name} home`}>
          <Logo className={s.logo} />
          {site.name}
        </a>
        <nav className={s.links} aria-label="Primary">
          {nav.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
              {item.caret && <Chevron />}
            </a>
          ))}
        </nav>
        <button className={s.burger} aria-label="Open menu">
          <span />
          <span />
        </button>
      </header>

      <div className={s.copy} ref={copyRef}>
        <h1 className={s.title}>
          <span className={s.l1}>Pick openers</span> <span className={s.l2}>who bring</span>{" "}
          <span className={s.l3}>a crowd of their own</span>
        </h1>
        <p className={s.sub}>{site.description}</p>
        <div className={s.ctas} ref={ctasRef}>
          <a className={`${s.btn} ${s.btnCream}`} href={site.demoHref}>
            Book a Demo
          </a>
          <a className={`${s.btn} ${s.btnGlass}`} href={site.tryHref}>
            Try a Show
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
