"use client";

import { askMap, findArtifactFor } from "@/lib/agent/ask";
import type { Artifact } from "@/lib/agent/types";
import { updateArtifact, useCanEdit } from "@/lib/store";
import { AudienceView } from "./artifacts/AudienceView";
import { CrowdMapView } from "./artifacts/CrowdMapView";
import { EmailView } from "./artifacts/EmailView";
import { OpenerRanking } from "./artifacts/OpenerRanking";
import { PartnersView } from "./artifacts/PartnersView";
import { ProposalView } from "./artifacts/ProposalView";
import { RoutingView } from "./artifacts/RoutingView";
import { SponsorsView } from "./artifacts/SponsorsView";
import { VenuesView } from "./artifacts/VenuesView";
import { toPlainText } from "./artifacts/export";
import { ARTIFACT_LABEL, artifactIcon } from "./artifacts/meta";
import { ExportMenu } from "./ExportMenu";
import { Fragment, useEffect, useRef, useState } from "react";
import { IconChevron, IconClose, IconCopy } from "./icons";
import { Dropdown } from "./ui/Dropdown";
import { SaveMenu } from "./SaveMenu";
import s from "./ArtifactPanel.module.css";

export { artifactIcon };

type Props = {
  artifacts: Artifact[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onAsk: (prompt: string) => void;
  onToast: (msg: string) => void;
  conversationId?: string;
  defaultProjectId?: string;
  /** Takes a result off the panel (it stays in the chat as a chip). Without it, tabs have no close button. */
  onHide?: (id: string) => void;
  /** Which ask a result came from, so tabs from different asks get a divider. */
  turnOf?: (id: string) => number;
};

// Tabs on the strip; older ones wait behind the "+N" list.
const STRIP = 6;

export function ArtifactPanel({ artifacts, activeId, onSelect, onClose, onAsk, onToast, conversationId, defaultProjectId, onHide, turnOf }: Props) {
  const canEdit = useCanEdit();
  const active = artifacts.find((a) => a.id === activeId) ?? artifacts[artifacts.length - 1];
  // the newest tabs, and the open one wherever it is
  const recent = artifacts.slice(-STRIP);
  const strip = recent.includes(active) ? recent : artifacts.filter((a) => a === active || recent.slice(1).includes(a));
  const rest = artifacts.filter((a) => !strip.includes(a));
  const tabs = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = tabs.current;
    if (el) setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  useEffect(() => {
    const el = tabs.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [strip.length]);
  useEffect(() => {
    tabs.current?.querySelector<HTMLElement>(`[data-tab="${active.id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active.id]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const go = (j: number) => {
      const a = strip[(j + strip.length) % strip.length];
      onSelect(a.id);
      tabs.current?.querySelector<HTMLElement>(`[data-tab="${a.id}"] [role=tab]`)?.focus();
    };
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(strip.length - 1);
    else if ((e.key === "Delete" || e.key === "Backspace") && onHide) onHide(strip[i].id);
    else return;
    e.preventDefault();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(active));
      onToast("Copied to clipboard");
    } catch {
      onToast("Clipboard is blocked in this browser");
    }
  };

  return (
    <aside className={s.panel} aria-label="Results">
      <div className={s.head}>
        <div className={s.strip} data-left={edges.left || undefined} data-right={edges.right || undefined}>
          {edges.left && (
            <button className={s.scroll} data-side="left" onClick={() => tabs.current?.scrollBy({ left: -200, behavior: "smooth" })} aria-label="Scroll tabs left" tabIndex={-1}>
              <IconChevron />
            </button>
          )}
          <div
            className={s.tabs}
            role="tablist"
            aria-label="Results"
            ref={tabs}
            onScroll={measure}
            onWheel={(e) => {
              if (tabs.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) tabs.current.scrollLeft += e.deltaY;
            }}
          >
            {strip.map((a, i) => {
              const Icon = artifactIcon(a.type);
              const newTurn = i > 0 && turnOf && turnOf(a.id) !== turnOf(strip[i - 1].id);
              return (
                <Fragment key={a.id}>
                  {newTurn && <span className={s.divider} aria-hidden />}
                  <span className={s.tabWrap} data-tab={a.id} data-active={a.id === active.id || undefined}>
                    <button role="tab" aria-selected={a.id === active.id} tabIndex={a.id === active.id ? 0 : -1} className={s.tab} onClick={() => onSelect(a.id)} onKeyDown={(e) => onTabKey(e, i)} title={a.title}>
                      <Icon />
                      <span>{ARTIFACT_LABEL[a.type]}</span>
                    </button>
                    {onHide && (
                      <button className={s.tabClose} onClick={() => onHide(a.id)} aria-label={`Close ${ARTIFACT_LABEL[a.type]} tab`} tabIndex={-1}>
                        <IconClose />
                      </button>
                    )}
                  </span>
                </Fragment>
              );
            })}
          </div>
          {edges.right && (
            <button className={s.scroll} data-side="right" onClick={() => tabs.current?.scrollBy({ left: 200, behavior: "smooth" })} aria-label="Scroll tabs right" tabIndex={-1}>
              <IconChevron />
            </button>
          )}
        </div>
        {rest.length > 0 && (
          <Dropdown className={s.more} label="More results" value={active.id} align="end" options={rest.map((a) => ({ value: a.id, label: ARTIFACT_LABEL[a.type], hint: a.title }))} onChange={onSelect}>
            +{rest.length}
          </Dropdown>
        )}
        <button className={s.iconBtn} onClick={onClose} aria-label="Close results" data-tip="Close" data-tip-pos="end">
          <IconClose />
        </button>
      </div>

      <div className={s.titleRow}>
        <div className={s.titleText}>
          <h2>{active.title}</h2>
          <p>
            {active.source !== "live" && (
              <span className={s.demo} data-tip="Made-up names and numbers, until a Qloo key is connected">
                Demo data
              </span>
            )}
            {active.subtitle}
          </p>
        </div>
        <div className={s.actions}>
          {canEdit && <SaveMenu artifact={active} conversationId={conversationId} defaultProjectId={defaultProjectId} onToast={onToast} />}
          <button className={s.action} onClick={copy} aria-label="Copy as text" data-tip="Copy as text">
            <IconCopy />
          </button>
          <ExportMenu artifact={active} onToast={onToast} className={`${s.action} ${s.primary}`} />
        </div>
      </div>

      <div className={s.body} key={active.id}>
        {active.type === "opener_ranking" && (
          <OpenerRanking
            artifact={active}
            onAsk={onAsk}
            onShowMap={(opener) => {
              const m = findArtifactFor(artifacts, { type: "crowd_map", headliner: active.show.headliner, city: active.show.city, opener });
              if (m) onSelect(m.id);
              else onAsk(askMap(active.show, opener));
            }}
          />
        )}
        {active.type === "crowd_map" && <CrowdMapView artifact={active} />}
        {active.type === "proposal" && <ProposalView artifact={active} onChange={updateArtifact} readOnly={!canEdit} />}
        {active.type === "routing" && <RoutingView artifact={active} onAsk={onAsk} />}
        {active.type === "venues" && <VenuesView artifact={active} onAsk={onAsk} />}
        {active.type === "partners" && <PartnersView artifact={active} onAsk={onAsk} />}
        {active.type === "sponsors" && <SponsorsView artifact={active} onAsk={onAsk} />}
        {active.type === "audience" && <AudienceView artifact={active} />}
        {active.type === "email" && <EmailView artifact={active} onChange={updateArtifact} readOnly={!canEdit} />}
      </div>
    </aside>
  );
}
