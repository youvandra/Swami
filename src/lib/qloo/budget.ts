// Stops a run that would make more Qloo calls than one answer should cost. Cache hits are free.

import type { QlooSource } from "./types.ts";

export class BudgetExceeded extends Error {
  name = "BudgetExceeded";
}

export function budgeted<S extends QlooSource & { calls: number }>(source: S, max: number): S {
  return new Proxy(source, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v !== "function") return v;
      return (...args: unknown[]) => {
        if (target.calls >= max) throw new BudgetExceeded(`This question needs more than ${max} taste-graph calls. Ask about fewer acts or one city at a time.`);
        return v.apply(target, args);
      };
    },
  });
}
