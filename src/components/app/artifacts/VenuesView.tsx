"use client";

import type { Artifact } from "@/lib/agent/types";
import { IconMail, IconPin } from "../icons";
import k from "./kit.module.css";
import s from "./VenuesView.module.css";

type Venues = Extract<Artifact, { type: "venues" }>;

export function VenuesView({ artifact, onAsk }: { artifact: Venues; onAsk: (p: string) => void }) {
  const { venues, show } = artifact;
  return (
    <div className={k.wrap}>
      <div className={s.list}>
        {venues.map((v, i) => (
          <article key={v.name} className={s.card} data-top={i === 0 || undefined}>
            <div className={s.head}>
              <span className={s.rank}>{i + 1}</span>
              <div className={s.name}>
                <h3>{v.name}</h3>
                <span>
                  <IconPin />
                  {v.hood} · {v.capacity.toLocaleString("en-US")} cap
                </span>
              </div>
              <div className={s.fit}>
                <b className={k.num}>{Math.round(v.fit * 100)}</b>
                <span>fit</span>
              </div>
            </div>
            <div className={s.capRow}>
              <span className={s.capLabel}>Room vs. the {show.capacity.toLocaleString("en-US")} you need</span>
              <span className={s.cap}>
                <i style={{ width: `${Math.min(100, (v.capacity / 2200) * 100)}%` }} />
                <em style={{ left: `${(show.capacity / 2200) * 100}%` }} />
              </span>
            </div>
            <p className={s.note}>{v.note}</p>
            <div className={s.foot}>
              <div className={s.tags}>
                {v.tags.map((t) => (
                  <span key={t} className={k.chip}>
                    {t}
                  </span>
                ))}
              </div>
              <button className={k.act} onClick={() => onAsk(`Email ${v.name} to request a hold for ${show.headliner} on ${show.date} in ${show.city}.`)}>
                <IconMail />
                Request a hold
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className={k.note}>Fit is how often {show.headliner} fans visit each venue, against the city baseline. The marker on each bar is your target capacity.</p>
    </div>
  );
}
