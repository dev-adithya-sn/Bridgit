import { Need, Camp, ScoreBreakdown } from "./types";

/**
 * The matching engine — the platform's differentiator.
 *
 * Given a newly posted resource (e.g. 1,000 water bottles at some location),
 * it ranks every open need of that type by a transparent weighted score and
 * greedily allocates the quantity down the ranked list. A donation can split
 * across camps if the top camp needs less than what's available.
 *
 * Score = (urgency points + population points) ÷ distance factor
 *   - urgency points:    up to 60 (urgency 1–5 → 12–60)
 *   - population points: up to 40 (camp population, capped at 5,000 people)
 *   - distance factor:   1 + km/600 — deliberately gentle. At state scale
 *     (Jharkhand is ~350 km across) urgency and population must dominate;
 *     distance only breaks ties. A critical camp 280 km away still beats a
 *     mild camp next door — that's the whole point of the platform.
 */

const URGENCY_WEIGHT = 60; // max points from urgency
const POPULATION_WEIGHT = 40; // max points from population
const POPULATION_CAP = 5000; // people; beyond this counts as "very large"
const DISTANCE_SOFTENING_KM = 600; // distance halves the score only at 600 km

export function haversineKm(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function scoreNeed(
  need: Need & { camps: Camp },
  resourceLat: number,
  resourceLng: number
): ScoreBreakdown {
  const urgencyPoints = (need.urgency / 5) * URGENCY_WEIGHT;
  const populationPoints =
    (Math.min(need.camps.population, POPULATION_CAP) / POPULATION_CAP) *
    POPULATION_WEIGHT;
  const distanceKm = haversineKm(
    resourceLat, resourceLng, need.camps.lat, need.camps.lng
  );
  const distanceFactor = 1 + distanceKm / DISTANCE_SOFTENING_KM;
  const finalScore = (urgencyPoints + populationPoints) / distanceFactor;

  return {
    urgency: need.urgency,
    urgencyPoints: round1(urgencyPoints),
    population: need.camps.population,
    populationPoints: round1(populationPoints),
    distanceKm: round1(distanceKm),
    distanceFactor: round1(distanceFactor),
    finalScore: round1(finalScore),
  };
}

export interface SuggestedMatch {
  need: Need & { camps: Camp };
  quantityAllocated: number;
  breakdown: ScoreBreakdown;
}

export function suggestMatches(
  openNeeds: (Need & { camps: Camp })[],
  resourceLat: number,
  resourceLng: number,
  quantityAvailable: number
): SuggestedMatch[] {
  const ranked = openNeeds
    .map((need) => ({
      need,
      breakdown: scoreNeed(need, resourceLat, resourceLng),
    }))
    .sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);

  const suggestions: SuggestedMatch[] = [];
  let remaining = quantityAvailable;
  for (const { need, breakdown } of ranked) {
    if (remaining <= 0) break;
    const stillNeeded = need.quantity_needed - need.quantity_received;
    if (stillNeeded <= 0) continue;
    const quantityAllocated = Math.min(remaining, stillNeeded);
    suggestions.push({ need, quantityAllocated, breakdown });
    remaining -= quantityAllocated;
  }
  return suggestions;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
