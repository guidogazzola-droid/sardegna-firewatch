export class TtlCache {
  #entries = new Map();

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.#entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key, value, ttlMs) {
    this.#entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  clear() {
    this.#entries.clear();
  }
}
