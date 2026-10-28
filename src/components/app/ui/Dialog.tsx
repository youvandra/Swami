"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "../icons";
import s from "./Dialog.module.css";

type Props = {
  title: string;
  onClose: () => void;
  /** The primary action submits the dialog's form, so Enter in a field does it too. */
  onSubmit: () => void;
  primary: string;
  /** The quiet action; it closes the dialog. */
  secondary?: string;
  disabled?: boolean;
  /** "danger" for the one action that cannot be taken back. */
  tone?: "danger";
  children: ReactNode;
};

// The app's one dialog: native <dialog> for the focus trap and Esc, a header, the body, and a footer with one navy
// primary action and a quiet way out.
export function Dialog({ title, onClose, onSubmit, primary, secondary = "Cancel", disabled, tone, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className={s.dialog} aria-label={title} onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onSubmit();
        }}
      >
        <header className={s.head}>
          <h2>{title}</h2>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        {children}
        <footer className={s.foot}>
          <button type="button" className={s.quiet} onClick={onClose}>
            {secondary}
          </button>
          <button type="submit" className={s.primary} data-tone={tone} disabled={disabled}>
            {primary}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
