import { EventBox } from './events';

export const CHAR_NBSP = '\u00A0';

export function clamp(n: number, min: number, max: number): number {
  // NOTE: if min > max, min will be returned
  return Math.max(min, Math.min(max, n));
}

export function random(min = 0, max = 1): number {
  return Math.random() * (max - min) + min;
}

export function has_key(obj: unknown, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/// Taken from <https://stackoverflow.com/a/6234804/12005228>.
export function escape_html(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** @deprecated */
export function assert(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error('Assertion failed');
  }
}

// For when something obvious must be proven.
export function type_assert<T>(value: unknown): asserts value is T {}
export function assert_nonnull<T>(value: T | null | undefined): asserts value is T {}

let current_gui_id = 0;
export function new_gui_id(): number {
  let n = current_gui_id;
  current_gui_id++;
  return n;
}

export function new_html_id(prefix = 'id'): string {
  return `${prefix}${new_gui_id().toString(10)}`;
}

export function strip_prefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str.slice(prefix.length) : str;
}

export function sanity_check_slice(start: number, end: number, list_len: number): void {
  ASSERT(start <= end);
  ASSERT(0 <= start && start <= list_len);
  ASSERT(0 <= end && end <= list_len);
}

// <https://docs.python.org/3/library/stdtypes.html#dict.setdefault>
export function map_set_default<K, V>(map: Map<K, V>, key: K, default_value: V): V {
  if (map.has(key)) {
    return map.get(key)!;
  } else {
    map.set(key, default_value);
    return default_value;
  }
}

export function group_by<T, K>(arr: T[], fn: (value: T, index: number) => K): Map<K, T[]> {
  let result = new Map<K, T[]>();
  for (let i = 0, len = arr.length; i < len; i++) {
    let item = arr[i];
    let key = fn(item, i);
    let batch = result.get(key);
    if (batch == null) {
      result.set(key, [item]);
    } else {
      batch.push(item);
    }
  }
  return result;
}

export interface SplitIterResult {
  index: number;
  start: number;
  end: number;
  is_last: boolean;
}

export function* split_iter(str: string, sep: string): Generator<SplitIterResult> {
  let result: SplitIterResult = {
    index: 0,
    start: 0,
    end: 0,
    is_last: true,
  };
  let start = 0;
  let index = 0;
  do {
    let end = str.indexOf(sep, start);
    let is_last = end < 0;
    if (is_last) end = str.length;
    result.index = index;
    result.start = start;
    result.end = end;
    result.is_last = is_last;
    yield result;
    index++;
    start = end + 1;
  } while (start < str.length);
}

export function array_remove<T>(array: T[], element: T): number {
  let index = array.indexOf(element);
  if (index >= 0) {
    array.splice(index, 1);
  }
  return index;
}

