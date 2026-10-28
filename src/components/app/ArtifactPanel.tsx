"use client";

import type { Artifact, ArtifactType } from "@/lib/agent/types";
import { AudienceView } from "./artifacts/AudienceView";
import { CrowdMapView } from "./artifacts/CrowdMapView";
import { EmailView } from "./artifacts/EmailView";
import { OpenerRanking } from "./artifacts/OpenerRanking";
import { PartnersView } from "./artifacts/PartnersView";
import { ProposalView } from "./artifacts/ProposalView";
import { RoutingView } from "./artifacts/RoutingView";
import { SponsorsView } from "./artifacts/SponsorsView";
import { VenuesView } from "./artifacts/VenuesView";
import { toMarkdown, toPlainText } from "./artifacts/export";
import {
  IconBookmark,
  IconChart,
  IconClose,
  IconCopy,
  IconDoc,
  IconDownload,
  IconList,
  IconMail,
  IconMap,
  IconPin,
  IconRoute,
  IconStore,
  IconTag,
} from "./icons";
import s from "./ArtifactPanel.module.css";

const LABEL: Record<ArtifactType, string> = {
  opener_ranking: "Opener ranking",
  crowd_map: "Crowd map",
  proposal: "Proposal",
  routing: "Routing",
  venues: "Venues",
  partners: "Co-promo",
  sponsors: "Sponsors",
  audience: "Audience",
  email: "Email",
};

const ICON: Record<ArtifactType, (p: { className?: string }) => React.ReactNode> = {
  opener_ranking: IconList,
  crowd_map: IconMap,
  proposal: IconDoc,
  routing: IconRoute,
  venues: IconPin,
  partners: IconStore,
  sponsors: IconTag,
  audience: IconChart,
  email: IconMail,
};

export const artifactIcon = (t: ArtifactType) => ICON[t];

type Props = {
  artifacts: Artifact[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onAsk: (prompt: string) => void;
  onToast: (msg: string) => void;
};

export function ArtifactPanel({ artifacts, activeId, onSelect, onClose, onAsk, onToast }: Props) {
  const active = artifacts.find((a) => a.id === activeId) ?? artifacts[artifacts.length - 1];

  const download = () => {
    const { name, body, type } = toMarkdown(active);
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    onToast(`Downloaded ${name}`);
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
        <div className={s.tabs} role="tablist">
          {artifacts.map((a) => {
            const Icon = artifactIcon(a.type);
            return (
              <button key={a.id} role="tab" aria-selected={a.id === active.id} className={s.tab} onClick={() => onSelect(a.id)} title={a.title}>
                <Icon />
                <span>{LABEL[a.type]}</span>
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
          <span className={s.kind}>{LABEL[active.type]}</span>
          <h2>{active.title}</h2>
          <p>{active.subtitle}</p>
        </div>
        <div className={s.actions}>
          <button className={s.action} onClick={() => onToast(`Saved to ${active.show.headliner} · Spring tour`)}>
            <IconBookmark />
            <span>Save</span>
          </button>
          <button className={s.action} onClick={copy} aria-label="Copy">
            <IconCopy />
          </button>
          <button className={`${s.action} ${s.primary}`} onClick={download}>
            <IconDownload />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className={s.body} key={active.id}>
        {active.type === "opener_ranking" && <OpenerRanking artifact={active} onAsk={onAsk} onShowMap={() => {
          const m = artifacts.find((a) => a.type === "crowd_map");
          if (m) onSelect(m.id);
        }} />}
        {active.type === "crowd_map" && <CrowdMapView artifact={active} />}
        {active.type === "proposal" && <ProposalView artifact={active} />}
        {active.type === "routing" && <RoutingView artifact={active} onAsk={onAsk} />}
        {active.type === "venues" && <VenuesView artifact={active} onAsk={onAsk} />}
        {active.type === "partners" && <PartnersView artifact={active} onAsk={onAsk} />}
        {active.type === "sponsors" && <SponsorsView artifact={active} onAsk={onAsk} />}
        {active.type === "audience" && <AudienceView artifact={active} />}
        {active.type === "email" && <EmailView artifact={active} />}
      </div>
    </aside>
  );
}
