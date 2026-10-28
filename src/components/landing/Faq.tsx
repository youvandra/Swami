import s from "./Faq.module.css";

const faqs = [
  {
    q: "Support slots are packaged by the agency. Where does this help?",
    a: "Local openers on each date are picked by the promoter or talent buyer, and the headliner team approves. That call happens on every date of every tour, and it is the one Swami ranks first. When support is packaged, roster mode ranks inside the agency's list per leg, and the booking memo gives whoever pitches the act evidence to carry the conversation.",
  },
  {
    q: "Is the score a prediction of ticket sales?",
    a: "The score measures audience affinity: how much one act's fans like another, and where those fans live. Every screen labels it that way. Promo links then measure real tickets per opener and segment, and that result reweights your next ranking.",
  },
  {
    q: "Where does the data come from?",
    a: "Taste data comes from the Qloo taste graph: artist-to-artist affinity, neighbourhood heatmaps per artist and tag, place affinity for co-promotion and audience demographics. Your own ticketing data stays yours and joins in on the venue group plan.",
  },
  {
    q: "What if a local act is too small to show up?",
    a: "Swami falls back to genre and tag heatmaps for that act and marks the pick as estimated, so you can see which rankings rest on the act itself and which on its scene.",
  },
  {
    q: "Does the AI decide who opens?",
    a: "The agent turns your request into searches, handles plain-language constraints like “no one from a rival label”, and explains each pick. Plain, tested code computes every score, and you make the call.",
  },
];

export function Faq() {
  return (
    <section className={s.section} id="faq">
      <div className={`wrap ${s.grid}`}>
        <header className={s.head}>
          <span className="eyebrow">Questions</span>
          <h2 className="display">What promoters ask first.</h2>
        </header>
        <div className={s.list}>
          {faqs.map((f, i) => (
            <details key={f.q} className={s.item} open={i === 0}>
              <summary className={s.q}>
                {f.q}
                <span className={s.icon} aria-hidden="true" />
              </summary>
              <p className={s.a}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
