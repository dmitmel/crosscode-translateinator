export function u32(num: number): number {
  return num | 0;
}

export function clamp(n: number, min: number, max: number): number {
  // NOTE: if min > max, min will be returned
  return Math.max(min, Math.min(max, n));
}

export function random(min = 0, max = 1): number {
  return Math.random() * (max - min) + min;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  assert(start <= end);
  assert(0 <= start && start <= list_len);
  assert(0 <= end && end <= list_len);
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
