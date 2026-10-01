// An override's reason is printed in the memo and logged as Priya's decision, so it
// must say something: at least 15 characters once trimmed. Enforced on the server and
// mirrored in the Award screen.
export const OVERRIDE_MIN_CHARS = 15;

export function overrideReasonProblem(reason: string): string | null {
  return reason.trim().length < OVERRIDE_MIN_CHARS ? `Give a reason of at least ${OVERRIDE_MIN_CHARS} characters; it is printed in the memo.` : null;
}
