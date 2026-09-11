import { classifyDomain } from "@/lib/domainClassifier";
import { authenticatedUserId, bearerToken } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { title, description } → { domain, method, reasoning }.
 * Pure classification, no DB write — used by app/problems/new's "Suggest
 * domain" button. Requires login only for consistency with the other AI
 * routes in this app, not because the call itself touches anything private.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to use domain suggestions." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (title.length < 3 && description.length < 10) {
    return Response.json({ error: "Add a title or description first." }, { status: 400 });
  }

  const result = await classifyDomain({ title, description });
  return Response.json(result);
}
