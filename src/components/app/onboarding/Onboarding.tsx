"use client";

import { useMemo, useState } from "react";
import { ROLES, type Role } from "@/lib/model";
import { examplesFor } from "@/lib/examples";
import { parseRoster } from "@/lib/roster";
import { useServerStatus } from "@/lib/status";
import { saveRoster, updateWorkspace, useWorkspace } from "@/lib/store";
import { Logo } from "../../landing/Logo";
import { ChipInput } from "../ChipInput";
import { IconCheck, IconRoute, IconStore, IconTag, IconUsers } from "../icons";
import s from "./Onboarding.module.css";

const ROLE_ICON: Record<Role, (p: { className?: string; weight?: "regular" | "duotone" }) => React.ReactNode> = { promoter: IconStore, buyer: IconUsers, agent: IconRoute, manager: IconTag };
const CITY_IDEAS = ["Chicago", "Austin", "Brooklyn", "Los Angeles", "Seattle", "Denver", "Atlanta", "London"];

// Three short steps the first time someone opens the app. Everything can be changed later in Settings.
export function Onboarding() {
  const ws = useWorkspace();
  const [step, setStep] = useState(0);
  const example = examplesFor(useServerStatus().data === "live").mid;
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [roster, setRoster] = useState("");
  const acts = useMemo(() => parseRoster(roster), [roster]);

  const steps = ["Your role", "Your market", "Your artists"];
  const canNext = step === 0 ? !!role : step === 1 ? name.trim().length > 0 && cities.length > 0 : true;

  const finish = () => {
    updateWorkspace({ role: role ?? ws.role, name: name.trim() || ws.name, cities: cities.length ? cities : ws.cities, artists: artists.length ? artists : ws.artists, onboarded: true });
    if (acts.length) saveRoster(`${name.trim() || ws.name} roster`, acts);
  };

  const artistLabel = role === "manager" ? "Artists you manage" : role === "agent" ? "Artists you tour" : "Headliners you are booking";

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className={s.card}>
        <header className={s.head}>
          <Logo className={s.logo} />
          <ol className={s.progress} aria-label="Progress">
            {steps.map((label, i) => (
              <li key={label} data-state={i < step ? "done" : i === step ? "now" : undefined}>
                <span>{i < step ? <IconCheck /> : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <button className={s.skip} onClick={() => updateWorkspace({ onboarded: true })}>
            Skip for now
          </button>
        </header>

        {step === 0 && (
          <section className={s.body}>
            <h1 id="ob-title" className={s.title}>
              What do you do?
            </h1>
            <p className={s.lede}>Swami shapes its answers, templates and examples around your job.</p>
            <div className={s.roles} role="radiogroup">
              {ROLES.map((r) => {
                const Icon = ROLE_ICON[r.id];
                return (
                  <button key={r.id} role="radio" aria-checked={role === r.id} className={s.role} onClick={() => setRole(r.id)}>
                    <span className={s.roleIcon}>
                      <Icon weight="duotone" />
                    </span>
                    <b>{r.label}</b>
                    <span>{r.blurb}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className={s.body}>
            <h1 id="ob-title" className={s.title}>
              Where do you work?
            </h1>
            <p className={s.lede}>Your company name goes on proposals. Cities set the default market for maps and venues.</p>
            <label className={s.field}>
              <span>Company or workspace name</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Northside Live" />
            </label>
            <div className={s.field}>
              <span>Cities</span>
              <ChipInput label="Cities" values={cities} onChange={setCities} placeholder="Type a city and press Enter" suggestions={CITY_IDEAS} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={s.body}>
            <h1 id="ob-title" className={s.title}>
              Who are you working with?
            </h1>
            <p className={s.lede}>Swami suggests tasks for these artists first. Add a roster to rank openers inside it.</p>
            <div className={s.field}>
              <span>{artistLabel}</span>
              <ChipInput label={artistLabel} values={artists} onChange={setArtists} placeholder={example} />
            </div>
            <label className={s.field}>
              <span>
                Agency roster <em>optional</em>
              </span>
              <textarea value={roster} onChange={(e) => setRoster(e.target.value)} rows={4} placeholder={"One act per line, or Act, Genre\nHalcyon Drive, Indie rock\nPia Marsh, Alt R&B"} />
              {acts.length > 0 && (
                <small className={s.parsed}>
                  <IconCheck /> {acts.length} act{acts.length === 1 ? "" : "s"} found: {acts.slice(0, 4).map((a) => a.name).join(", ")}
                  {acts.length > 4 ? "…" : ""}
                </small>
              )}
            </label>
          </section>
        )}

        <footer className={s.foot}>
          {step > 0 ? (
            <button className="button button-line" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <button className="button button-ink" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button className="button button-ink" onClick={finish}>
              Start using Swami
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
