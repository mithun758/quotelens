"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PASSCODE_COOKIE,
  PASSCODE_COOKIE_MAX_AGE,
  checkPasscode,
  isGateConfigured,
  sessionToken,
} from "@/lib/auth/passcode";

export type LoginState = { error: string | null };

// Only allow same-site relative paths, so ?next= cannot redirect off-site.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/rfx";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isGateConfigured()) {
    return { error: "DEMO_PASSCODE is not set on the server." };
  }

  const attempt = formData.get("passcode");
  if (typeof attempt !== "string" || !checkPasscode(attempt)) {
    return { error: "That passcode is not right." };
  }

  const cookieStore = await cookies();
  cookieStore.set(PASSCODE_COOKIE, sessionToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASSCODE_COOKIE_MAX_AGE,
  });

  redirect(safeNext(formData.get("next")));
}
