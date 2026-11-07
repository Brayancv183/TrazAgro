/**
 * In-memory fixed-window counter per key (e.g. client IP). Enough for one server instance; with several
 * instances it limits per instance. Each SMS costs money, so login endpoints are capped per IP.
 */
export interface Limiter {
  /** Counts one hit for `key`; returns the seconds to wait when over the limit, otherwise 0. */
  hit(key: string): number;
}

export function fixedWindow(max: number, windowMs: number, now: () => number = Date.now): Limiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    hit(key) {
      const t = now();
      let w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        w = { start: t, count: 0 };
        windows.set(key, w);
        if (windows.size > 50_000) {
          // Keep memory bounded: drop expired windows.
          for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k);
        }
      }
      w.count += 1;
      return w.count > max ? Math.ceil((w.start + windowMs - t) / 1000) : 0;
    },
  };
}

export interface RateLimits {
  /** Code requests (SMS sent) per IP per window. */
  otpRequest: { max: number; windowMs: number };
  /** Code checks per IP per window (guessing protection on top of the 5 tries per code). */
  otpVerify: { max: number; windowMs: number };
}

export const DEFAULT_LIMITS: RateLimits = {
  otpRequest: { max: 10, windowMs: 15 * 60_000 },
  otpVerify: { max: 30, windowMs: 15 * 60_000 },
};
