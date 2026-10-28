"use client";

import type { Artifact } from "@/lib/agent/types";
import { updateArtifact } from "@/lib/store";
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
import { IconClose, IconCopy } from "./icons";
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
};

export function ArtifactPanel({ artifacts, activeId, onSelect, onClose, onAsk, onToast, conversationId, defaultProjectId }: Props) {
  const active = artifacts.find((a) => a.id === activeId) ?? artifacts[artifacts.length - 1];

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
        <div className={s.tabs} role="tablist">
          {artifacts.map((a) => {
            const Icon = artifactIcon(a.type);
            return (
              <button key={a.id} role="tab" aria-selected={a.id === active.id} className={s.tab} onClick={() => onSelect(a.id)} title={a.title}>
                <Icon />
                <span>{ARTIFACT_LABEL[a.type]}</span>
              </button>
            );
          })}
        </div>
        <button className={s.iconBtn} onClick={onClose} aria-label="Close results">
          <IconClose />
        </button>
      </div>

      <div className={s.titleRow}>
        <div className={s.titleText}>
          <span className={s.kind}>{ARTIFACT_LABEL[active.type]}</span>
          <h2>{active.title}</h2>
          <p>{active.subtitle}</p>
        </div>
        <div className={s.actions}>
          <SaveMenu artifact={active} conversationId={conversationId} defaultProjectId={defaultProjectId} onToast={onToast} />
          <button className={s.action} onClick={copy} aria-label="Copy">
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
            onShowMap={() => {
              const m = artifacts.find((a) => a.type === "crowd_map");
              if (m) onSelect(m.id);
              else onAsk(`Where would ${active.rows[0].name}'s fans add crowd for ${active.show.headliner} in ${active.show.city}?`);
            }}
          />
        )}
        {active.type === "crowd_map" && <CrowdMapView artifact={active} />}
        {active.type === "proposal" && <ProposalView artifact={active} onChange={updateArtifact} />}
        {active.type === "routing" && <RoutingView artifact={active} onAsk={onAsk} />}
        {active.type === "venues" && <VenuesView artifact={active} onAsk={onAsk} />}
        {active.type === "partners" && <PartnersView artifact={active} onAsk={onAsk} />}
        {active.type === "sponsors" && <SponsorsView artifact={active} onAsk={onAsk} />}
        {active.type === "audience" && <AudienceView artifact={active} />}
        {active.type === "email" && <EmailView artifact={active} onChange={updateArtifact} />}
      </div>
    </aside>
  );
}
