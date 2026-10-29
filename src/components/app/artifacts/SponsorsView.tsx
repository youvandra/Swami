"use client";

import type { Artifact } from "@/lib/agent/types";
import { IconMail } from "../icons";
import { isLive } from "./source";
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
      <ul className={s.list}>
        {sponsors.map((sp, i) => (
          <li key={sp.brand} className={s.item}>
            <span className={s.mono} aria-hidden="true">
              {initials(sp.brand)}
            </span>
            <div className={s.main}>
              <div className={s.top}>
                <h3>{sp.brand}</h3>
                {i === 0 && <span className={k.best}>Best Match</span>}
              </div>
              <p className={s.meta}>
                {sp.category} · {Math.round(sp.fit * 100)} fit
              </p>
              <p className={s.pitch}>{sp.pitch}</p>
            </div>
            <div className={s.side}>
              {sp.broad ? (
                <span className={s.lift}>
                  <b className={k.num}>#{i + 1}</b>
                  <span>fan pick</span>
                </span>
              ) : (
                <span className={s.lift}>
                  <b className={k.num}>{sp.lift.toFixed(1)}×</b>
                  <span>likelier to buy</span>
                </span>
              )}
              <button
                className={k.iconAct}
                onClick={() => onAsk(`Draft a sponsor pitch email to ${sp.brand} for ${show.headliner} in ${show.city} on ${show.date}.`)}
                aria-label={`Draft a pitch to ${sp.brand}`}
                data-tip="Draft pitch email"
                data-tip-pos="end"
              >
                <IconMail />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className={k.note}>
        {sponsors.some((sp) => sp.broad)
          ? `${show.headliner} fans buy like the public at large, so no brand stands out above average; these are the brands they pick most`
          : `Lift compares how often ${show.headliner} fans buy each brand with the average fan`}
        , from {isLive(artifact) ? "Qloo brand affinity" : "made-up demo data, brand names included"}.
      </p>
    </div>
  );
}
