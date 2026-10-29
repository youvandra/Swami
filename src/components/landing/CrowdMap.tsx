"use client";

import { useMemo, useState } from "react";
import { CHICAGO_HOODS, MAP_H, MAP_W, buildDots, heat, type Layer } from "@/lib/crowdmap";
import s from "./CrowdMap.module.css";

type View = Layer;

const VIEWS: { id: View; label: string }[] = [
  { id: "headliner", label: "Headliner Fans" },
  { id: "opener", label: "Opener Fans" },
  { id: "gain", label: "Added Crowd" },
];

export function CrowdMap() {
  const [view, setView] = useState<View>("gain");

  const dots = useMemo(() => buildDots(CHICAGO_HOODS, view), [view]);
  const hoods = useMemo(
    () =>
      CHICAGO_HOODS.filter((h) => h.name !== "West Loop")
        .map((h) => ({ ...h, v: heat(CHICAGO_HOODS, view, h.x, h.y) }))
        .sort((a, b) => b.v - a.v),
    [view],
  );

  return (
    <section className={`${s.section} on-dark`} id="map">
      <div className={`wrap ${s.grid}`}>
        <div className={s.copy}>
          <span className="eyebrow">Added Crowd</span>
          <h2 className="display">See the crowd an opener brings with them.</h2>
          <p className="lead">
            Swami maps where each act&apos;s fans live, neighbourhood by neighbourhood. The opener worth booking is
            strong exactly where the headliner runs cold.
          </p>

          <div className={s.formula}>
            <div className={s.eq}>
              score = <em>fit</em> × <em>reach gain</em>
            </div>
            <dl className={s.terms}>
              <div>
                <dt>fit</dt>
                <dd>How much the headliner&apos;s fans like this act.</dd>
              </div>
              <div>
                <dt>reach gain</dt>
                <dd>Fans of this act in neighbourhoods where the headliner is weak.</dd>
              </div>
            </dl>
            <p className={s.rule}>The agent reads your request and proposes candidates. Plain, tested code computes every score.</p>
          </div>
        </div>

        <div className={s.board}>
          <div className={s.tabs} role="tablist" aria-label="Map layer">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={view === v.id ? s.tabOn : s.tab}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className={s.mapWrap}>
            <svg className={s.map} viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`Chicago, ${view} heat by neighbourhood`}>
              {dots.map((d) => (
                <rect key={`${d.x}-${d.y}`} x={d.x} y={d.y} width={d.size} height={d.size} rx={1} fill={d.fill} />
              ))}
              <text x={438} y={150} className={s.lake} transform="rotate(90 438 150)">
                LAKE MICHIGAN
              </text>
            </svg>
            <span className={s.city}>Chicago · Marlow Vane + Halcyon Drive</span>
          </div>

          <ul className={s.hoods}>
            {hoods.map((h) => (
              <li key={h.name}>
                <span>{h.name}</span>
                <span className={s.meter}>
                  <i style={{ width: `${Math.round(h.v * 100)}%` }} />
                </span>
                <b>{Math.round(h.v * 100)}</b>
              </li>
            ))}
          </ul>
          <p className={s.foot}>Illustrative data. In the product every number is audience affinity from the Qloo taste graph, and it is labelled that way.</p>
        </div>
      </div>
    </section>
  );
}
