"use client";

import { dismissToast, useToast } from "@/lib/toast";
import { IconCheck } from "./icons";
import s from "./Toaster.module.css";

export function Toaster() {
  const t = useToast();
  if (!t) return null;
  return (
    <div className={s.toast} role="status" key={t.id}>
      <IconCheck className={s.icon} />
      <span>{t.text}</span>
      {t.action && (
        <button
          className={s.action}
          onClick={() => {
            t.action!.run();
            dismissToast();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}
