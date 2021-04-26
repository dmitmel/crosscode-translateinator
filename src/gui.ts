import * as Inferno from 'inferno';

export type ComponentProps<P> = P & { children?: Inferno.InfernoNode };

export function infernoForwardRef<P, R = Element>(
  render: (
    props: P & Inferno.Refs<P> & { children?: Inferno.InfernoNode },
    context?: Inferno.Ref<R> | Inferno.Refs<R>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any,
): Inferno.SFC<P> & Inferno.ForwardRef {
  return Inferno.forwardRef(render) as Inferno.SFC<P> & Inferno.ForwardRef;
}

/// Idea taken from <https://github.com/libsdl-org/SDL/blob/bd06538778102f72bad8393ef07da5a1ec444217/include/SDL_keycode.h#L324-L347>
export enum KeyMod {
  None = 0,
  Alt = 1 << 2,
  Ctrl = 1 << 1,
  Meta = 1 << 3,
  Shift = 1 << 0,
}

export function get_keyboard_event_modifiers(event: KeyboardEvent | MouseEvent): KeyMod {
  let result = KeyMod.None;
  if (event.altKey) result |= KeyMod.Alt;
  if (event.ctrlKey) result |= KeyMod.Ctrl;
  if (event.metaKey) result |= KeyMod.Meta;
  if (event.shiftKey) result |= KeyMod.Shift;
  return result;
}
