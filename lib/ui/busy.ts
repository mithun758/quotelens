import { useSyncExternalStore } from "react";

// A long job running in this tab (extraction), so other controls can lock and say why.
type Busy = { label: string; startedAt: number } | null;
let current: Busy = null;
const listeners = new Set<() => void>();

export function setBusy(next: Busy) {
  current = next;
  listeners.forEach((l) => l());
}

export function useBusy(): Busy {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
