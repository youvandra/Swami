import s from "./Audience.module.css";

const rows = [
  {
    who: "Promoter & venue marketing",
    lead: true,
    decision: "Where this show's marketing budget goes",
    gets: "Ranked support, a neighbourhood ad plan and co-promo partners whose regulars share the crowd.",
  },
  {
    who: "Talent buyers",
    decision: "Which local act opens this date",
    gets: "Local openers ranked by added crowd, with a why for each pick the headliner team can approve fast.",
  },
  {
    who: "Agents & tour managers",
    decision: "Support for a whole tour leg",
    gets: "Roster-only rankings computed per leg, so support can rotate where it pulls best.",
  },
  {
    who: "Artist managers",
    decision: "Which bills to pitch for",
    gets: "Your act scored against a headliner's fans in roster mode, plus the memo that makes the case.",
  },
];

export function Audience() {
  return (
    <section className={s.section} id="who">
      <div className="wrap">
        <header className={s.head}>
          <span className="eyebrow">Who It&apos;s For</span>
          <h2 className="display">One ranking, read by everyone who touches the bill.</h2>
        </header>

        <div className={s.table} role="table" aria-label="Who uses Swami">
          <div className={`${s.row} ${s.th}`} role="row">
            <span role="columnheader">Role</span>
            <span role="columnheader">The Decision</span>
            <span role="columnheader">What Swami Gives</span>
          </div>
          {rows.map((r) => (
            <div key={r.who} className={s.row} role="row">
              <span role="cell" className={s.who}>
                {r.who}
                {r.lead && <em className={s.lead}>Primary</em>}
              </span>
              <span role="cell" className={s.decision}>
                {r.decision}
              </span>
              <span role="cell" className={s.gets}>
                {r.gets}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
