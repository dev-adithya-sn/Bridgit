/**
 * Seeds five demo donor organisations with free-text capabilities (and one
 * posted resource each where it makes sense), so the AI matcher and the
 * tag-based fallback both have something to rank.
 * Requires supabase/migrations/001 to be applied. Safe to re-run.
 *
 * Run:  npx tsx scripts/seed-donors.ts
 * Optional: DEMO_WHATSAPP_PHONE=+919876543210 npx tsx scripts/seed-donors.ts
 *   puts that number on the pharmacy donor, so notifying it sends a real
 *   WhatsApp message (the number must have joined the Twilio sandbox).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { normalizePhone } from "../lib/phone";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Demo@12345";

const demoPhone = process.env.DEMO_WHATSAPP_PHONE ? normalizePhone(process.env.DEMO_WHATSAPP_PHONE) : null;
if (process.env.DEMO_WHATSAPP_PHONE && !demoPhone) {
  console.error("DEMO_WHATSAPP_PHONE is not a valid number (use +<country code><number>).");
  process.exit(1);
}

const DONORS = [
  {
    email: "donor.pharmacy@example.com",
    name: "Jan Aushadhi Seva Pharmacy",
    role: "ngo",
    capability:
      "We run a pharmacy in Ranchi and can supply basic medicines (ORS, paracetamol, BP and diabetes tablets), bandages and first-aid kits. We have a van for deliveries within about 150 km.",
    phone: demoPhone,
    resource: { type: "medicine", quantity: 150, unit: "first-aid kits", district: "Ranchi", lat: 23.35, lng: 85.33 },
  },
  {
    email: "donor.water@example.com",
    name: "Damodar Water Tankers Collective",
    role: "ngo",
    capability:
      "Three 10,000-litre drinking-water tankers and a mobile purification unit. We deliver across Dhanbad, Bokaro and Giridih districts.",
    phone: null,
    resource: { type: "water", quantity: 30000, unit: "litres", district: "Dhanbad", lat: 23.8, lng: 86.44 },
  },
  {
    email: "donor.kitchen@example.com",
    name: "Annapurna Community Kitchen",
    role: "ngo",
    capability:
      "Community kitchen in Jamshedpur that can cook 2,000 hot meals a day and pack dry ration kits (rice, dal, oil). 40 volunteers available for distribution.",
    phone: null,
    resource: { type: "food", quantity: 800, unit: "meal packets", district: "East Singhbhum", lat: 22.8, lng: 86.18 },
  },
  {
    email: "donor.shelter@example.com",
    name: "Santhal Pargana Shelter Supplies",
    role: "ngo",
    capability:
      "Warehouse in Dumka with 600 tarpaulin sheets, 300 family tents and blankets. We can arrange a truck for bulk drop-offs.",
    phone: null,
    resource: { type: "shelter", quantity: 600, unit: "tarpaulin sheets", district: "Dumka", lat: 24.27, lng: 87.25 },
  },
  {
    email: "donor.boats@example.com",
    name: "Ganga Boat Rescue Volunteers",
    role: "ngo",
    capability:
      "Six motor boats and trained swimmers in Sahibganj for flood rescue and for ferrying supplies to villages cut off by the Ganga.",
    phone: null,
    resource: null,
  },
];

async function main() {
  const probe = createClient(URL_, KEY);
  const { error: schemaError } = await probe.from("profiles").select("capability_description").limit(1);
  if (schemaError) {
    console.error(`Migration 001 isn't applied (${schemaError.message}). Run supabase/migrations/001_llm_matching_outreach.sql first.`);
    process.exit(1);
  }

  for (const d of DONORS) {
    const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
    let { data, error } = await sb.auth.signUp({
      email: d.email,
      password: PASSWORD,
      options: {
        data: { full_name: d.name, role: d.role, org_name: d.name, capability_description: d.capability, phone_number: d.phone },
      },
    });
    if (error || !data.session) {
      // Already seeded on an earlier run: sign in instead
      ({ data, error } = await sb.auth.signInWithPassword({ email: d.email, password: PASSWORD }));
      if (error || !data.session) {
        console.error(`FAIL  ${d.name}: ${error?.message ?? "no session (is 'Confirm email' off?)"}`);
        continue;
      }
    }
    const userId = data.session.user.id;

    const { error: updateError } = await sb
      .from("profiles")
      .update({ capability_description: d.capability, phone_number: d.phone, email: d.email })
      .eq("id", userId);
    if (updateError) console.error(`WARN  ${d.name}: profile update — ${updateError.message}`);

    if (d.resource) {
      const { count } = await sb
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("posted_by", userId)
        .eq("type", d.resource.type);
      if (!count) {
        const { error: resError } = await sb.from("resources").insert({
          ...d.resource,
          quantity_remaining: d.resource.quantity,
          posted_by: userId,
          donor_name: d.name,
        });
        if (resError) console.error(`WARN  ${d.name}: resource — ${resError.message}`);
      }
    }
    console.log(`OK    ${d.name}${d.phone ? ` (WhatsApp ${d.phone})` : ""}`);
  }
  console.log(`\nDonor logins use password ${PASSWORD}.`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
