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
    <div className="space-y-14 py-6">
      <section className="text-center">
        <p className="mb-3 inline-block rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-700">
          Smart India Hackathon 2026 · PS SIH26043 · Govt. of Jharkhand
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          When disaster strikes, help should go where it&apos;s needed{" "}
          <span className="text-blue-700">most</span> — not just nearest.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          SahayataSetu crowdsources real problems during a disaster and
          intelligently matches relief supplies to the camps that need them most,
          using urgency, population affected and distance.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/problems"
            className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800"
          >
            View the Problem Board
          </Link>
          <Link
            href="/matches"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            See Smart Matching
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 font-bold text-white">
              {s.n}
            </div>
            <h3 className="font-bold text-slate-900">{s.t}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.d}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-center text-2xl font-bold text-slate-900">
          Who is it for?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div
              key={r.title}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5"
            >
              <h3 className="font-bold text-slate-900">{r.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-600">{r.desc}</p>
              <Link
                href={r.href}
                className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
              >
                {r.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 p-8 text-center text-white">
        <h2 className="text-2xl font-bold">The difference: need-based matching</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-300">
          A donor posts 1,000 water bottles. A plain app sends them to the nearest
          camp. SahayataSetu scores <em>every</em> camp —{" "}
          <span className="font-mono text-blue-300">
            urgency × population ÷ distance
          </span>{" "}
          — and routes the bottles to a critical camp of 3,400 people even if a
          calmer camp is closer. Every match shows its full score breakdown, so
          officials can trust the recommendation.
        </p>
      </section>
    </div>
  );
}
