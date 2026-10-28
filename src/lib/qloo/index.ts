import "server-only";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { qlooCache } from "../db/admin.ts";
import { env } from "../env.ts";
import { HttpQloo } from "./client.ts";
import { budgeted, slowed } from "./budget.ts";
import { FixtureQloo } from "./fixture.ts";
import type { QlooSource } from "./types.ts";

/** A fresh source per chat run, so its call count is that run's. Live when QLOO_API_KEY is set, else the fake fixture. */
/** Network calls one chat turn may make; a 30-act roster ranking needs about 70. */
const RUN_BUDGET = 90;

export function qlooForRun(): QlooSource & { calls: number } {
  return budgeted(env.qlooLive ? new HttpQloo(env.QLOO_API_KEY!, env.QLOO_BASE_URL, qlooCache()) : slowed(new FixtureQloo(FAKE_GRAPH), env.SWAMI_FIXTURE_DELAY_MS), RUN_BUDGET);
}

export type * from "./types.ts";
