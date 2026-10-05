// The welcome screen: shown on a first visit, and again on request (the About link or `?`).

/** The part of localStorage the welcome needs. */
export interface SeenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'jelly-cells:welcomed';

/** True until the visitor has started once. A browser that refuses storage is welcomed every time. */
export function shouldWelcome(store: SeenStore): boolean {
  try { return store.getItem(KEY) === null; } catch { return true; }
}

export function markWelcomed(store: SeenStore): void {
  try { store.setItem(KEY, '1'); } catch { /* private mode: nothing to remember */ }
}

/**
 * Wires the dialog: it opens on a first visit, closes on Start, Escape or a click outside,
 * and a cell picked in it is opened through `pick`.
 */
export function initWelcome(pick: (cellId: string) => void): HTMLDialogElement {
  const dialog = document.getElementById('welcome') as HTMLDialogElement;
  const storage = (): SeenStore => window.localStorage;
  const seen = () => { try { markWelcomed(storage()); } catch { /* storage unavailable */ } };
  dialog.addEventListener('close', seen);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.getElementById('welcome-start')!.addEventListener('click', () => dialog.close());
  document.getElementById('welcome-open')!.addEventListener('click', () => dialog.showModal());
  dialog.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((b) => b.addEventListener('click', () => {
    dialog.close();
    pick(b.dataset.cell!);
  }));
  let first = true;
  try { first = shouldWelcome(storage()); } catch { /* storage unavailable: welcome anyway */ }
  if (first) dialog.showModal();
  return dialog;
}
