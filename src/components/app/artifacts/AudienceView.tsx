"use client";

import type { Artifact } from "@/lib/agent/types";
import { isLive } from "./source";
import k from "./kit.module.css";
import s from "./AudienceView.module.css";

type Audience = Extract<Artifact, { type: "audience" }>;

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function AudienceView({ artifact }: { artifact: Audience }) {
  const { audience, show, opener } = artifact;
  const max = Math.max(...audience.ages.flatMap((a) => [a.headliner, a.opener]));
  const under30 = (key: "headliner" | "opener") => audience.ages.slice(0, 2).reduce((n, a) => n + a[key], 0);
  // a side Qloo has no demographics for holds only the concert-going base, so it is shown as missing
  const gone = (key: "headliner" | "opener") => !!audience.missing?.includes(key);
  const stat = (key: "headliner" | "opener", v: number) => (gone(key) ? "—" : pct(v));
  const missingNames = [...(gone("headliner") ? [show.headliner] : []), ...(gone("opener") ? [opener] : [])];

  return (
    <div className={k.wrap}>
      <div className={s.legend}>
        <span>
          <i className={s.h} />
          {show.headliner}
        </span>
        <span>
          <i className={s.o} />
          {opener}
        </span>
      </div>

      <div className={s.kpis}>
        <div>
          <span>Under 30</span>
          <b className={k.num}>{stat("headliner", under30("headliner"))}</b>
          <em>
            → <b className={k.num}>{stat("opener", under30("opener"))}</b>
          </em>
        </div>
        <div>
          <span>Women</span>
          <b className={k.num}>{stat("headliner", audience.women.headliner)}</b>
          <em>
            → <b className={k.num}>{stat("opener", audience.women.opener)}</b>
          </em>
        </div>
      </div>

      {missingNames.length > 0 && <p className={k.note}>Qloo has no age or gender data for {missingNames.join(" or ")} yet.</p>}

      <section className={s.block}>
        <h3>Age</h3>
        <div className={s.ages}>
          {audience.ages.map((a) => (
            <div key={a.band} className={s.age}>
              <span className={s.band}>{a.band}</span>
              <div className={s.pair}>
                <span className={s.barH} style={{ width: gone("headliner") ? 0 : `${(a.headliner / max) * 86}%` }}>
                  <em>{stat("headliner", a.headliner)}</em>
                </span>
                <span className={s.barO} style={{ width: gone("opener") ? 0 : `${(a.opener / max) * 86}%` }}>
                  <em>{stat("opener", a.opener)}</em>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={s.block}>
        <h3>Taste Beyond Music</h3>
        <table className={s.traits}>
          <thead>
            <tr>
              <th />
              <th>{show.headliner}</th>
              <th>{opener}</th>
            </tr>
          </thead>
          <tbody>
            {audience.traits.map((t) => (
              <tr key={t.label}>
                <td>{t.label}</td>
                <td>{t.headliner}</td>
                <td>{t.opener}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className={k.note}>Shares of each act&apos;s fans in {show.city}, from {isLive(artifact) ? "Qloo demographics" : "made-up demo data"}. Use the gaps for ad targeting: the opener&apos;s younger fans need a different angle.</p>
    </div>
  );
}
