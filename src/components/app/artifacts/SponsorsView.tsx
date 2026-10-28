"use client";

import type { Artifact } from "@/lib/agent/types";
import { IconMail } from "../icons";
import k from "./kit.module.css";
import s from "./SponsorsView.module.css";

type Sponsors = Extract<Artifact, { type: "sponsors" }>;

const initials = (b: string) =>
  b
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export function SponsorsView({ artifact, onAsk }: { artifact: Sponsors; onAsk: (p: string) => void }) {
  const { sponsors, show } = artifact;
  return (
    <div className={k.wrap}>
      <div className={s.grid}>
        {sponsors.map((sp, i) => (
          <article key={sp.brand} className={s.card} data-top={i === 0 || undefined}>
            <div className={s.head}>
              <span className={s.mono} aria-hidden="true">
                {initials(sp.brand)}
              </span>
              <div className={s.name}>
                <h3>{sp.brand}</h3>
                <span>{sp.category}</span>
              </div>
            </div>
            <div className={s.lift}>
              <b className={k.num}>{sp.lift.toFixed(1)}×</b>
              <span>likelier to buy than the average fan</span>
            </div>
            <div className={s.fit}>
              <span className={`${k.bar} ${i === 0 ? k.barHot : ""}`}>
                <i style={{ width: `${Math.round(sp.fit * 100)}%` }} />
              </span>
              <span>{Math.round(sp.fit * 100)} fit</span>
            </div>
            <p className={s.pitch}>{sp.pitch}</p>
            <button className={k.act} onClick={() => onAsk(`Draft a sponsor pitch email to ${sp.brand} for ${show.headliner} in ${show.city} on ${show.date}.`)}>
              <IconMail />
              Draft pitch
            </button>
          </article>
        ))}
      </div>
      <p className={k.note}>Lift compares how often {show.headliner} fans pick each brand with the national baseline, from Qloo brand affinity. Brand names here are examples.</p>
    </div>
  );
}
