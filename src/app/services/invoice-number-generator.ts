import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, map, of } from 'rxjs';

/**
 * Tunable knobs for {@link InvoiceNumberGenerator.generate}.
 * All fields are optional; defaults are listed in {@link InvoiceNumberGenerator.DEFAULTS}.
 * `maxEntropyMs` is silently clamped to {@link InvoiceNumberGenerator.HARD_CAP_MS}
 * so the call site can never block the main thread for longer than that.
 */
export interface InvoiceGenerationOptions {
  /** Prefix in front of the dash, e.g. `'ORD'` -> `ORD-12345`. */
  prefix?: string;
  /** Number of digits in the suffix. Must be between 1 and 9. */
  digits?: number;
  /** Upper bound on the synchronous CPU entropy loop, in milliseconds. */
  maxEntropyMs?: number;
  /** If true, the random.org leg is skipped and only local entropy is used. */
  skipRandomOrg?: boolean;
}

/**
 * Diagnostics returned with every generated invoice number so callers can
 * surface what actually happened (random.org reachable? how many ops did
 * the CPU loop perform?) without re-running the work.
 */
export interface InvoiceGenerationResult {
  /** The formatted invoice number, e.g. `'ORD-48213'`. */
  invoiceNumber: string;
  /** Raw value pulled from random.org, or `null` when unreachable / skipped. */
  randomOrgValue: number | null;
  /** 32-bit accumulator left in the CPU loop's register after the busy wait. */
  cpuEntropyValue: number;
  /** Iteration count the CPU loop completed in `cpuEntropyMs`. */
  cpuEntropyOps: number;
  /** Wall-clock duration of the CPU loop, in milliseconds. */
  cpuEntropyMs: number;
  /** Wall-clock duration of the entire pipeline, in milliseconds. */
  totalMs: number;
  /** UTC timestamp at which the result was finalized. */
  generatedAt: Date;
}

/** Internal result struct for {@link InvoiceNumberGenerator.runCpuEntropyLoop}. */
interface CpuEntropySample {
  value: number;
  ops: number;
  durationMs: number;
}

