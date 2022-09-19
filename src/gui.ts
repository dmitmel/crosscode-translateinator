import * as React from 'react';

import { has_key } from './utils';

export const IS_FIREFOX = navigator.userAgent.includes('Firefox');

export const IS_MAC =
  typeof process !== 'undefined'
    ? process.platform === 'darwin'
    : navigator.userAgent.includes('Macintosh');

// <https://domeventviewer.com/key-event-viewer.html> - Very useful tool
// <https://github.com/microsoft/vscode/blob/1.71.2/src/vs/base/common/keyCodes.ts#L484-L723>
// <https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values>
// <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode#value_of_keycode>
// <http://gcctech.org/csc/javascript/javascript_keycodes.htm>
// <https://www.toptal.com/developers/keycode/table-of-all-keycodes>
// <https://www.w3.org/TR/2022/WD-uievents-20220913/#legacy-key-models>
// <https://www.w3.org/TR/2017/CR-uievents-code-20170601/>
// <https://www.w3.org/TR/2017/CR-uievents-key-20170601/>
// <https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes>
// <https://github.com/facebook/react/blob/v17.0.2/packages/react-dom/src/events/SyntheticEvent.js#L295-L312>
export enum KeyCode {
  Unidentified = 0,
  Backspace = 8,
  Tab = 9,
  Clear = 12,
  Enter = 13,
  Shift = 16,
  Control = 17,
  Alt = 18,
  Pause = 19,
  CapsLock = 20,
  Escape = 27,
  Space = 32,
  PageUp = 33,
  PageDown = 34,
  End = 35,
  Home = 36,
  ArrowLeft = 37,
  ArrowUp = 38,
  ArrowRight = 39,
  ArrowDown = 40,
  PrintScreen = 44,
  Insert = 45,
  Delete = 46,
  Digit0 = 48,
  Digit1 = 49,
  Digit2 = 50,
  Digit3 = 51,
  Digit4 = 52,
  Digit5 = 53,
  Digit6 = 54,
  Digit7 = 55,
  Digit8 = 56,
  Digit9 = 57,
  KeyA = 65,
  KeyB = 66,
  KeyC = 67,
  KeyD = 68,
  KeyE = 69,
  KeyF = 70,
  KeyG = 71,
  KeyH = 72,
  KeyI = 73,
  KeyJ = 74,
  KeyK = 75,
  KeyL = 76,
  KeyM = 77,
  KeyN = 78,
  KeyO = 79,
  KeyP = 80,
  KeyQ = 81,
  KeyR = 82,
  KeyS = 83,
  KeyT = 84,
  KeyU = 85,
  KeyV = 86,
  KeyW = 87,
  KeyX = 88,
  KeyY = 89,
  KeyZ = 90,
  OSLeft = 91,
  MetaLeft = 91,
  OSRight = 92,
  MetaRight = 92,
  ContextMenu = 93,
  Numpad0 = 96,
  Numpad1 = 97,
  Numpad2 = 98,
  Numpad3 = 99,
  Numpad4 = 100,
  Numpad5 = 101,
  Numpad6 = 102,
  Numpad7 = 103,
  Numpad8 = 104,
  Numpad9 = 105,
  NumpadMultiply = 106,
  NumpadAdd = 107,
  NumpadComma = 108,
  NumpadSubtract = 109,
  NumpadDecimal = 110,
  NumpadDivide = 111,
  F1 = 112,
  F2 = 113,
  F3 = 114,
  F4 = 115,
  F5 = 116,
  F6 = 117,
  F7 = 118,
  F8 = 119,
  F9 = 120,
  F10 = 121,
  F11 = 122,
  F12 = 123,
  F13 = 124,
  F14 = 125,
  F15 = 126,
  F16 = 127,
  F17 = 128,
  F18 = 129,
  F19 = 130,
  F20 = 131,
  F21 = 132,
  F22 = 133,
  F23 = 134,
  F24 = 135,
  NumLock = 144,
  ScrollLock = 145,
  Semicolon = 186,
  Equal = 187,
  Comma = 188,
  Minus = 189,
  Period = 190,
  Slash = 191,
  Backquote = 192,
  BracketLeft = 219,
  Backslash = 220,
  BracketRight = 221,
  Quote = 222,
  OS = 224,
  Meta = 224,
  AltGraph = 225,
  Compose = 230,
}

// prettier-ignore
export enum KeyMod {
  None  = 0x0000,
  Shift = 0x1000,
  Ctrl  = 0x2000,
  Alt   = 0x4000,
  Meta  = 0x8000,
}

export namespace KeyMod {
  // Defined externally to not mess up the reverse mapping of values to names.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export const Cmd = IS_MAC ? KeyMod.Meta : KeyMod.Ctrl;
}

export class KeyStroke {
  public readonly code: number;
  public readonly modifiers: number;

  public constructor(event: KeyboardEvent) {
    this.code = KeyStroke.normalize_key_code(event);
    this.modifiers = KeyStroke.get_modifiers(event);
  }

  // <https://github.com/microsoft/vscode/blob/1.71.2/src/vs/base/browser/keyboardEvent.ts#L13-L48>
  // <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode#value_of_keycode>
  // This article pretty much summarizes the situation with cross-browser key
  // code recognition: <https://unixpapa.com/js/key.html>. Well, it has gotten
  // better since then...
  public static normalize_key_code(event: KeyboardEvent): KeyCode {
    let code = event.keyCode;

    // Handle browser quirks.
    if (IS_FIREFOX) {
      if (code === 173) return KeyCode.Minus;
      if (code === 61) return KeyCode.Equal;
      if (code === 59) return KeyCode.Semicolon;
    }
    if (IS_MAC && code === 93) {
      return KeyCode.Meta;
    }

    if (code === 0 || !(typeof code === 'number' && has_key(KeyCode, code))) {
      // Unknown or missing numeric code, try to find one by name.
      let str_code = event.code;
      if (typeof str_code === 'string' && has_key(KeyCode, str_code)) {
        code = KeyCode[str_code as keyof typeof KeyCode];
      } else {
        // Well, tough luck.
        code = KeyCode.Unidentified;
      }
    }

    // For some reason only the codes of the Meta key are differentiated
    // between the right and left (unlike Alt, Control and Shift) location...
    // AND there is an additional location-neutral code.
    if (code === KeyCode.MetaLeft || code === KeyCode.MetaRight) {
      return KeyCode.Meta;
    }

    return code;
  }

  public static get_modifiers(event: KeyboardEvent): KeyMod {
    let mods = KeyMod.None;
    if (event.shiftKey) mods |= KeyMod.Shift;
    if (event.ctrlKey) mods |= KeyMod.Ctrl;
    if (event.altKey) mods |= KeyMod.Alt;
    if (event.metaKey) mods |= KeyMod.Meta;
    return mods;
  }

  public encode(): number {
    return this.code | this.modifiers;
  }

  public toString(): string {
    let str: string[] = [];
    if (this.modifiers & KeyMod.Shift) str.push('shift');
    if (this.modifiers & KeyMod.Ctrl) str.push('ctrl');
    if (this.modifiers & KeyMod.Alt) str.push('alt');
    if (this.modifiers & KeyMod.Meta) str.push('meta');
    if (this.code !== KeyCode.Unidentified) str.push(KeyCode[this.code]);
    return `<${this.constructor.name} ${str.join('+')}>`;
  }
}

// <https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L818-L861>
export function set_react_ref<T>(ref: React.Ref<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as { current: T | null }).current = value;
  }
}
