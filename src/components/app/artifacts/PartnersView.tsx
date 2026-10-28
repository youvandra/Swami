"use client";

import type { Artifact, Partner } from "@/lib/agent/types";
import { IconMail } from "../icons";
import k from "./kit.module.css";
import s from "./PartnersView.module.css";

type Partners = Extract<Artifact, { type: "partners" }>;

const KIND_MARK: Record<Partner["kind"], string> = { Bar: "B", Restaurant: "R", "Record shop": "V", Café: "C" };

export function PartnersView({ artifact, onAsk }: { artifact: Partners; onAsk: (p: string) => void }) {
  const { partners, show } = artifact;
  const hoods = [...new Set(partners.map((p) => p.hood))];

  return (
    <div className={k.wrap}>
      <div className={s.summary}>
        {hoods.map((h) => (
          <div key={h}>
            <b className={k.num}>{partners.filter((p) => p.hood === h).length}</b>
            <span>{h}</span>
          </div>
        ))}
      </div>

      <ul className={s.list}>
        {partners.map((p) => (
          <li key={p.name} className={s.item}>
            <span className={s.mark} aria-hidden="true">
              {KIND_MARK[p.kind]}
            </span>
            <div className={s.main}>
              <div className={s.top}>
                <h3>{p.name}</h3>
                <span className={s.meta}>
                  {p.kind} · {p.hood}
                </span>
              </div>
              <p className={s.angle}>{p.angle}</p>
              <div className={s.bottom}>
                <span className={s.fit}>
                  <span className={k.bar}>
                    <i style={{ width: `${Math.round(p.fit * 100)}%` }} />
                  </span>
                  <span>{Math.round(p.fit * 100)} fit</span>
                </span>
                <button className={k.act} onClick={() => onAsk(`Draft an email to ${p.name} about co-promoting ${show.headliner} in ${show.city} on ${show.date}.`)}>
                  <IconMail />
                  Draft outreach
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className={k.note}>Fit is how much each place&apos;s regulars overlap with the added crowd. Give every partner its own promo link so the door count shows which one sold.</p>
    </div>
  );
}
