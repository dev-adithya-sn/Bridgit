# Bridge-It — Disaster Response Platform for Jharkhand

**Smart India Hackathon 2026 · PS #43 (SIH26043) · Govt. of Jharkhand**

A crowdsourcing platform where citizens, NGOs and government post real problems
during a disaster, and university teams claim and solve them — **plus** a smart
matching engine that routes relief supplies to the camps that need them **most**
(by urgency, population affected and distance), not just the nearest one.

## The differentiator

A donor posts 1,000 water bottles. A plain app sends them to the nearest camp.
Bridge-It scores **every** open need:

```
score = (urgency points + population points) ÷ (1 + distance_km / 600)
```

…and routes the bottles to a critical camp of 3,400 people even if a calmer camp
is closer. Every match shows its full score breakdown in the UI, so officials can
trust (and defend) the recommendation. One donation can split across camps.
The engine lives in `lib/matching.ts` — plain, transparent math. No ML black box.

## One-time setup (~10 minutes)

1. **Create a free Supabase project** at [supabase.com](https://supabase.com)
   (New project → any name → choose a region in India).
2. In the Supabase dashboard, open **SQL Editor** and run the contents of
   `supabase/schema.sql` (tables + security), then `supabase/seed.sql`
   (demo data: 5 Jharkhand relief camps, 8 needs, 6 problems).
3. In **Authentication → Sign In / Providers → Email**, turn **off**
   "Confirm email" (so demo signups work instantly).
4. In **Project Settings → API**, copy the **Project URL** and the **anon public
   key** into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Run the app:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Demo script (for judging)

1. **Problem flow:** Sign up as a *Citizen* → post "Ward 4 needs a medical camp"
   with a map pin → sign out → sign up as a *University Team* → claim it →
   submit a solution → mark resolved.
2. **The matching moment:** Sign up as an *NGO* → Resources & Needs → "I have
   supplies" → 1,000 water bottles, pinned near Ranchi → **Post & find best
   matches**. The matcher ranks camps by score — Sahibganj (urgency 5, pop.
   3,400, ~315 km away) beats the nearby Ranchi camp (urgency 2), and the
   score-bar breakdown shows exactly why. Accept the match → quantities and
   statuses update live.
3. **Dashboard:** the map shows every camp and problem; the stat tiles update
   as things resolve.

## Tech

- **Next.js 16 (App Router) + Tailwind CSS** — deployed free on Vercel
- **Supabase** — Postgres + auth (free tier), row-level security enabled
- **Leaflet + OpenStreetMap** — free maps, no API key
- Matching: `lib/matching.ts` (haversine distance + weighted score + greedy allocation)

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables.
4. Deploy — you get a public URL to show judges.

## Scalability story (for Q&A)

- Vercel is serverless + CDN: capacity grows automatically, no fixed server to overwhelm.
- Most disaster traffic is *viewing*; reads are cheap and cacheable. Matching only
  runs when a resource is posted (rare).
- Growth path is an upgrade, not a rewrite: Supabase Pro tier → read replicas,
  rate limiting, queued match jobs.
