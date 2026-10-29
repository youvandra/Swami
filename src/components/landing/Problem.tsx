import s from "./Problem.module.css";

const bets = [
  {
    n: "01",
    title: "Who opens the show",
    body: "Support comes off the agency roster on gut feel. Nobody checks whether those fans would have bought a ticket anyway.",
  },
  {
    n: "02",
    title: "Where the ads run",
    body: "Local spend lands on the same broad neighbourhoods every time, including the ones the headliner already owns.",
  },
  {
    n: "03",
    title: "Who helps promote",
    body: "The bars, restaurants and record shops that share the crowd stay unasked, and the flyers go to the usual spots.",
  },
];

export function Problem() {
  return (
    <section className={s.section} id="problem">
      <div className={`wrap ${s.grid}`}>
        <div className={s.intro}>
          <span className="eyebrow">The Blind Spots</span>
          <h2 className="display">Every show makes three bets before a single ticket sells.</h2>
          <p className="lead">
            Most rooms below arena size end the night with empty seats. The three calls that could fill them still run on
            habit and a phone list.
          </p>
        </div>

        <ol className={s.ledger}>
          {bets.map((b) => (
            <li key={b.n} className={s.row}>
              <span className={s.n}>{b.n}</span>
              <div>
                <h3 className={s.title}>{b.title}</h3>
                <p className={s.body}>{b.body}</p>
              </div>
            </li>
          ))}
          <li className={s.answer}>
            <span className={s.dots} aria-hidden="true" />
            Swami answers all three from one taste graph, per show, per city.
          </li>
        </ol>
      </div>
    </section>
  );
}
