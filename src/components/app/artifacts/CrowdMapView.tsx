"use client";

import { useMemo, useState } from "react";
import type { Artifact } from "@/lib/agent/types";
import { MAP_H, MAP_W, buildDots, heat, isNamed, type Layer } from "@/lib/crowdmap";
import s from "./CrowdMapView.module.css";

type CrowdMap = Extract<Artifact, { type: "crowd_map" }>;

export function CrowdMapView({ artifact }: { artifact: CrowdMap }) {
  const [layer, setLayer] = useState<Layer>("gain");
  const { hoods, show, opener } = artifact;
  const dots = useMemo(() => buildDots(hoods, layer, artifact.show.city), [hoods, layer, artifact.show.city]);
  const rows = useMemo(
    () =>
      hoods
        .map((h) => ({ ...h, gain: heat(hoods, "gain", h.x, h.y), hl: heat(hoods, "headliner", h.x, h.y), op: heat(hoods, "opener", h.x, h.y) }))
        .sort((a, b) => b.gain - a.gain)
        .map((h, i, all) => ({ ...h, label: isNamed(h) ? h.name : `Area ${i + 1} of ${all.length}` })),
    [hoods],
  );
  // label the neighbourhoods that matter most; a dense map with every name on it is unreadable
  const pins = rows.filter(isNamed).slice(0, 7);

  const layers: { id: Layer; label: string }[] = [
    { id: "headliner", label: show.headliner },
    { id: "opener", label: opener },
    { id: "gain", label: "Added crowd" },
  ];

  return (
    <div className={s.wrap}>
      <div className={s.board}>
        <div className={s.layers} role="tablist" aria-label="Map layer">
          {layers.map((l) => (
            <button key={l.id} role="tab" aria-selected={layer === l.id} onClick={() => setLayer(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <svg className={s.map} viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`${show.city} heat by neighbourhood`}>
          {dots.map((d) => (
            <rect key={`${d.x}-${d.y}`} x={d.x} y={d.y} width={d.size} height={d.size} rx={1} fill={d.fill} />
          ))}
          {pins.map((h) => (
            <g key={h.name} className={s.pin}>
              <circle cx={h.x} cy={h.y} r={2.2} />
              <text x={h.x + 6} y={h.y + 3}>
                {h.name}
              </text>
            </g>
          ))}
        </svg>
        <div className={s.legend}>
          <span>Less</span>
          <i />
          <span>More</span>
        </div>
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th>Neighbourhood</th>
            <th>{show.headliner}</th>
            <th>{opener}</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r) => (
            <tr key={r.name}>
              <td>{r.label}</td>
              <td>{Math.round(r.hl * 100)}</td>
              <td>{Math.round(r.op * 100)}</td>
              <td>
                <div className={s.added}>
                  <span className={s.gain}>
                    <i style={{ width: `${Math.round(r.gain * 100)}%` }} />
                  </span>
                  <b>{Math.round(r.gain * 100)}</b>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={s.note}>Target the top rows with local ads and co-promotion. Rows near zero are places where the headliner already sells.</p>
    </div>
  );
}
