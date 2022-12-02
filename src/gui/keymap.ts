import { Event2 } from '../events';
import { IS_FIREFOX, IS_MAC } from '../gui';
import { has_key } from '../utils';

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

export namespace KeyCodeUtils {
  export function has_named(code: string): code is keyof typeof KeyCode {
    return typeof code === 'string' && has_key(KeyCode, code);
  }

  export function has_numeric(code: number): code is KeyCode {
    return typeof code === 'number' && has_key(KeyCode, code);
  }
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

export type KeyStrokeEncoded = number;

export class KeyStroke {
  public readonly code: KeyCode;
  public readonly modifiers: KeyMod;

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

    if (code === 0 || !KeyCodeUtils.has_numeric(code)) {
      // Unknown or missing numeric code, try to find one by name.
      let str_code = event.code;
      if (KeyCodeUtils.has_named(str_code)) {
        code = KeyCode[str_code];
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

  public encode(): KeyStrokeEncoded {
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

export class KeymapHelper {
  public readonly event_context_sym = Symbol(KeymapEventContext.constructor.name);

  public global_key_modifiers = KeyMod.None;
  public event_global_key_modifiers_change = new Event2<[state: KeyMod]>();
  public set_global_key_modifiers(state: KeyMod): void {
    this.global_key_modifiers = state;
    this.event_global_key_modifiers_change.fire(state);
  }

  public prepare_event(event: KeyboardEvent): KeymapEventContext | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event_any: any = event;
    if (event_any[this.event_context_sym] != null) {
      throw new Error(
        `This KeyboardEvent has already been fitted with a ${KeymapEventContext.constructor.name}`,
      );
    }

    if (event.isComposing || event.keyCode === 229) {
      return null; // An event from the Input Method Editor, ignore.
    }

    let key_stroke = new KeyStroke(event);
    let context = new KeymapEventContext(key_stroke);
    event_any[this.event_context_sym] = context;

    if (this.global_key_modifiers !== key_stroke.modifiers) {
      this.set_global_key_modifiers(key_stroke.modifiers);
    }

    return context;
  }

  public get_context_of_event(event: KeyboardEvent): KeymapEventContext | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event_any: any = event;
    return event_any[this.event_context_sym];
  }

  public add_layer_to_event(event: KeyboardEvent, layer: KeymapActionsLayer): void {
    let context = this.get_context_of_event(event);
    context?.layers.push(layer);
  }

  public process_event_actions(event: KeyboardEvent): boolean {
    let ctx = this.get_context_of_event(event);
    if (ctx == null) return false;

    let key_stroke_encoded = ctx.key_stroke.encode();
    for (let i = ctx.layers.length - 1; i >= 0; i--) {
      let layer: KeymapActionsLayer = ctx.layers[i];
      let action = layer.map.get(key_stroke_encoded);
      if (action == null) continue;

      if (action.enabled != null && !action.enabled(event, ctx)) {
        continue;
      }

      let should_prevent_default = action.prevent_default ?? true;
      try {
        let did_handle = action.handler(event, ctx);
        if (did_handle != null && !did_handle) {
          should_prevent_default = false;
          continue; // Note that the `finally` block will still be executed.
        }
      } finally {
        if (should_prevent_default) {
          event.preventDefault();
        }
      }

      return true;
    }
    return false;
  }
}

export class KeymapEventContext {
  public readonly layers: KeymapActionsLayer[] = [];

  public constructor(public readonly key_stroke: KeyStroke) {}
}

export class KeymapActionsLayer {
  public readonly map = new Map<KeyStrokeEncoded, Readonly<KeymapAction>>();

  public add(
    key_stroke: KeyStrokeEncoded,
    action: KeymapAction['handler'] | Readonly<KeymapAction>,
  ): this {
    if (typeof action === 'function') {
      action = { handler: action };
    }
    this.map.set(key_stroke, action);
    return this;
  }
}

export interface KeymapAction {
  prevent_default?: boolean;
  enabled?: (event: KeyboardEvent, context: KeymapEventContext) => boolean | null | undefined;
  handler: (event: KeyboardEvent, context: KeymapEventContext) => boolean | void;
}
