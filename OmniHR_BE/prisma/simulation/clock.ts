// Đồng hồ mô phỏng: thay `new Date()` / `Date.now()` để trả về thời điểm đang phát lại,
// nhờ đó service của API ghi đúng ngày giờ trong quá khứ.

/**
 * The simulated "now". The simulator acts through the API's own services, and
 * those stamp everything with `new Date()` - check-in times, approvals, the
 * day a leave counts as started. Replaying a past day means that `new Date()`
 * has to answer with the moment being replayed, so the global Date is swapped
 * for one that reads this clock while it is set.
 *
 * Only a no-argument `new Date()` and `Date.now()` change; a Date built from a
 * value, `Date.UTC` and the rest behave as always, and a Date created before
 * the swap is still `instanceof Date`.
 */
const RealDate = Date;
let current: number | null = null;

class SimulatedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0 && current !== null) {
      super(current);
    } else {
      super(...(args as ConstructorParameters<DateConstructor>));
    }
  }

  static now() {
    return current ?? RealDate.now();
  }

  static [Symbol.hasInstance](value: unknown) {
    return value instanceof RealDate;
  }
}

let installed = false;

// Bật đồng hồ mô phỏng.
export function installClock() {
  if (!installed) {
    globalThis.Date = SimulatedDate as unknown as DateConstructor;
    installed = true;
  }
}

// Trả lại đồng hồ thật.
export function uninstallClock() {
  if (installed) {
    globalThis.Date = RealDate;
    installed = false;
  }
  current = null;
}

/** Moves the clock to `instant`; `null` lets it run with the wall clock again. */
// Đặt thời điểm hiện tại của mô phỏng.
export function setNow(instant: Date | number | null) {
  current = instant === null ? null : typeof instant === "number" ? instant : instant.getTime();
}

export function simulatedNow() {
  return new RealDate(current ?? RealDate.now());
}
