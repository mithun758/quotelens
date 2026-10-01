import { useSyncExternalStore } from "react";

const noop = () => () => {};

// False on the server and while hydrating, true afterwards. Lets a component render
// exactly what the server rendered first, then switch to browser-only state (the Lens
// dock's saved open state) without a hydration mismatch.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
