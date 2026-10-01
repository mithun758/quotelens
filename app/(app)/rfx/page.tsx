import { RfxScreen } from "@/components/rfx/RfxScreen";
import { asOfDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { getDraft } from "@/lib/rfx/store";

export const metadata = { title: "RFx co-pilot · QuoteLens" };
export const dynamic = "force-dynamic";
// Drafting 30 lines is a multi-step model call.
export const maxDuration = 300;

export default async function RfxPage() {
  const client = db();
  const [state, { data: suppliers }] = await Promise.all([getDraft(client), client.from("supplier").select("code, name").order("code")]);
  return <RfxScreen initial={state} supplierCount={suppliers?.length ?? 0} asOfDate={asOfDate()} />;
}
