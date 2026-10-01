// Arjun's sign-off on substitute models. Approved substitutes count toward L1 and
// totals; pending and rejected ones are shown but never counted.
import type { Db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import type { SubstituteStatus } from "@/lib/db/types";

export async function decideSubstitute(
  client: Db,
  valueId: string,
  decision: Exclude<SubstituteStatus, "pending">,
  reason: string,
): Promise<void> {
  if (decision === "rejected" && !reason.trim()) throw new Error("Give a reason for rejecting the substitute.");
  const { data: value, error } = await client.from("extracted_value").select("*").eq("id", valueId).single();
  if (error || !value) throw new Error("That value no longer exists. Refresh and try again.");
  if (!value.substitute_check) throw new Error("This value is not a substitute model.");

  const [{ data: line }, { data: response }] = await Promise.all([
    client.from("line_item").select("line_no, description").eq("id", value.line_item_id ?? "").single(),
    client.from("response").select("supplier_id").eq("id", value.response_id).single(),
  ]);
  const { data: supplier } = await client.from("supplier").select("code").eq("id", response?.supplier_id ?? "").single();

  await client.from("extracted_value").update({ substitute_status: decision }).eq("id", valueId);
  await client.from("flag").update({ status: "resolved" }).eq("extracted_value_id", valueId).eq("type", "substitute_pending_signoff").eq("status", "open");
  await recordAuditEvent(
    {
      actor: "arjun",
      action: decision === "approved" ? "approve_substitute" : "reject_substitute",
      target: `${supplier?.code ?? "?"} line ${line?.line_no ?? "?"}: ${line?.description ?? ""}`,
      before: { substitute_status: value.substitute_status },
      after: { substitute_status: decision, check: value.substitute_check },
      reason: reason.trim() || undefined,
    },
    client,
  );
}
