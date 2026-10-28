"use client";

import type { Artifact, Partner } from "@/lib/agent/types";
import { IconBar, IconCoffee, IconFood, IconMail, IconVinyl } from "../icons";
import k from "./kit.module.css";
import s from "./PartnersView.module.css";

type Partners = Extract<Artifact, { type: "partners" }>;

const KIND_ICON: Record<Partner["kind"], (p: { className?: string; weight?: "duotone" }) => React.ReactNode> = {
  Bar: IconBar,
  Restaurant: IconFood,
  "Record shop": IconVinyl,
  Café: IconCoffee,
};

export function PartnersView({ artifact, onAsk }: { artifact: Partners; onAsk: (p: string) => void }) {
  const { partners, show } = artifact;
  return (
    <div className={k.wrap}>
      <ul className={s.list}>
        {partners.map((p, i) => {
          const Icon = KIND_ICON[p.kind];
          return (
            <li key={p.name} className={s.item}>
              <span className={s.icon}>
                <Icon weight="duotone" />
              </span>
              <div className={s.main}>
                <div className={s.top}>
                  <h3>{p.name}</h3>
                  {i === 0 && <span className={k.best}>Best fit</span>}
                </div>
                <p className={s.meta}>
                  {p.kind} · {p.hood} · {Math.round(p.fit * 100)} fit
                </p>
                <p className={s.angle}>{p.angle}</p>
              </div>
              <button
                className={k.iconAct}
                onClick={() => onAsk(`Draft an email to ${p.name} about co-promoting ${show.headliner} in ${show.city} on ${show.date}.`)}
                aria-label={`Draft an email to ${p.name}`}
                data-tip="Draft outreach email"
                data-tip-pos="end"
              >
                <IconMail />
              </button>
            </li>
          );
        })}
      </ul>
      <p className={k.note}>Fit is how much each place&apos;s regulars overlap with the added crowd. Give each partner its own promo link to see which one sold.</p>
    </div>
  );
}
