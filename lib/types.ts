export type Role = "citizen" | "ngo" | "camp" | "university_team" | "admin";

export type ProblemStatus = "open" | "claimed" | "resolved";
export type NeedStatus = "open" | "fulfilled";
export type MatchStatus = "suggested" | "accepted" | "delivered" | "declined";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  org_name: string | null;
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
  created_at: string;
  camps?: Camp; // joined
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

export const PROBLEM_CATEGORIES = [
  "Medical",
  "Food & Water",
  "Shelter",
  "Infrastructure",
  "Rescue",
  "Sanitation",
  "Other",
] as const;

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
