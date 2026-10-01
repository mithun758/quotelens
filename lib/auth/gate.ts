import { cookies } from "next/headers";
import { PASSCODE_COOKIE, isValidSessionToken } from "./passcode";

// For server actions and route handlers: they are POST endpoints, so check the gate again.
export async function hasValidSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSessionToken(cookieStore.get(PASSCODE_COOKIE)?.value);
}
