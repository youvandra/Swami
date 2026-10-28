import type { Artifact } from "./agent/types";

// A project is one show or one tour leg; chats and saved artifacts hang off it.
export type Project = {
  id: string;
  name: string;
  kind: "show" | "tour";
  tone: string;
  headliner: string;
  city: string;
  date: string;
  venue: string;
  capacity: number;
  createdAt: number;
  updatedAt: number;
};

// A saved artifact is a snapshot: later edits in the chat or the project update it in place.
export type SavedArtifact = {
  projectId: string;
  conversationId?: string;
  artifact: Artifact;
  savedAt: number;
};

export const TONES = ["#46DCEC", "#F4ECDD", "#0E3A45", "#9AA8B4", "#2FC6DC"];

export type Role = "promoter" | "buyer" | "agent" | "manager";

export const ROLES: { id: Role; label: string; blurb: string }[] = [
  { id: "promoter", label: "Promoter or venue", blurb: "I fill rooms and own the marketing budget" },
  { id: "buyer", label: "Talent buyer", blurb: "I pick who plays, date by date" },
  { id: "agent", label: "Agent or tour manager", blurb: "I route tours and place support" },
  { id: "manager", label: "Artist manager", blurb: "I pitch my artists onto bills" },
];

export type Workspace = {
  name: string;
  role: Role;
  cities: string[];
  artists: string[];
  plan: "single" | "season" | "group";
  onboarded: boolean;
};

export type Member = { id: string; name: string; email: string; role: "Owner" | "Editor" | "Viewer"; status: "active" | "invited" };

// A roster is the list of acts an agency offers; rankings can be limited to it.
export type Roster = { id: string; name: string; acts: { name: string; genre?: string }[]; createdAt: number };
