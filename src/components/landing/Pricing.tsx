import s from "./Pricing.module.css";

const plans = [
  {
    name: "Single Show",
    blurb: "For a one-off date or a first try.",
    items: ["Opener ranking for one show", "Neighbourhood push plan", "Booking memo export", "Promo links and ticket report"],
  },
  {
    name: "Season",
    blurb: "For promoters and venues running a calendar.",
    items: ["Up to 20 shows a month", "Roster mode per tour leg", "Co-promo partner lists", "Rankings that learn from your door"],
    featured: true,
  },
  {
    name: "Venue Group",
    blurb: "For groups with many rooms and their own ticketing.",
    items: ["Unlimited shows", "Ticketing data joined to promo links", "Shared rosters across rooms", "Priority support"],
  },
];

export function Pricing() {
  return (
    <section className={s.section} id="pricing">
      <div className="wrap">
        <header className={s.head}>
          <span className="eyebrow">Pricing</span>
          <h2 className="display">Free while Swami is in beta.</h2>
          <p className="lead">Paid plans are coming soon. Until then every feature is open: sign up and book your next show.</p>
        </header>

        <div className={s.plans}>
          {plans.map((p) => (
            <article key={p.name} className={p.featured ? `${s.plan} ${s.featured} on-dark` : s.plan}>
              <div className={s.top}>
                <h3 className={s.name}>{p.name}</h3>
                <p className={s.blurb}>{p.blurb}</p>
              </div>
              <p className={s.price}>
                Soon
                <span>pricing after the beta</span>
              </p>
              <ul className={s.items}>
                {p.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <a className={`button ${p.featured ? "button-cream" : "button-line"} ${s.cta}`} href="/login">
                Try It Free
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
