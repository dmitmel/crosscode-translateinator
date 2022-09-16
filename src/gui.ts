import * as React from 'react';

/// Idea taken from <https://github.com/libsdl-org/SDL/blob/bd06538778102f72bad8393ef07da5a1ec444217/include/SDL_keycode.h#L324-L347>
export enum KeyMod {
  None = 0,
  Alt = 1 << 2,
  Ctrl = 1 << 1,
  Meta = 1 << 3,
  Shift = 1 << 0,
  MetaOrCtrl = process.platform === 'darwin' ? Meta : Ctrl,
}

export function get_keyboard_event_modifiers(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
): KeyMod {
  let result = KeyMod.None;
  if (event.altKey) result |= KeyMod.Alt;
  if (event.ctrlKey) result |= KeyMod.Ctrl;
  if (event.metaKey) result |= KeyMod.Meta;
  if (event.shiftKey) result |= KeyMod.Shift;
  return result;
}

// <https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L818-L861>
export function set_react_ref<T>(ref: React.Ref<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as { current: T | null }).current = value;
  }
}
