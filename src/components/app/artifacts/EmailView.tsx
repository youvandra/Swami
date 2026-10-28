"use client";

import { useState } from "react";
import type { Artifact } from "@/lib/agent/types";
import { IconMail } from "../icons";
import s from "./EmailView.module.css";

type Email = Extract<Artifact, { type: "email" }>;

// Fields are local while typing and saved when a field loses focus.
export function EmailView({ artifact, onChange }: { artifact: Email; onChange: (a: Email) => void }) {
  const [to, setTo] = useState(artifact.to);
  const [cc, setCc] = useState(artifact.cc);
  const [subject, setSubject] = useState(artifact.subject);
  const [body, setBody] = useState(artifact.body);

  const commit = () => {
    if (to !== artifact.to || cc !== artifact.cc || subject !== artifact.subject || body !== artifact.body) onChange({ ...artifact, to, cc, subject, body });
  };

  const mailto = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const words = body.trim().split(/\s+/).length;

  return (
    <div className={s.desk}>
      <div className={s.mail} onBlur={commit}>
        <label className={s.field}>
          <span>To</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className={s.field}>
          <span>Cc</span>
          <input value={cc} onChange={(e) => setCc(e.target.value)} />
        </label>
        <label className={s.field}>
          <span>Subject</span>
          <input className={s.subject} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <textarea className={s.body} value={body} onChange={(e) => setBody(e.target.value)} rows={14} aria-label="Body" />
        <div className={s.bar}>
          <span className={s.count}>{words} words</span>
          <a className={s.send} href={mailto}>
            <IconMail />
            Open in mail app
          </a>
        </div>
      </div>
      <p className={s.note}>Swami drafts; you send. Check the recipient and any terms before it goes out.</p>
    </div>
  );
}
