/**
 * Test-environment repairs. Runs before every suite; everything here is guarded so the node-only
 * tests are unaffected.
 *
 * Node 26 ships an experimental global `localStorage` that is unavailable unless the process was
 * started with `--localstorage-file`, and it takes precedence over the one jsdom would otherwise
 * install. Anything touching storage then fails on `undefined` rather than on its own logic. This
 * puts a plain in-memory Storage back, which is all a test needs.
 */
if (typeof window !== 'undefined' && !window.localStorage) {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();

    get length(): number {
      return this.store.size;
    }

    clear(): void {
      this.store.clear();
    }

    getItem(key: string): string | null {
      return this.store.has(key) ? (this.store.get(key) as string) : null;
    }

    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }
  }

  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  // Tests that simulate private browsing patch Storage.prototype, so it has to be reachable.
  Object.defineProperty(window, 'Storage', { value: MemoryStorage, configurable: true });
}
