"use client";

import type { Artifact } from "@/lib/agent/types";
import { IconUsers } from "../icons";
import k from "./kit.module.css";
import s from "./RoutingView.module.css";

type Routing = Extract<Artifact, { type: "routing" }>;

export function RoutingView({ artifact, onAsk }: { artifact: Routing; onAsk: (p: string) => void }) {
  const { stops, show } = artifact;
  const miles = stops.reduce((n, st) => n + st.milesFromPrev, 0);
  const best = Math.max(...stops.map((st) => st.affinity));

  return (
    <div className={k.wrap}>
      <div className={s.strip} aria-label="Suggested order">
        {stops.map((st, i) => (
          <div key={st.city} className={s.stop} data-strong={st.affinity >= 0.8 || undefined}>
            <span className={s.dot}>{i + 1}</span>
            <b>{st.city}</b>
            <span>{i === 0 ? "Start" : `${st.milesFromPrev} mi`}</span>
          </div>
        ))}
      </div>
      <div className={s.totals}>
        <span>
          <b className={k.num}>{stops.length}</b> stops
        </span>
        <span>
          <b className={k.num}>{miles.toLocaleString("en-US")}</b> miles
        </span>
        <span>
          <b className={k.num}>{stops.filter((st) => st.affinity >= 0.8).length}</b> strong markets
        </span>
      </div>

      <div className={s.table}>
        <div className={`${s.row} ${k.th}`}>
          <span>City</span>
          <span>Fan affinity</span>
          <span>Room</span>
          <span />
        </div>
        {stops.map((st) => (
          <div key={st.city} className={s.row}>
            <span className={s.city}>
              <b>
                {st.city}, {st.region}
              </b>
              <span>{st.note}</span>
            </span>
            <span className={s.aff}>
              <span className={`${k.bar} ${st.affinity === best ? k.barHot : ""}`}>
                <i style={{ width: `${Math.round(st.affinity * 100)}%` }} />
              </span>
              <b className={k.num}>{st.affinity.toFixed(2)}</b>
            </span>
            <span className={s.room}>{st.room}</span>
            <button className={k.act} onClick={() => onAsk(`Find an opener for ${show.headliner} in ${st.city}.`)}>
              <IconUsers />
              Openers
            </button>
          </div>
        ))}
      </div>
      <p className={k.note}>Affinity compares {show.headliner} fans in each city with the national baseline. Miles are road distance from the previous stop.</p>
    </div>
  );
}
