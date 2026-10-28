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
