import { moderateContent, PostKind } from "@/lib/moderation";
import { authenticatedUserId, bearerToken } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { text, type: "problem" | "answer" } → { verdict, reasoning, method }.
 * Classifies only; nothing is saved. Posting routes call the same
 * moderateContent() before they insert.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token || !(await authenticatedUserId(token))) {
    return Response.json({ error: "Log in to use moderation." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const kind = body?.type === "problem" || body?.type === "answer" ? (body.type as PostKind) : null;
  if (!text || !kind) {
    return Response.json({ error: 'text and type ("problem" or "answer") are required.' }, { status: 400 });
  }

  const result = await moderateContent({ text, kind });
  return Response.json(result);
}
