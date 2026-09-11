import Link from "next/link";

const ROLES = [
  {
    title: "Citizens & Volunteers",
    desc: "Report real problems on the ground — a flooded street, a camp without doctors — with a pin on the map.",
    href: "/problems/new",
    cta: "Report a problem",
  },
  {
    title: "NGOs & Donors",
    desc: "Post the supplies you have. Our matching engine sends them where they're needed most — not just nearest.",
    href: "/resources",
    cta: "Post resources",
  },
  {
    title: "Relief Camps",
    desc: "Publish what your camp needs — water, food, medicine — with urgency and the population you serve.",
    href: "/resources",
    cta: "Post a need",
  },
  {
    title: "University Teams",
    desc: "Browse open problems, claim one, and submit your solution. Track it from open to resolved.",
    href: "/problems",
    cta: "Browse problems",
  },
];

const STEPS = [
  { n: "1", t: "Report", d: "Anyone posts a problem or a need with location, urgency and people affected." },
  { n: "2", t: "Match", d: "Supplies are scored against every open need — urgency × population ÷ distance — and routed where the score is highest." },
  { n: "3", t: "Resolve", d: "University teams claim problems and submit solutions; camps confirm deliveries. Everything is tracked." },
];

export default function Home() {
  return (
    <div>
      {/* Off-white hero band */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="mb-4 inline-block border border-ink px-4 py-1 font-display text-xs font-semibold tracking-wide">
          Smart India Hackathon 2026 · PS SIH26043 · Govt. of Jharkhand
        </p>
        <h1 className="mx-auto max-w-3xl font-display text-5xl font-bold leading-none tracking-tight sm:text-6xl">
          Help should go where it&apos;s needed most — not just nearest.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-mute">
          Bridge-It crowdsources real problems during a disaster and
          intelligently matches relief supplies to the camps that need them most,
          using urgency, population affected and distance.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/problems"
            className="bg-ink px-6 py-2.5 font-display font-semibold text-canvas hover:bg-ink/80"
          >
            View the Problem Board
          </Link>
          <Link
            href="/matches"
            className="border border-ink px-6 py-2.5 font-display font-semibold text-ink hover:bg-ink hover:text-canvas"
          >
            See Smart Matching
          </Link>
        </div>
      </section>

      {/* Full-width black band: how it works */}
      <section className="border-y border-ink bg-ink text-canvas">
        <div className="mx-auto grid max-w-6xl gap-px sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`p-8 ${i > 0 ? "sm:border-l sm:border-canvas/30" : ""}`}>
              <div className="font-display text-4xl font-bold text-canvas/40">{s.n}</div>
              <h3 className="mt-1 font-display text-xl font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-canvas/70">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Off-white band: roles */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-6 text-center font-display text-3xl font-bold">
          Who is it for?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div
              key={r.title}
              className="flex flex-col border border-ink bg-canvas p-5"
            >
              <h3 className="font-display text-lg font-bold">{r.title}</h3>
              <p className="mt-1 flex-1 text-sm text-mute">{r.desc}</p>
              <Link
                href={r.href}
                className="mt-3 text-sm font-semibold text-ink underline underline-offset-4 hover:text-mute"
              >
                {r.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Full-width black band: the differentiator */}
      <section className="border-t border-ink bg-ink py-14 text-center text-canvas">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold">
            The difference: need-based matching
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-canvas/70">
            A donor posts 1,000 water bottles. A plain app sends them to the
            nearest camp. Bridge-It scores <em>every</em> camp —{" "}
            <span className="font-mono text-canvas">
              urgency × population ÷ distance
            </span>{" "}
            — and routes the bottles to a critical camp of 3,400 people even if a
            calmer camp is closer. Every match shows its full score breakdown, so
            officials can trust the recommendation.
          </p>
        </div>
      </section>
    </div>
  );
}
