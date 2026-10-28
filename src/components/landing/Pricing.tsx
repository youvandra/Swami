import s from "./Pricing.module.css";

const plans = [
  {
    name: "Single show",
    price: "$39",
    unit: "per show",
    blurb: "For a one-off date or a first try.",
    items: ["Opener ranking for one show", "Neighbourhood push plan", "Booking memo export", "Promo links and ticket report"],
    cta: "Rank a show",
    href: "#",
  },
  {
    name: "Season",
    price: "$490",
    unit: "per month",
    blurb: "For promoters and venues running a calendar.",
    items: ["Up to 20 shows a month", "Roster mode per tour leg", "Co-promo partner lists", "Rankings that learn from your door"],
    cta: "Start a season",
    href: "#",
    featured: true,
  },
  {
    name: "Venue group",
    price: "Custom",
    unit: "",
    blurb: "For groups with many rooms and their own ticketing.",
    items: ["Unlimited shows", "Ticketing data joined to promo links", "Shared rosters across rooms", "Priority support"],
    cta: "Talk to us",
    href: "#",
  },
];

export function Pricing() {
  return (
    <section className={s.section} id="pricing">
      <div className="wrap">
        <header className={s.head}>
          <span className="eyebrow">Pricing</span>
          <h2 className="display">Priced per show, paid from the show&apos;s budget.</h2>
          <p className="lead">A single show costs about the same as one ticket at the door.</p>
        </header>

        <div className={s.plans}>
          {plans.map((p) => (
            <article key={p.name} className={p.featured ? `${s.plan} ${s.featured} on-dark` : s.plan}>
              <div className={s.top}>
                <h3 className={s.name}>{p.name}</h3>
                <p className={s.blurb}>{p.blurb}</p>
              </div>
              <p className={s.price}>
                {p.price}
                {p.unit && <span>{p.unit}</span>}
              </p>
              <ul className={s.items}>
                {p.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <a className={`button ${p.featured ? "button-cream" : "button-line"} ${s.cta}`} href={p.href}>
                {p.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
