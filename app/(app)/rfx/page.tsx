import { RfxScreen } from "@/components/rfx/RfxScreen";
import { asOfDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { getDraft } from "@/lib/rfx/store";

export const metadata = { title: "RFx workspace · QuoteLens" };
export const dynamic = "force-dynamic";

export default async function RfxPage() {
  const client = db();
  const [state, { data: suppliers }] = await Promise.all([getDraft(client), client.from("supplier").select("code, name").order("code")]);
  // Keyed by the draft's update time, so the screen re-reads the draft after Lens edits it.
  return <RfxScreen key={state.updatedAt ?? "new"} initial={state} suppliers={suppliers ?? []} asOfDate={asOfDate()} />;
}
