"use client";

import { useMemo, useState } from "react";
import type { Artifact } from "@/lib/agent/types";
import { IconChevron, IconDoc, IconInfo, IconMap } from "../icons";
import { sourceOf } from "./source";
import s from "./OpenerRanking.module.css";

type Ranking = Extract<Artifact, { type: "opener_ranking" }>;
type Filter = "all" | "roster" | "rising";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All acts" },
  { id: "roster", label: "On roster" },
  { id: "rising", label: "Rising" },
];

const Bar = ({ v }: { v: number }) => (
  <span className={s.bar}>
    <i style={{ width: `${Math.round(v * 100)}%` }} />
  </span>
);

export function OpenerRanking({ artifact, onAsk, onShowMap }: { artifact: Ranking; onAsk: (p: string) => void; onShowMap: (opener: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(artifact.rows[0]?.name ?? null);
  const { show } = artifact;
  // roster badges and the roster filter only mean something when a roster shaped the ranking
  const anyRoster = artifact.rows.some((r) => r.onRoster);
  const filters = anyRoster ? FILTERS : FILTERS.filter((f) => f.id !== "roster");

  const rows = useMemo(
    () => artifact.rows.filter((r) => (filter === "roster" ? r.onRoster : filter === "rising" ? r.rising : true)),
    [artifact.rows, filter],
  );

  return (
    <div className={s.wrap}>
      <dl className={s.show}>
        <div>
          <dt>Headliner</dt>
          <dd>{show.headliner}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{show.city}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{show.date}</dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>
            {show.venue ? `${show.venue} · ` : ""}
            {show.capacity.toLocaleString("en-US")} cap{show.capacityAssumed ? " (assumed)" : ""}
          </dd>
        </div>
      </dl>

      <div className={s.toolbar}>
        <div className={s.filters} role="radiogroup" aria-label="Filter">
          {filters.map((f) => (
            <button key={f.id} role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <span className={s.formula} tabIndex={0} aria-label="How scores work" data-tip="Score = fit × reach gain" data-tip-pos="end">
          <IconInfo />
        </span>
      </div>

      <div className={s.table}>
        <div className={`${s.row} ${s.th}`}>
          <span>#</span>
          <span>Act</span>
          <span>Fit</span>
          <span>Reach gain</span>
          <span className={s.right}>
            Score
          </span>
        </div>
        {rows.map((r) => {
          const rank = artifact.rows.indexOf(r) + 1;
          const isOpen = open === r.name;
          return (
            <div key={r.name} className={s.group} data-open={isOpen || undefined} data-top={rank === 1 || undefined}>
              <button className={s.row} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)}>
                <span className={s.rank}>
                  {rank}
                </span>
                <span className={s.act}>
                  <b>{r.name}</b>
                  <span className={s.meta}>
                    {r.genre}
                    {r.rising && <em className={s.tag}>Rising</em>}
                    {r.estimated && <em className={`${s.tag} ${s.est}`}>Estimated</em>}
                    {anyRoster && !r.onRoster && <em className={`${s.tag} ${s.off}`}>Off roster</em>}
                  </span>
                </span>
                <span className={s.metric}>
                  <Bar v={r.fit} />
                  {r.fit.toFixed(2)}
                </span>
                <span className={s.metric}>
                  <Bar v={r.reachGain} />
                  {r.reachGain.toFixed(2)}
                </span>
                <span className={s.score}>
                  {r.score.toFixed(2)}
                  <IconChevron className={s.chev} />
                </span>
              </button>
              {isOpen && (
                <div className={s.detail}>
                  <p>{r.why}</p>
                  <div className={s.hoods}>
                    <span>Strongest in</span>
                    {r.hoods.map((h) => (
                      <i key={h}>{h}</i>
                    ))}
                  </div>
                  <div className={s.detailActions}>
                    <button onClick={() => onShowMap(r.name)}>
                      <IconMap />
                      View crowd map
                    </button>
                    <button onClick={() => onAsk(`Write a proposal to ${show.headliner} management with ${r.name} as the opener in ${show.city}, ${show.date}.`)}>
                      <IconDoc />
                      Draft proposal with {r.name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className={s.none}>No acts match this filter.</p>}
      </div>

      <p className={s.note}>Fit and reach gain are audience affinity from {sourceOf(artifact)}. Estimated rows use genre and tag heat because the act&apos;s own data is thin.</p>
    </div>
  );
}
