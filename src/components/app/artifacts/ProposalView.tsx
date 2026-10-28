"use client";

import type { Artifact } from "@/lib/agent/types";
import { Logo } from "../../landing/Logo";
import s from "./ProposalView.module.css";

type Proposal = Extract<Artifact, { type: "proposal" }>;

// Recipient, sender and section text are editable in place; each edit is saved when the field loses focus.
export function ProposalView({ artifact, onChange }: { artifact: Proposal; onChange: (a: Proposal) => void }) {
  const { show } = artifact;
  const commit = (patch: Partial<Proposal>) => onChange({ ...artifact, ...patch });
  const text = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.innerText ?? "").trim();
  return (
    <div className={s.desk}>
      <article className={s.page}>
        <header className={s.cover}>
          <div className={s.brand}>
            <Logo className={s.logo} />
            <span>Opener proposal</span>
          </div>
          <h1 className={s.h1}>
            {artifact.picks[0].name} for {show.headliner}
          </h1>
          <p className={s.lede}>
            {show.venue}, {show.city} · {show.date} · {show.capacity.toLocaleString("en-US")} capacity
          </p>
          <dl className={s.meta}>
            <div>
              <dt>To</dt>
              <dd contentEditable suppressContentEditableWarning onBlur={(e) => text(e) !== artifact.to && commit({ to: text(e) })}>
                {artifact.to}
              </dd>
            </div>
            <div>
              <dt>From</dt>
              <dd contentEditable suppressContentEditableWarning onBlur={(e) => text(e) !== artifact.from && commit({ from: text(e) })}>
                {artifact.from}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{artifact.date}</dd>
            </div>
          </dl>
        </header>

        {artifact.sections.map((sec, i) => (
          <section key={sec.heading} className={s.section}>
            <h2>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {sec.heading}
            </h2>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const body = text(e);
                if (body !== sec.body) commit({ sections: artifact.sections.map((x, j) => (j === i ? { ...x, body } : x)) });
              }}
            >
              {sec.body}
            </p>
          </section>
        ))}

        <section className={s.section}>
          <h2>
            <span>{String(artifact.sections.length + 1).padStart(2, "0")}</span>
            Ranked picks
          </h2>
          <table className={s.picks}>
            <tbody>
              {artifact.picks.map((p, i) => (
                <tr key={p.name}>
                  <td className={s.pickRank}>{i + 1}</td>
                  <td>
                    <b>{p.name}</b>
                    <span>{p.why}</span>
                  </td>
                  <td className={s.pickScore}>{p.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className={s.foot}>Scores show audience affinity from the Qloo taste graph. Prepared with Swami.</footer>
      </article>
    </div>
  );
}
