import { useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

/**
 * How long a message stays before it withdraws itself.
 *
 * A success is a receipt — it has been read by the time the sentence is finished, and leaving it
 * on screen only asks to be dismissed. A failure is not: it says something did not happen, usually
 * names why, and the reader may well be looking at the field it concerns rather than at the
 * corner. That one waits to be dismissed.
 */
const LINGER: Record<ToastTone, number | null> = {
  success: 4000,
  info: 5000,
  error: null,
};

/**
 * The queue.
 *
 * A module-level store read through useSyncExternalStore, the same shape use-theme uses: the thing
 * being published is not owned by any component, and anything in the product — an API call inside
 * a feature, a page effect — has to be able to post to it without a provider in scope.
 */
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

/** Timers by toast id, so dismissing early does not leave one firing at a dead entry. */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function publish(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = (): Toast[] => toasts;

/*
  One array identity for every server render, so useSyncExternalStore does not see a new value on
  each call and loop. The queue is always empty there — nothing has happened yet.
*/
const EMPTY: Toast[] = [];
const getServerSnapshot = (): Toast[] => EMPTY;

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }

  const next = toasts.filter((entry) => entry.id !== id);
  if (next.length === toasts.length) return;

  toasts = next;
  publish();
}

/**
 * How many are shown at once.
 *
 * A screen that posts six messages in a second — a bulk import reporting each row — should not
 * bury its own interface under them. The oldest gives way, because the newest is the one that
 * describes what just happened.
 */
const MOST = 3;

function post(tone: ToastTone, message: string): number {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message }].slice(-MOST);
  publish();

  const linger = LINGER[tone];
  if (linger !== null) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), linger),
    );
  }

  return id;
}

/**
 * Say what just happened.
 *
 * The channel the token file reserved `--z-toast: 1100` for and nothing ever claimed. Before this,
 * saving a ledger closed a dialog and said nothing at all, and a failure became a paragraph that
 * shoved the page down as it appeared.
 */
export const toast = {
  success: (message: string) => post('success', message),
  error: (message: string) => post('error', message),
  info: (message: string) => post('info', message),
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test seam: drops every queued message and its timer. */
export function resetToasts(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts = [];
  publish();
}
