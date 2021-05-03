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
