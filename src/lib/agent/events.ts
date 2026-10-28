// Server-sent events from POST /api/chat. The client fills the pending reply as they arrive.

import type { Artifact, Choices, Message, Step } from "./types.ts";

export type AgentEvent =
  | { type: "step"; step: Step & { key: string } }
  | { type: "text"; delta: string }
  | { type: "artifact"; artifact: Artifact }
  | { type: "choices"; choices: Choices }
  | { type: "title"; title: string }
  | { type: "done"; message: Message; title: string; entities: Record<string, string>; dataMode: "live" | "fixture" }
  | { type: "error"; message: string };

export type Emit = (e: AgentEvent) => void;

export const encodeEvent = (e: AgentEvent) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