/**
 * Generates invoice numbers by mixing three entropy sources:
 *   1. A synchronous CPU busy-wait running a linear congruential generator
 *      (hard-capped at {@link InvoiceNumberGenerator.HARD_CAP_MS}).
 *   2. A single integer fetched from random.org's plain-text integers API.
 *   3. `performance.now()` jitter at start, used as the LCG seed.
 *
 * The three sources are folded together with a SplitMix-style 32-bit
 * finalizer; the bottom `digits` bits drive the printed suffix.
 *
 * Random.org failures are non-fatal: the pipeline falls back to local
 * entropy only and reports `randomOrgValue: null` so the UI can show that
 * the call was attempted but unsuccessful.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceNumberGenerator {
  private readonly http = inject(HttpClient);

  /**
   * Plain-text integers endpoint. Returns a single 32-bit positive integer
   * followed by a newline. CORS-enabled.
   */
  private static readonly RANDOM_ORG_URL =
    'https://www.random.org/integers/?num=1&min=0&max=1000000000&col=1&base=10&format=plain&rnd=new';

  /** Defaults applied when {@link InvoiceGenerationOptions} fields are omitted. */
  private static readonly DEFAULTS: Required<InvoiceGenerationOptions> = {
    prefix: 'ORD',
    digits: 5,
    maxEntropyMs: 750,
    skipRandomOrg: false,
  };

  /**
   * Absolute ceiling on the CPU loop. Any `maxEntropyMs` larger than this
   * is clamped down; the main thread will never be blocked longer than
   * this value by a single `generate()` call.
   */
  private static readonly HARD_CAP_MS = 5000;

  /** Minimum digits in the printed suffix. */
  private static readonly MIN_DIGITS = 1;
  /** Maximum digits in the printed suffix (`10^9` fits safely in i32). */
  private static readonly MAX_DIGITS = 9;

  /**
   * Run the full pipeline and emit a single {@link InvoiceGenerationResult}.
   * The Observable defers all work until subscribed so the CPU loop does
   * not fire as a side effect of constructing the pipeline.
   */
  generate(
    options: InvoiceGenerationOptions = {},
  ): Observable<InvoiceGenerationResult> {
    const opts = this.normalizeOptions(options);
    return defer(() => {
      const start = performance.now();
      const cpu = this.runCpuEntropyLoop(opts.maxEntropyMs);
      const randomOrg$ = opts.skipRandomOrg
        ? of<number | null>(null)
        : this.fetchRandomOrgSeed().pipe(catchError(() => of<number | null>(null)));

      return randomOrg$.pipe(
        map((randomOrgValue) => this.assembleResult(cpu, randomOrgValue, opts, start)),
      );
    });
  }

  /**
   * Convenience helper that returns only the formatted invoice number.
   * Telemetry is discarded; use {@link generate} when diagnostics are needed.
   */
  generateInvoiceNumber(
    options: InvoiceGenerationOptions = {},
  ): Observable<string> {
    return this.generate(options).pipe(map((result) => result.invoiceNumber));
  }

  /**
   * Apply defaults, clamp `maxEntropyMs` against the hard cap, and clamp
   * `digits` to a sane range.
   */
  private normalizeOptions(
    options: InvoiceGenerationOptions,
  ): Required<InvoiceGenerationOptions> {
    const merged: Required<InvoiceGenerationOptions> = {
      ...InvoiceNumberGenerator.DEFAULTS,
      ...options,
    };
    if (merged.maxEntropyMs > InvoiceNumberGenerator.HARD_CAP_MS) {
      merged.maxEntropyMs = InvoiceNumberGenerator.HARD_CAP_MS;
    }
    if (merged.maxEntropyMs < 0) {
      merged.maxEntropyMs = 0;
    }
    if (merged.digits < InvoiceNumberGenerator.MIN_DIGITS) {
      merged.digits = InvoiceNumberGenerator.MIN_DIGITS;
    }
    if (merged.digits > InvoiceNumberGenerator.MAX_DIGITS) {
      merged.digits = InvoiceNumberGenerator.MAX_DIGITS;
    }
    return merged;
  }

  /**
   * Synchronous busy-wait. Iterates a 32-bit LCG until `maxMs` has elapsed
   * (or immediately if `maxMs` is 0) and returns the final accumulator,
   * op count, and observed wall-clock duration.
   *
   * The body is intentionally trivial - one multiply-add per iteration -
   * so the loop is CPU-bound rather than allocation-bound and the op
   * count reported in telemetry is meaningful.
   */
  private runCpuEntropyLoop(maxMs: number): CpuEntropySample {
    const start = performance.now();
    let acc = (start * 1000) >>> 0;
    let ops = 0;
    if (maxMs <= 0) {
      return { value: acc, ops, durationMs: 0 };
    }
    while (performance.now() - start < maxMs) {
      acc = ((Math.imul(acc, 1103515245) + 12345) | 0) >>> 0;
      ops++;
    }
    return { value: acc, ops, durationMs: performance.now() - start };
  }

  /**
   * GET random.org's plain-text integer endpoint. Throws when the body
   * does not parse to a finite number; callers `catchError` and degrade
   * to local entropy.
   */
  private fetchRandomOrgSeed(): Observable<number> {
    return this.http
      .get(InvoiceNumberGenerator.RANDOM_ORG_URL, { responseType: 'text' })
      .pipe(
        map((text) => {
          const value = Number.parseInt(text.trim(), 10);
          if (!Number.isFinite(value)) {
            throw new Error('random.org returned a non-numeric response');
          }
          return value;
        }),
      );
  }

  /**
   * SplitMix-style 32-bit finalizer over the CPU accumulator and the
   * random.org seed (or `Date.now()` when random.org was unreachable).
   */
  private mixEntropy(cpu: number, randomOrg: number | null): number {
    const a = cpu >>> 0;
    const fallback = (Date.now() & 0xffffffff) >>> 0;
    const b = randomOrg !== null ? randomOrg >>> 0 : fallback;
    let x = (a ^ Math.imul(b, 0x9e3779b9)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  /** Map a 32-bit seed onto a `digits`-wide zero-padded decimal string. */
  private formatSuffix(seed: number, digits: number): string {
    const span = 10 ** digits;
    const value = (seed >>> 0) % span;
    return value.toString(10).padStart(digits, '0');
  }

  /** Final assembly step: mix, format, and decorate with telemetry. */
  private assembleResult(
    cpu: CpuEntropySample,
    randomOrgValue: number | null,
    opts: Required<InvoiceGenerationOptions>,
    pipelineStart: number,
  ): InvoiceGenerationResult {
    const seed = this.mixEntropy(cpu.value, randomOrgValue);
    const suffix = this.formatSuffix(seed, opts.digits);
    return {
      invoiceNumber: `${opts.prefix}-${suffix}`,
      randomOrgValue,
      cpuEntropyValue: cpu.value,
      cpuEntropyOps: cpu.ops,
      cpuEntropyMs: cpu.durationMs,
      totalMs: performance.now() - pipelineStart,
      generatedAt: new Date(),
    };
  }
}
