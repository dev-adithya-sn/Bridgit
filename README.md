# Bridge-It — Disaster Response Platform for Jharkhand

**Smart India Hackathon 2026 · PS #43 (SIH26043) · Govt. of Jharkhand**

A crowdsourcing platform where citizens, NGOs and government post real problems
— during a disaster or in everyday civic life (education, public health, safety,
civic infrastructure, environment) — and university teams claim and solve them,
with an open community answer thread on every problem and AI moderation before
anything goes public. **Plus** a smart matching engine that routes relief
supplies to the camps that need them **most** (by urgency, population affected
and distance), not just the nearest one.

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

## One-time setup: AI donor matching + WhatsApp outreach

When a camp posts a need, Bridge-It asks Google Gemini to read the need and every
donor's free-text "what can you offer?" description, and shows a ranked list
with a confidence score and a one-line reason for each donor. The coordinator
ticks the donors to contact and Bridge-It sends each one a WhatsApp message
through Twilio. Each part degrades gracefully, so nothing breaks the demo:

| Missing | What happens |
|---|---|
| Migration | A setup banner appears; AI matching and outreach are off, everything else works |
| `GEMINI_API_KEY` | Donors are ranked by the tag-based matcher instead (the panel says so) |
| Twilio credentials | Matching still works; the Notify button is disabled with a banner |

### 1. Apply the database migration
In Supabase → **SQL Editor**, run `supabase/migrations/001_llm_matching_outreach.sql`.
It adds donor capability / phone / email fields, a description to needs, and
the `outreach` log table. It also hides `phone_number` from anonymous visitors
while keeping donor (NGO / camp) emails public.

### 2. Create a free Gemini API key
1. Sign in with a Google account at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. **Create API key** (no billing needed — the free tier covers a demo), then add it to `.env.local`:
   ```
   GEMINI_API_KEY=...
   ```
   It's only read by server routes; never prefix it with `NEXT_PUBLIC_` or it
   would be exposed to browsers. The default model is `gemini-3.8-flash`; if
   Google retires it, set `GEMINI_MODEL=gemini-2.5-flash` (or another free model).
3. **Privacy note:** on Gemini's free tier, Google may use request content to
   improve its products. Bridge-It only sends the need description and donors'
   names and capability text — never phone numbers or emails. Switch the key to
   a paid Google project if that matters for real deployments.
4. The free tier is rate-limited (requests per minute/day). If a limit is hit,
   matching quietly falls back to the tag-based ranking.

