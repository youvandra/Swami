// Contract between the chat UI and POST /api/chat. The mock and the real agent both return these shapes.

export type Mode = "auto" | "opener" | "map" | "routing" | "venues" | "partners" | "sponsors" | "audience" | "proposal" | "email";

export type Show = {
  headliner: string;
  city: string;
  date: string;
  venue: string;
  capacity: number;
};

export type Step = { label: string; detail?: string; ms: number };

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
};

export type Hood = { name: string; x: number; y: number; headliner: number; opener: number };

export type ProposalSection = { id?: string; heading: string; body: string };

export type ProposalTemplate = "promoter" | "sponsor" | "memo";

export type RouteStop = {
  city: string;
  region: string;
  affinity: number; // 0..1, headliner fans in this city vs the national baseline
  milesFromPrev: number;
  room: string; // suggested room size
  note: string;
};

export type Venue = { name: string; hood: string; capacity: number; fit: number; tags: string[]; note: string };

export type Partner = { name: string; kind: "Bar" | "Restaurant" | "Record shop" | "Café"; hood: string; fit: number; angle: string };

export type Sponsor = { brand: string; category: string; fit: number; lift: number; pitch: string };

export type AgeBand = { band: string; headliner: number; opener: number }; // shares, each column sums to 1
export type Audience = { ages: AgeBand[]; women: { headliner: number; opener: number }; traits: { label: string; headliner: string; opener: string }[] };

type Base = { id: string; title: string; subtitle: string };

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
};

export type Conversation = {
  id: string;
  title: string;
  projectId?: string;
  mode: Mode;
  updatedAt: number;
  messages: Message[];
};

// What the workspace tells the agent on every request: who is asking, and the roster to rank inside, if any.
export type ChatContext = { workspace: string; role: string; cities: string[]; roster?: { name: string; acts: string[] } };

export type ChatRequest = { conversationId: string; messages: Pick<Message, "role" | "text">[]; mode: Mode; context?: ChatContext };
export type ChatResponse = { message: Message; title: string };
