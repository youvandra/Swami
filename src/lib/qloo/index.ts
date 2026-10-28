import "server-only";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { env } from "../env.ts";
import { HttpQloo } from "./client.ts";
import { FixtureQloo } from "./fixture.ts";
import type { QlooSource } from "./types.ts";

/** A fresh source per chat run, so its call count is that run's. Live when QLOO_API_KEY is set, else the fake fixture. */
export function qlooForRun(): QlooSource & { calls: number } {
  return env.qlooLive ? new HttpQloo(env.QLOO_API_KEY!, env.QLOO_BASE_URL) : new FixtureQloo(FAKE_GRAPH);
}

export type * from "./types.ts";
