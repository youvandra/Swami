"use client";

import type { Artifact } from "@/lib/agent/types";
import { IconMail } from "../icons";
import k from "./kit.module.css";
import s from "./VenuesView.module.css";

type Venues = Extract<Artifact, { type: "venues" }>;

export function VenuesView({ artifact, onAsk }: { artifact: Venues; onAsk: (p: string) => void }) {
  const { venues, show } = artifact;
  const biggest = Math.max(...venues.map((v) => v.capacity), show.capacity);
  return (
    <div className={k.wrap}>
      <ul className={s.list}>
        {venues.map((v, i) => {
          const fitsRoom = v.capacity >= show.capacity * 0.9 && v.capacity <= show.capacity * 1.5;
          return (
            <li key={v.name} className={s.item}>
              <span className={s.rank}>{i + 1}</span>
              <div className={s.main}>
                <div className={s.top}>
                  <h3>{v.name}</h3>
                  {i === 0 && <span className={k.best}>Best fit</span>}
                </div>
                <p className={s.meta}>
                  {v.hood} · {v.capacity.toLocaleString("en-US")} cap · {v.tags.join(", ")}
                </p>
                <p className={s.note}>{v.note}</p>
                <div className={s.cap} aria-label={`${v.capacity} capacity against ${show.capacity} needed`}>
                  <span className={s.capBar}>
                    <i style={{ width: `${(v.capacity / biggest) * 100}%` }} data-fits={fitsRoom || undefined} />
                    <em style={{ left: `${(show.capacity / biggest) * 100}%` }} />
                  </span>
                  <span className={s.capText}>{fitsRoom ? "Right size" : v.capacity < show.capacity ? "Small" : "Large"}</span>
                </div>
              </div>
              <div className={s.side}>
                <b className={k.num}>{Math.round(v.fit * 100)}</b>
                <span>fit</span>
              </div>
              <button
                className={k.iconAct}
                onClick={() => onAsk(`Email ${v.name} to request a hold for ${show.headliner} on ${show.date} in ${show.city}.`)}
                aria-label={`Request a hold at ${v.name}`}
                data-tip="Request a hold"
                data-tip-pos="end"
              >
                <IconMail />
              </button>
            </li>
          );
        })}
      </ul>
      <p className={k.note}>Fit is how often {show.headliner} fans go to each venue, against the city average. The tick on each bar marks the {show.capacity.toLocaleString("en-US")} capacity you need.</p>
    </div>
  );
}
