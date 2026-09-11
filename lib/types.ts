// Present once supabase/migrations/005 has been applied: "institution" and
// "industry_partner" (the profiles.role check constraint rejects them before that).
export type Role = "citizen" | "ngo" | "camp" | "university_team" | "admin" | "institution" | "industry_partner";

export type ProblemStatus = "open" | "claimed" | "resolved";
export type NeedStatus = "open" | "fulfilled";
export type MatchStatus = "suggested" | "accepted" | "delivered" | "declined";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  org_name: string | null;
  // Present once supabase/migrations/001 has been applied
  capability_description?: string | null;
  phone_number?: string | null;
  email?: string | null;
}

export interface Camp {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  population: number;
  contact: string | null;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  district: string;
  ward: string | null;
  lat: number | null;
  lng: number | null;
  urgency: number;
  population_affected: number;
  status: ProblemStatus;
  posted_by: string | null;
  poster_name: string | null;
  claimed_by: string | null;
  claimed_by_name: string | null;
  solution: string | null;
  created_at: string;
  // Present once supabase/migrations/002 has been applied
  moderation_status?: ModerationStatus;
  moderation_reason?: string | null;
  // Present once supabase/migrations/003 has been applied
  domain?: ProblemDomain | null;
}

export type ModerationStatus = "pending" | "approved" | "rejected";
export type ModerationVerdict = "approved" | "rejected" | "flagged";

export interface Answer {
  id: string;
  problem_id: string;
  author_profile_id: string;
  body: string;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  created_at: string;
  profiles?: { full_name: string; org_name: string | null; role: Role } | null; // joined
}

/** What a posting route tells the browser after moderation. */
export interface PostOutcome {
  verdict: ModerationVerdict;
  reasoning: string;
  id?: string; // row id when the post was saved (approved or flagged)
}

export interface Resource {
  id: string;
  type: string;
  quantity: number;
  quantity_remaining: number;
  unit: string;
  district: string | null;
  lat: number;
  lng: number;
  posted_by: string | null;
  donor_name: string | null;
  status: "available" | "allocated";
  created_at: string;
}

export interface Need {
  id: string;
  camp_id: string;
  type: string;
  quantity_needed: number;
  quantity_received: number;
  unit: string;
  urgency: number;
  status: NeedStatus;
  description?: string | null;
  created_at: string;
  camps?: Camp; // joined
}

export type OutreachStatus = "sent" | "failed" | "responded";

/** One ranked donor for a need, as returned by /api/match-need. */
export interface DonorMatch {
  donorId: string;
  name: string;
  role: Role;
  email: string | null;
  confidence: number; // 0–100
  reasoning: string;
  hasPhone: boolean;
}

export interface MatchNeedResponse {
  method: "llm" | "tag";
  model?: string;
  fallbackReason?: string;
  matches: DonorMatch[];
}

export interface Match {
  id: string;
  resource_id: string;
  need_id: string;
  quantity_allocated: number;
  score: number;
  score_breakdown: ScoreBreakdown;
  status: MatchStatus;
  created_at: string;
  resources?: Resource; // joined
  needs?: Need; // joined
}

export interface ScoreBreakdown {
  urgency: number;
  urgencyPoints: number;
  population: number;
  populationPoints: number;
  distanceKm: number;
  distanceFactor: number;
  finalScore: number;
}

export const RESOURCE_TYPES = [
  { value: "water", label: "Water" },
  { value: "food", label: "Food" },
  { value: "medicine", label: "Medicine" },
  { value: "shelter", label: "Shelter" },
  { value: "clothing", label: "Clothing" },
  { value: "sanitation", label: "Sanitation" },
] as const;

/**
 * @deprecated kept for the pre-migration category column; use PROBLEM_DOMAINS
 * for anything new (domain routing to institutions/industry partners).
 */
export const PROBLEM_CATEGORIES = [
  // disaster response
  "Medical",
  "Food & Water",
  "Shelter",
  "Infrastructure",
  "Rescue",
  "Sanitation",
  // everyday community issues
  "Education",
  "Public Health",
  "Civic Infrastructure",
  "Safety",
  "Environment",
  "Other",
] as const;

// ---------- Societal Innovation Collaboration Portal: domain routing ----------

export const PROBLEM_DOMAINS = [
  "Education",
  "Healthcare",
  "Agriculture",
  "Water Resources",
  "Sanitation",
  "Environment",
  "Energy",
  "Urban Development",
  "Accessibility",
  "Public Administration",
  "Rural Livelihoods",
] as const;
export type ProblemDomain = (typeof PROBLEM_DOMAINS)[number];

export interface Institution {
  id: string;
  name: string;
  district: string | null;
  domains: ProblemDomain[]; // areas of academic/expertise strength
  description: string | null; // free text: research focus, incubation cell, etc.
  has_incubation_cell: boolean;
  contact_name: string | null;
  contact_email: string | null;
  // Added alongside the Part 3 UI: the signup route needs it to find "my institution".
  created_by: string | null;
  created_at: string;
}

export interface IndustryPartner {
  id: string;
  name: string;
  sector: string; // e.g. "Agritech", "Healthtech MSME", "CSR"
  domains: ProblemDomain[];
  capabilities: string | null; // free text: funding / mentorship / prototyping / testing
  contact_name: string | null;
  contact_email: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * A profile's link to an institution — always created unverified (see
 * supabase/migrations/004); only an admin can set verified = true.
 */
export interface InstitutionRepresentative {
  id: string;
  institution_id: string;
  profile_id: string;
  verified: boolean;
  created_at: string;
  institutions?: Institution; // joined
  profiles?: Profile; // joined
}

export type RoutingStatus = "suggested" | "accepted" | "declined";

export interface ProblemRouting {
  id: string;
  problem_id: string;
  institution_id: string;
  method: "llm" | "tag";
  confidence: number; // 0–100
  reasoning: string;
  status: RoutingStatus;
  created_at: string;
  institutions?: Institution; // joined
  problems?: Problem; // joined
}

/** Ranked institutions for a problem, as returned by /api/route-problem. */
export interface RouteProblemResponse {
  method: "llm" | "tag";
  model?: string;
  fallbackReason?: string;
  matches: {
    institutionId: string;
    name: string;
    domains: ProblemDomain[];
    confidence: number;
    reasoning: string;
    // Absent from lib/routing.ts's in-memory ranking (nothing is saved yet);
    // present once /api/route-problem has written the suggestion to
    // problem_routing and this is the id a client passes to
    // /api/route-problem/respond to accept or decline it.
    routingId?: string;
  }[];
}

export const JHARKHAND_DISTRICTS = [
  "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum",
  "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara",
  "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu",
  "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan",
  "Simdega", "West Singhbhum",
] as const;

export const URGENCY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Mild",
  3: "Moderate",
  4: "High",
  5: "Critical",
};
