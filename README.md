# Swami

Landing page for Swami (the "opener" idea from the Qloo hackathon): rank support acts by the crowd they add in a city, then plan the local push.

## Run

```bash
npm install
npm run dev        # http://localhost:5192
npm run typecheck
```

## Routes

- `/` landing page
- `/app` chat workspace
- `POST /api/chat` agent endpoint, answered by `src/lib/agent/mock.ts` until the backend lands

## Layout

- `src/lib/site.ts` holds the product name, nav and shared copy. Rename the product there.
- `src/components/landing/hero/` is the animated hero. `voice.ts` is the speech model; every frame is a pure function of the page clock.
- `src/components/landing/*` holds one component and one CSS module per section.
- `public/hero/` holds the glow strip and the silhouette.
- `src/app/globals.css` holds the brand tokens (navy, cyan, cream, serif display type) and shared section classes.

All artist names, venues and numbers on the page are illustrative. Pricing is a placeholder.
