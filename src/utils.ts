export function u32(num: number): number {
  return num | 0;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
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

let current_react_id = 0;
export function new_gui_id(): number {
  let n = current_react_id;
  current_react_id++;
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
