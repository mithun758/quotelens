"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="passcode" className="block text-sm font-semibold">
        Passcode
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        className="w-full rounded-xs border border-field bg-sheet px-3 py-2 text-sm"
      />
      {state.error && (
        <p role="alert" className="text-sm text-oxblood">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xs bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-[#2a3d5a] disabled:opacity-45"
      >
        {pending ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
