import s from "./HowItWorks.module.css";

function ShowMock() {
  return (
    <div className={s.panel}>
      <div className={s.formRow}>
        <span>Headliner</span>
        <b>Marlow Vane</b>
      </div>
      <div className={s.formRow}>
        <span>City</span>
        <b>Chicago, IL</b>
      </div>
      <div className={s.formRow}>
        <span>Date</span>
        <b>Fri, Mar 14</b>
      </div>
      <div className={s.formRow}>
        <span>Roster</span>
        <b className={s.tag}>12 acts pasted</b>
      </div>
    </div>
  );
}

const ranked = [
  { name: "Halcyon Drive", score: 0.82 },
  { name: "The Low Orchard", score: 0.71 },
  { name: "Pia Marsh", score: 0.64 },
  { name: "Copper Hours", score: 0.52 },
];

function RankMock() {
  return (
    <div className={s.panel}>
      {ranked.map((r, i) => (
        <div key={r.name} className={s.rankRow}>
          <span className={s.rankN}>{i + 1}</span>
          <span className={s.rankName}>{r.name}</span>
          <span className={s.bar}>
            <i style={{ width: `${r.score * 100}%` }} />
          </span>
          <span className={s.rankScore}>{r.score.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

const hoods = [
  { name: "Logan Square", heat: 5 },
  { name: "Pilsen", heat: 4 },
  { name: "Avondale", heat: 3 },
];

function PushMock() {
  return (
    <div className={s.panel}>
      {hoods.map((h) => (
        <div key={h.name} className={s.hoodRow}>
          <span>{h.name}</span>
          <span className={s.heat} aria-label={`heat ${h.heat} of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < h.heat ? s.on : undefined} />
            ))}
          </span>
        </div>
      ))}
      <div className={s.partners}>
        <span>Two Moons Bar</span>
        <span>Sola Records</span>
        <span>Calle Taqueria</span>
      </div>
    </div>
  );
}

const links = [
  { name: "Halcyon Fans", v: 0.9 },
  { name: "Logan Sq. Ads", v: 0.62 },
  { name: "Two Moons", v: 0.38 },
  { name: "Headliner List", v: 0.74 },
];

function ReportMock() {
  return (
    <div className={s.panel}>
      <div className={s.chart}>
        {links.map((l) => (
          <div key={l.name} className={s.col}>
            <span className={s.colBar} style={{ height: `${l.v * 100}%` }} />
            <span className={s.colLabel}>{l.name}</span>
          </div>
        ))}
      </div>
      <p className={s.note}>Tickets per Promo Link</p>
    </div>
  );
}

const steps = [
  {
    title: "Add the show",
    body: "Headliner, city and date. Paste the agency roster if support is packaged, and Swami ranks inside it.",
    mock: <ShowMock />,
  },
  {
    title: "Rank by added crowd",
    body: "Each act scores on how much the headliner's fans like it, times how strong it is where the headliner runs cold.",
    mock: <RankMock />,
  },
  {
    title: "Plan the local push",
    body: "Neighbourhoods to target, nearby places that share the crowd for co-promo, and an ad angle for each segment.",
    mock: <PushMock />,
  },
  {
    title: "Learn from the door",
    body: "Every opener and segment gets its own promo link. After the show, tickets per link reweight the next ranking.",
    mock: <ReportMock />,
  },
];

export function HowItWorks() {
  return (
    <section className={s.section} id="how">
      <div className="wrap">
        <header className={s.head}>
          <span className="eyebrow">How It Works</span>
          <h2 className="display">From a date on the calendar to a full room.</h2>
        </header>

        <ol className={s.steps}>
          {steps.map((step, i) => (
            <li key={step.title} className={s.step}>
              {step.mock}
              <div className={s.meta}>
                <span className={s.stepN}>Step {i + 1}</span>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.stepBody}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
