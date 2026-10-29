import s from "./Booking.module.css";

export function Booking() {
  return (
    <section className={s.section} id="booking">
      <div className="wrap">
        <header className={s.head}>
          <span className="eyebrow">Built for Real Booking</span>
          <h2 className="display">Works inside the deals you already have.</h2>
          <p className="lead">
            Agencies package support, headliners approve openers, and relationships close the slot. Swami fits into
            each of those steps.
          </p>
        </header>

        <div className={s.bento}>
          <article className={`${s.card} ${s.memo}`}>
            <div className={s.cardText}>
              <h3>A booking memo for the pitch</h3>
              <p>One page an agent or manager can forward: who the fans overlap with, and the cities where the pairing adds the most.</p>
            </div>
            <div className={s.paper} aria-hidden="true">
              <div className={s.paperHead}>
                <span>Booking Memo</span>
                <span>Mar 2026 · Midwest leg</span>
              </div>
              <p className={s.paperTitle}>Halcyon Drive for Marlow Vane</p>
              <p className={s.paperLine}>Fans of Marlow Vane rank Halcyon Drive 4th of 50 related acts.</p>
              <div className={s.cities}>
                {[
                  ["Chicago", 0.82],
                  ["Milwaukee", 0.66],
                  ["Detroit", 0.58],
                ].map(([city, v]) => (
                  <div key={city as string} className={s.city}>
                    <span>{city}</span>
                    <span className={s.cityBar}>
                      <i style={{ width: `${(v as number) * 100}%` }} />
                    </span>
                  </div>
                ))}
              </div>
              <p className={s.paperFoot}>Audience affinity, Qloo taste graph</p>
            </div>
          </article>

          <article className={`${s.card} ${s.roster}`}>
            <div className={s.cardText}>
              <h3>Roster Mode</h3>
              <p>Paste the agency&apos;s list. The roster acts as a hard filter, and the ranking runs per leg so support can rotate by region.</p>
            </div>
            <div className={s.chips} aria-hidden="true">
              {["Halcyon Drive", "Pia Marsh", "Copper Hours", "The Low Orchard", "June Atlas", "Fieldwork"].map((a, i) => (
                <span key={a} className={i < 3 ? s.chipOn : s.chip}>
                  {a}
                </span>
              ))}
            </div>
          </article>

          <article className={`${s.card} ${s.reverse}`}>
            <div className={s.cardText}>
              <h3>
                Reverse Mode for Managers <span className={s.soon}>Soon</span>
              </h3>
              <p>Start from your artist and find headliners whose fans would like you, in cities where you are small today.</p>
            </div>
            <div className={s.flow} aria-hidden="true">
              <span>Your Artist</span>
              <svg viewBox="0 0 40 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M1 6h37M33 1.5 38 6l-5 4.5" />
              </svg>
              <span className={s.flowOn}>3 tours to pitch</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
