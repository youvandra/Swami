// Contract between the chat UI and POST /api/chat. The mock and the real agent both return these shapes.

export type Mode = "auto" | "opener" | "map" | "routing" | "venues" | "partners" | "sponsors" | "audience" | "proposal" | "email";

export type Show = {
  headliner: string;
  city: string;
  date: string;
  venue: string;
  capacity: number;
  /** True when nobody gave a capacity and the default room size stands in. */
  capacityAssumed?: boolean;
};

// status is set while a reply streams; stored steps are done or failed
export type Step = { label: string; detail?: string; ms: number; status?: "running" | "done" | "failed" };

export type OpenerRow = {
  name: string;
  genre: string;
  fit: number; // 0..1, affinity of headliner fans for this act
  reachGain: number; // 0..1, this act's fans where the headliner is weak
  score: number; // fit^a * reachGain^b, computed in code
  why: string;
  hoods: string[];
  onRoster: boolean;
  rising: boolean;
  estimated: boolean; // fell back to genre/tag heat
  bigger?: boolean; // draws bigger than the headliner: a co-headliner, demoted
};

export type Hood = { name: string; x: number; y: number; headliner: number; opener: number };

export type ProposalSection = { id?: string; heading: string; body: string };

export type ProposalTemplate = "promoter" | "sponsor" | "memo";

// What a redraft needs beyond the picks: where the new crowd is, who co-promotes, which brand.
export type ProposalFacts = { hoods: string[]; partners: string[]; sponsor?: string };

export type RouteStop = {
  city: string;
  region: string;
  affinity: number; // 0..1, headliner fans in this city vs the national baseline
  milesFromPrev: number;
  room: string; // suggested room size
  note: string;
};

// capacity is missing when Qloo has none; the view hides the bar then
export type Venue = { name: string; hood: string; capacity?: number; fit: number; tags: string[]; note: string };

export type Partner = { name: string; kind: "Bar" | "Restaurant" | "Record shop" | "Café"; hood: string; fit: number; angle: string };

export type Sponsor = { brand: string; category: string; fit: number; lift: number; pitch: string };

export type AgeBand = { band: string; headliner: number; opener: number }; // shares, each column sums to 1
export type Audience = { ages: AgeBand[]; women: { headliner: number; opener: number }; traits: { label: string; headliner: string; opener: string }[] };

// source: where the numbers came from when it was made. Missing on older artifacts, which were all demo data.
type Base = { id: string; title: string; subtitle: string; source?: "live" | "fixture" };

export type Artifact =
  | (Base & { type: "opener_ranking"; show: Show; rows: OpenerRow[] })
  | (Base & { type: "crowd_map"; show: Show; opener: string; hoods: Hood[] })
  | (Base & {
      type: "proposal";
      show: Show;
      template?: ProposalTemplate; // missing on drafts made before templates existed: "promoter"
      headline?: string;
      to: string;
      from: string;
      date: string;
      sections: ProposalSection[];
      picks: Pick<OpenerRow, "name" | "score" | "why">[];
      facts?: ProposalFacts;
    })
  | (Base & { type: "routing"; show: Show; leg: string; stops: RouteStop[] })
  | (Base & { type: "venues"; show: Show; venues: Venue[] })
  | (Base & { type: "partners"; show: Show; partners: Partner[] })
  | (Base & { type: "sponsors"; show: Show; sponsors: Sponsor[] })
  | (Base & { type: "audience"; show: Show; opener: string; audience: Audience })
  | (Base & { type: "email"; show: Show; to: string; cc: string; subject: string; body: string });

export type ArtifactType = Artifact["type"];

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  steps?: Step[];
  artifacts?: Artifact[];
  choices?: Choices;
  /** A reply that did not finish; the chat offers to send the question again. */
  failed?: boolean;
};

// The agent asks which one was meant instead of guessing; picking a card sends `reply` back.
export type Choice = { id: string; name: string; image?: string; detail: string; reply: string };
// `key` is the name as the user wrote it; the chosen id is remembered under it.
// name and ask: the name as typed and the question it came in, so "none of these" can search again
/** The id of the "None of these" card, which resolves nothing. */
export const NONE_ID = "none";
export type Choices = { prompt: string; key: string; name?: string; ask?: string; options: Choice[] };

export type Conversation = {
  id: string;
  title: string;
  projectId?: string;
  mode: Mode;
  updatedAt: number;
  messages: Message[];
  /** Artist names resolved in this chat (lower-case name -> Qloo id), sent back with every request. */
  entities?: Record<string, string>;
};

// What the workspace tells the agent on every request: who is asking, and the roster to rank inside, if any.
export type ChatContext = {
  workspace: string;
  role: string;
  cities: string[];
  artists?: string[];
  roster?: { name: string; acts: string[] };
  project?: { headliner: string; city: string; date: string; venue: string; capacity: number };
  /** The show the chat's latest result was about, so a follow-up can leave it out. */
  last?: { headliner: string; city: string; date: string; opener?: string; kind?: Exclude<Mode, "auto"> };
  /** Names already resolved in this chat: name -> Qloo id. */
  entities?: Record<string, string>;
  /** The cards the chat's last reply asked the user to pick from, so a typed answer can pick one. */
  choices?: Choices;
};

export type ChatRequest = { conversationId: string; messages: Pick<Message, "role" | "text">[]; mode: Mode; context?: ChatContext };
export type ChatResponse = { message: Message; title: string };
