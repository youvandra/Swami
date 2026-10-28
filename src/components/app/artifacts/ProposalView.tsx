"use client";

import { useEffect, useRef, useState } from "react";
import type { Artifact, ProposalSection, ProposalTemplate } from "@/lib/agent/types";
import { TEMPLATES, draftProposal, templateOf } from "@/lib/proposal";
import { Logo } from "../../landing/Logo";
import { IconChevron, IconClose, IconPlus } from "../icons";
import { sourceOf } from "./source";
import s from "./ProposalView.module.css";

type Proposal = Extract<Artifact, { type: "proposal" }>;

const sid = () => Math.random().toString(36).slice(2, 9);
const withIds = (xs: ProposalSection[]) => xs.map((x, i) => (x.id ? x : { ...x, id: `s${i}` }));
const words = (p: Proposal) => p.sections.reduce((n, x) => n + (x.body.trim() ? x.body.trim().split(/\s+/).length : 0), 0);

// Every text on the page is editable in place and saved when it loses focus.
// readOnly renders the same page for printing.
export function ProposalView({ artifact, onChange, readOnly = false }: { artifact: Proposal; onChange?: (a: Proposal) => void; readOnly?: boolean }) {
  const { show } = artifact;
  const sections = withIds(artifact.sections);
  const tpl = templateOf(artifact.template);
  const headline = artifact.headline ?? `${artifact.picks[0].name} for ${show.headliner}`;
  const [focusId, setFocusId] = useState<string | null>(null);
  const page = useRef<HTMLElement>(null);

  const commit = (patch: Partial<Proposal>) =>
    onChange?.({ ...artifact, sections, ...patch, subtitle: `Draft · ${(patch.sections ?? sections).length} sections` });
  const text = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();
  const edit = (current: string, apply: (v: string) => Partial<Proposal>) =>
    readOnly
      ? {}
      : {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const v = text(e);
            if (v !== current) commit(apply(v));
          },
        };
  const setSection = (i: number, patch: Partial<ProposalSection>) => sections.map((x, j) => (j === i ? { ...x, ...patch } : x));

  // a new section lands with its heading selected, ready to type over
  useEffect(() => {
    if (!focusId) return;
    const el = page.current?.querySelector<HTMLElement>(`[data-heading="${focusId}"]`);
    if (!el) return;
    el.focus();
    document.getSelection()?.selectAllChildren(el);
    setFocusId(null);
  }, [focusId, sections.length]);

  const move = (i: number, d: -1 | 1) => {
    const next = [...sections];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    commit({ sections: next });
  };

  const redraft = (t: ProposalTemplate) => {
    if (t === (artifact.template ?? "promoter")) return;
    if (!window.confirm(`Redraft as “${templateOf(t).label}”? Section text is replaced; picks, sender and date stay.`)) return;
    const d = draftProposal(t, show, artifact.picks, artifact.facts);
    commit({ template: d.template, headline: d.headline, to: d.to, title: d.title, sections: d.sections });
  };

  return (
    <div className={readOnly ? s.print : s.desk}>
      {!readOnly && (
        <div className={s.toolbar}>
          <label className={s.template}>
            <span>Template</span>
            <b>{tpl.label}</b>
            <IconChevron />
            <select value={artifact.template ?? "promoter"} onChange={(e) => redraft(e.target.value as ProposalTemplate)} aria-label="Template">
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <span className={s.stats}>
            {sections.length} sections · {words(artifact)} words · saves as you type
          </span>
          <button
            className={s.add}
            onClick={() => {
              const id = sid();
              commit({ sections: [...sections, { id, heading: "New section", body: "" }] });
              setFocusId(id);
            }}
          >
            <IconPlus />
            Add section
          </button>
        </div>
      )}

      <article className={s.page} ref={page}>
        <header className={s.cover}>
          <div className={s.brand}>
            <Logo className={s.logo} />
            <span>{tpl.kicker}</span>
          </div>
          <h1 className={s.h1} {...edit(headline, (v) => ({ headline: v || headline }))}>
            {headline}
          </h1>
          <p className={s.lede}>
            {[show.venue, show.city].filter(Boolean).join(", ")} · {show.date} · {show.capacity.toLocaleString("en-US")} capacity{show.capacityAssumed ? " (assumed)" : ""}
          </p>
          <dl className={s.meta}>
            <div>
              <dt>To</dt>
              <dd {...edit(artifact.to, (to) => ({ to }))}>{artifact.to}</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd {...edit(artifact.from, (from) => ({ from }))}>{artifact.from}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd {...edit(artifact.date, (date) => ({ date }))}>{artifact.date}</dd>
            </div>
          </dl>
        </header>

        {sections.map((sec, i) => (
          <section key={sec.id} className={s.section}>
            <h2>
              <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
              <span data-heading={sec.id} className={s.heading} {...edit(sec.heading, (heading) => ({ sections: setSection(i, { heading: heading || "Untitled" }) }))}>
                {sec.heading}
              </span>
            </h2>
            <p className={s.body} data-placeholder="Write this section…" {...edit(sec.body, (body) => ({ sections: setSection(i, { body }) }))}>
              {sec.body}
            </p>
            {!readOnly && (
              <div className={s.secTools}>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move “${sec.heading}” up`}>
                  <IconChevron className={s.up} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`Move “${sec.heading}” down`}>
                  <IconChevron />
                </button>
                <button
                  onClick={() => {
                    if (sec.body.trim() && !window.confirm(`Delete “${sec.heading}”?`)) return;
                    commit({ sections: sections.filter((_, j) => j !== i) });
                  }}
                  aria-label={`Delete “${sec.heading}”`}
                >
                  <IconClose />
                </button>
              </div>
            )}
          </section>
        ))}

        <section className={s.section}>
          <h2>
            <span className={s.num}>{String(sections.length + 1).padStart(2, "0")}</span>
            <span className={s.heading}>Ranked picks</span>
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
                  {!readOnly && (
                    <td className={s.pickTool}>
                      {artifact.picks.length > 1 && (
                        <button onClick={() => commit({ picks: artifact.picks.filter((_, j) => j !== i) })} aria-label={`Remove ${p.name}`}>
                          <IconClose />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className={s.foot}>Scores show audience affinity from {sourceOf(artifact)}. Prepared with Swami.</footer>
      </article>
    </div>
  );
}
