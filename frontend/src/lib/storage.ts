const KEY = "shipstake:commitment-ids";
const AMOUNTS_KEY = "shipstake:commitment-amounts";

export function getTrackedIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function trackId(id: number, amountWei?: bigint) {
  const ids = getTrackedIds();
  if (!ids.includes(id)) {
    window.localStorage.setItem(KEY, JSON.stringify([...ids, id]));
  }
  if (amountWei !== undefined) {
    try {
      const raw = window.localStorage.getItem(AMOUNTS_KEY);
      const amounts = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      amounts[String(id)] = amountWei.toString();
      window.localStorage.setItem(AMOUNTS_KEY, JSON.stringify(amounts));
    } catch {
      // best-effort; the card falls back to wording without a number
    }
  }
}

/** Original stake recorded at creation time — the contract zeroes `amount`
 * once a stake is slashed or withdrawn, so settled cards need this to show
 * what the commitment was worth. Null for commitments created before this
 * was tracked (or in another browser). */
export function getTrackedAmount(id: number): bigint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AMOUNTS_KEY);
    if (!raw) return null;
    const value = (JSON.parse(raw) as Record<string, string>)[String(id)];
    return value ? BigInt(value) : null;
  } catch {
    return null;
  }
}