### 3. Create a free Twilio account and WhatsApp sandbox
1. Sign up at [twilio.com](https://www.twilio.com/try-twilio) (the free trial credit covers a demo).
2. In the Console, open **Messaging → Try it out → Send a WhatsApp message**.
   The page shows the sandbox number (usually `+1 415 523 8886`) and a join
   code like `join shadow-tiger`.
3. From the Console dashboard copy the **Account SID** and **Auth Token** into `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
4. Restart `npm run dev` so the new variables load.

### 4. ⚠️ Join the sandbox from every demo phone — easy to forget
Twilio's sandbox **refuses to message any number that hasn't opted in first**.
Before the demo, from **each phone number** on a donor account you plan to notify:

1. Open WhatsApp and send the join code (e.g. `join shadow-tiger`) to the sandbox number.
2. Wait for Twilio's "You are all set" reply.

Two gotchas: sandbox membership **can expire after about 3 days**, and
WhatsApp only allows free-form messages within **24 hours** of that phone's last
message to the sandbox. So on demo day, re-send the join code from each phone.
If a send fails, the panel shows Twilio's reason (error 63015 = number hasn't
joined; 63016 = outside the 24-hour window).

### 5. Seed demo donors and test
```
DEMO_WHATSAPP_PHONE=+919876543210 npx tsx scripts/seed-donors.ts
npm run dev
npx tsx scripts/verify-ai-outreach.ts
```
`seed-donors` creates five donors (pharmacy, water tankers, community kitchen,
shelter supplies, boat rescue) and puts your number on the pharmacy donor.
Existing NGO/camp users can add their own capability and WhatsApp number on
their profile page (click your name in the nav). `scripts/test-capability-matching.ts`
runs offline checks of the matcher and every fallback path.

**Demo:** log in as a camp → Resources & Needs → "My camp needs" → describe the
need in plain words (e.g. "elderly residents out of BP medicines, road flooded")
→ **Post need**. The donor panel shows Gemini's ranking and reasoning — note it
can rank the boat team for access, which keyword matching would miss — then tick
donors and **Notify selected via WhatsApp**.

## One-time setup: community Q&A + AI moderation

Every new problem and every community answer is checked by Gemini before it
goes public:

| Verdict | What it means | What happens |
|---|---|---|
| **approved** | Genuine civic, community or disaster report, question or answer — *including* complaints that name a government department, scheme or official | Published immediately |
| **rejected** | Spam, gibberish, advertising, obvious trolling | Not saved; the poster sees why and can edit and resubmit |
| **flagged** | Hate speech, insults or defamation of a named person, calls to violence, party-political campaigning | Saved but hidden; the poster sees "under review"; an admin decides |

Moderation is **enforced on the server**: posts go through `/api/problems` and
`/api/answers`, which moderate first and then save using the Supabase
service-role key. The database blocks direct inserts from browsers and stops
non-admins from changing a post's moderation status, and editing a post's text
sends it back to review.

1. **Run the migration:** in Supabase → SQL Editor, run
   `supabase/migrations/002_community_qa_moderation.sql` (after migration 001).
   Existing problems are marked approved, so the demo board stays as it was.
2. **Add the service-role key:** Supabase → **Settings → API** → copy the
   `service_role` key into `.env.local` (and Vercel):
   ```
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   ⚠️ This key bypasses all row-level security. It is read only by server routes —
   never prefix it with `NEXT_PUBLIC_` or paste it into client code.
3. **Gemini key:** the same `GEMINI_API_KEY` as donor matching (step 2 above).
4. **Become an admin** to use the moderation queue: sign up choosing
   "Government / Admin", then open **Moderation** in the nav (`/admin/moderation`).
   Each held post shows the AI's reasoning, with Approve / Reject buttons.
5. **Test:** `npx tsx scripts/verify-moderation.ts` runs three sample posts
   (a department complaint, spam, a political attack) and — with the migration,
   service key and `npm run dev` running — checks visibility and the admin queue.
   `npx tsx scripts/test-moderation.ts` runs offline checks.

**Fail-safe — say this to judges:** if the AI can't give a verdict (no key,
outage, timeout, or malformed reply), the post is **flagged and held for a
human**, never silently published and never silently blocked. The trade-off:
during an AI outage, new posts wait in the moderation queue. For a live demo
that must never stall, set `MODERATION_FAILSAFE=approve` — posts then publish
without review while the AI is unavailable, which is a known limitation to
disclose.

**Known limitation:** anyone can sign up as "Government / Admin" for demo
convenience, so the queue isn't protected against a determined user. For a real
deployment, remove that signup option and promote admins in SQL:
`update profiles set role = 'admin' where id = '<user id>';`

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
4. **Moderation:** post a civic complaint that names a department ("the PWD has
   ignored the broken drain for four months") → published instantly. Post spam
   → refused with the reason. Post a personal attack on a named councillor →
   "under review"; log in as an admin → **Moderation** → read the AI's reasoning
   → Approve or Reject.
5. **Community answers:** on any problem, anyone signed in can add an answer
   (also moderated), alongside the university teams' claim-and-solve flow.

## Tech

- **Next.js 16 (App Router) + Tailwind CSS** — deployed free on Vercel
- **Supabase** — Postgres + auth (free tier), row-level security enabled
- **Leaflet + OpenStreetMap** — free maps, no API key
- Matching: `lib/matching.ts` (haversine distance + weighted score + greedy allocation)
- AI donor matching: `lib/capabilityMatching.ts` (Google Gemini free tier with
  JSON-schema output, validated; falls back to the tag-based scorer on any failure)
- WhatsApp outreach: Twilio sandbox via `app/api/notify`, logged to `outreach`
- AI moderation: `lib/moderation.ts` (Gemini, three verdicts, fail-safe to
  human review), enforced by server routes + Postgres RLS and triggers

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables, plus
   `SUPABASE_SERVICE_ROLE_KEY` (required for posting), `GEMINI_API_KEY`, and the
   three `TWILIO_*` values if you use WhatsApp.
4. Deploy — you get a public URL to show judges.

## Scalability story (for Q&A)

- Vercel is serverless + CDN: capacity grows automatically, no fixed server to overwhelm.
- Most disaster traffic is *viewing*; reads are cheap and cacheable. Matching only
  runs when a resource is posted (rare).
- Growth path is an upgrade, not a rewrite: Supabase Pro tier → read replicas,
  rate limiting, queued match jobs.
