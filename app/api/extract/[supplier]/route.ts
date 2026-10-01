import { runExtractionForResponse } from "@/lib/ai/extraction/pipeline";
import { hasValidSession } from "@/lib/auth/gate";
import { db } from "@/lib/db/client";
import { UserFacingError, friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";

// One supplier per request: the Quotes screen calls this for all five at once.
// A route handler, not a server action, because Next.js runs a page's server
// actions one at a time, which would make five extractions take five times longer.
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/extract/[supplier]">) {
  if (!(await hasValidSession())) return Response.json({ error: "Passcode required" }, { status: 401 });
  const { supplier } = await ctx.params;
  try {
    const client = db();
    await enforceRateLimit(client, "extraction_supplier");
    const { data: sup } = await client.from("supplier").select("id").eq("code", supplier.toUpperCase()).single();
    const { data: response } = await client.from("response").select("id").eq("supplier_id", sup?.id ?? "").single();
    if (!response) throw new UserFacingError(`No response from supplier ${supplier}.`);
    const s = await runExtractionForResponse(client, response.id);
    return Response.json({ coverage: s.coverage, inferred: s.inferred, missing: s.missing });
  } catch (error) {
    return Response.json({ error: friendlyError(error, "Extraction") }, { status: error instanceof UserFacingError ? 429 : 502 });
  }
}