export function binary_search(
  start: number,
  end: number,
  comparator: (index: number) => number,
  extra_opts?: {
    find_very_first?: boolean | null;
    find_very_last?: boolean | null;
    find_strictly_equal?: boolean | null;
  } | null,
): number | null {
  extra_opts ??= {};
  start = Math.trunc(start);
  end = Math.trunc(end);
  let result: number | null = null;
  let strict = Boolean(extra_opts.find_strictly_equal ?? true);

  if (extra_opts.find_very_first) {
    let lo = start;
    let hi = end;
    let found = false;
    while (lo < hi) {
      let mid = lo + Math.floor((hi - lo) / 2);
      let cmp = comparator(mid);
      found ||= cmp === 0;
      if (cmp < 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (found || !strict) {
      result = lo;
    }

    //
  } else if (extra_opts.find_very_last) {
    let lo = start;
    let hi = end;
    let found = false;
    while (lo < hi) {
      let mid = lo + Math.floor((hi - lo) / 2);
      let cmp = comparator(mid);
      found ||= cmp === 0;
      if (cmp > 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    if (found || !strict) {
      result = Math.max(hi - 1, start);
    }

    //
  } else {
    let lo = start;
    let hi = end - 1;
    let found = false;
    while (lo <= hi) {
      let mid = lo + Math.floor((hi - lo) / 2);
      let cmp = comparator(mid);
      if (cmp < 0) {
        lo = mid + 1;
      } else if (cmp > 0) {
        hi = mid - 1;
      } else {
        result = mid;
        found = true;
        break;
      }
    }
    if (!found && !strict) {
      result = Math.max(lo - 1, start);
    }
  }

  if (result != null && start <= result && result <= end) {
    return result;
  } else {
    return null;
  }
}

export class Unique {
  public toString(): string {
    return '[object Unique]';
  }
}

export class Queue<T> {
  protected elements: Array<T | null>;
  protected head: number;

  public constructor(elements?: Array<T | null> | Iterable<T> | null) {
    if (Array.isArray(elements)) {
      this.elements = elements; // Take over the array as our internal storage
    } else if (elements != null) {
      this.elements = Array.from(elements);
    } else {
      this.elements = [];
    }
    this.head = 0;
  }

  public clone(): Queue<T> {
    return new Queue(this.elements.slice(this.head));
  }

  public size(): number {
    return this.elements.length - this.head;
  }

  public capacity(): number {
    return this.elements.length;
  }

  public is_empty(): boolean {
    return this.head >= this.elements.length;
  }

  public at(index: number): T {
    return this.elements[this.head + Math.max(0, index)]!;
  }

  public front(): T | null {
    return this.head < this.elements.length ? this.elements[this.head] : null;
  }

  public back(): T | null {
    return this.head < this.elements.length ? this.elements[this.elements.length - 1] : null;
  }

  public get_slice(): T[] {
    return this.elements.slice(this.head) as T[];
  }

  public *[Symbol.iterator](): Generator<T, void> {
    // NOTE: The iterator must account for changes of the queue while it is
    // being iterated.
    for (let i = 0; i < this.size(); i++) {
      yield this.at(i);
    }
  }

  public enqueue(element: T): void {
    this.elements.push(element);
  }

  public enqueue_many(new_elements: readonly T[]): void {
    for (let i = 0, len = new_elements.length; i < len; i++) {
      this.elements.push(new_elements[i]);
    }
  }

  public dequeue(): T | undefined {
    let out: T | undefined;
    let i = this.head;
    if (i < this.elements.length) {
      out = this.elements[i]!;
      this.elements[i] = null;
      this.head = i + 1;
    }
    this.shrink_if_needed();
    return out;
  }

  public dequeue_many(count: number, out: T[] = []): T[] {
    let next_head = Math.min(this.head + count, this.elements.length);
    for (let i = this.head; i < next_head; i++) {
      out.push(this.elements[i]!);
      this.head = i + 1;
      this.elements[i] = null;
    }
    this.shrink_if_needed();
    return out;
  }

  public shrink_if_needed(): void {
    if (this.head >= this.elements.length) {
      this.clear();
    } else if (this.head >= this.elements.length / 2) {
      this.shrink();
    }
  }

  public clear(): void {
    this.elements.length = 0;
    this.head = 0;
  }

  public shrink(): void {
    this.elements.splice(0, this.head);
    this.head = 0;
  }
}

export class CancellationError extends Error {
  public constructor() {
    super('Canceled');
    this.name = this.constructor.name;
  }
}

export class CancellationToken {
  public readonly is_cancelled = false;
  public readonly event_cancelled = new EventBox();

  public throw_if_cancelled(): void {
    if (this.is_cancelled) {
      throw new CancellationError();
    }
  }

  public cancel(): void {
    if (!this.is_cancelled) {
      (this as { is_cancelled: boolean }).is_cancelled = true;
      this.event_cancelled.fire();
      this.event_cancelled.remove_all_listeners();
      (this as { event_cancelled: EventBox }).event_cancelled = null!;
    }
  }

  public on_cancelled(listener: () => void): () => void {
    if (this.is_cancelled) {
      listener();
      return () => {};
    }
    this.event_cancelled.on(listener);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.event_cancelled.off(listener);
    };
  }
}

export function wait(ms: number, token?: CancellationToken | null): Promise<void> {
  ASSERT(0 <= ms && ms <= 0x7fffffff);
  if (token == null) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  return new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      remove_cancelled();
      if (token.is_cancelled) {
        reject(new CancellationError());
      } else {
        resolve();
      }
    }, ms);
    let remove_cancelled = token.on_cancelled(() => {
      clearTimeout(id);
      reject(new CancellationError());
    });
  });
}

export function wait_next_tick(token?: CancellationToken | null): Promise<void> {
  return wait(0, token);
}
