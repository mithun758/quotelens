"use server";

import { revalidatePath } from "next/cache";
import { hasValidSession } from "@/lib/auth/gate";
import { db } from "@/lib/db/client";
import { acceptItem, correctValue, draftQuestion, receiveReply, sendClarification } from "@/lib/review/decisions";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guarded<T>(fn: () => Promise<T>, { changesData = true } = {}): Promise<ActionResult<T>> {
  if (!(await hasValidSession())) return { ok: false, error: "Passcode required" };
  try {
    const data = await fn();
    if (changesData) revalidatePath("/quotes");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function acceptAction(supplier: string, key: string) {
  return guarded(() => acceptItem(db(), supplier, key));
}

export async function correctAction(supplier: string, key: string, valueInr: number, reason: string) {
  return guarded(() => correctValue(db(), supplier, key, valueInr, reason));
}

export async function draftAction(supplier: string, keys: string[]) {
  // Drafting changes nothing, so no refresh: the draft is ready to send immediately.
  return guarded(() => draftQuestion(db(), supplier, keys), { changesData: false });
}

export async function sendAction(supplier: string, keys: string[], subject: string, body: string) {
  return guarded(() => sendClarification(db(), supplier, keys, subject, body));
}

export async function receiveReplyAction(supplier: string) {
  return guarded(() => receiveReply(db(), supplier));
}
