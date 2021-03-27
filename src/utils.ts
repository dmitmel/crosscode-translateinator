import * as Inferno from 'inferno';

export function u32(num: number): number {
  return num | 0;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function infernoForwardRef<P, R = Element>(
  render: (
    props: P & Inferno.Refs<P> & { children?: Inferno.InfernoNode },
    context?: Inferno.Ref<R> | Inferno.Refs<R>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any,
): Inferno.SFC<P> & Inferno.ForwardRef {
  return Inferno.forwardRef(render) as Inferno.SFC<P> & Inferno.ForwardRef;
}

export type ComponentProps<P> = P & { children?: Inferno.InfernoNode };

export function hasKey(obj: unknown, key: PropertyKey): boolean {
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
