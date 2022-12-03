import './ListBox.scss';

import cc from 'clsx';
import * as React from 'react';

import * as utils from '../utils';
import { AppMainCtx } from './AppMainCtx';
import { IconGui } from './Icon';
import { KeyCode, KeymapActionsLayer, KeyMod, KeyStrokeEncoded } from './keymap';
import { LabelGui } from './Label';
import {
  VirtListContainerGui,
  VirtListRenderFnProps,
  VirtListScrollAlign,
  VirtualizedListGui,
} from './VirtualizedList';

export interface ListBoxItem {
  className?: string;
  style?: React.CSSProperties;
  tooltip?: string;
  icon?: string;
  label: string | React.ReactNode;
}

export interface ListBoxGuiProps<T = unknown> {
  className?: string;
  style?: React.CSSProperties;
  item_count: number;
  item_data?: T;
  item_key: (index: number, data: T) => React.Key;
  render_item: (index: number, data: T) => ListBoxItem;
  on_item_activated?: (indices: number[], data: T) => void;
  on_items_rendered?: () => void;
  allow_multi_selection?: boolean;
  selection_follows_focus?: boolean;
  always_highlight?: boolean;
  extra_keymap_layer?: KeymapActionsLayer;
}

export interface ListBoxGuiState {
  focused_index: number | null;
  selected_range_start: number;
  selected_range_end: number;
}

const DEFAULT_LIST_ITEM_SIZE = 30;

export enum ListBoxGetIndexKind {
  First = 1,
  Last,
  Next,
  Prev,
  NextPage,
  PrevPage,
}

export class ListBoxGui<T = unknown> extends React.Component<ListBoxGuiProps<T>, ListBoxGuiState> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<ListBoxGuiState> = {
    focused_index: null,
    selected_range_start: 0,
    selected_range_end: 0,
  };

  public root_ref = React.createRef<VirtualizedListGui>();
  public keymap_layer = new KeymapActionsLayer();
  public entries_map = new Map<React.Key, ListBoxItemGui>();

  private focused_index: number | null = null;
  private selection_range_start = 0;
  private selection_range_end = -1;
  private should_update_dom_focus = false;
  private should_scroll_to_focused: VirtListScrollAlign | null = null;

  public get_entry(index: number): ListBoxItemGui | undefined {
    return this.entries_map.get(this.props.item_key(index, this.props.item_data!));
  }

  public clamp_index(idx: number | null | undefined): number | null {
    let len = this.props.item_count;
    return idx != null && len > 0 ? utils.clamp(idx, 0, len - 1) : null;
  }

  public get_index(kind: ListBoxGetIndexKind): number {
    let len = this.props.item_count;
    let idx = this.focused_index;
    idx = this.get_index_internal(idx ?? -1, len, kind);
    return utils.clamp(idx, 0, len - 1);
  }

  private get_index_internal(i: number, len: number, change: ListBoxGetIndexKind): number {
    switch (change) {
      case ListBoxGetIndexKind.First:
        return 0;
      case ListBoxGetIndexKind.Last:
        return len - 1;
      case ListBoxGetIndexKind.Next:
        return i + 1 < len ? i + 1 : 0;
      case ListBoxGetIndexKind.Prev:
        return i - 1 >= 0 ? i - 1 : len - 1;
      case ListBoxGetIndexKind.NextPage: {
        let list = this.root_ref.current!;
        let start = list.state.visible_slice_start;
        let end = list.state.visible_slice_end;
        return i !== end - 1 ? end - 1 : i + (end - start);
      }
      case ListBoxGetIndexKind.PrevPage: {
        let list = this.root_ref.current!;
        let start = list.state.visible_slice_start;
        let end = list.state.visible_slice_end;
        return i !== start ? start : i - (end - start);
      }
      default:
        throw new Error(`Unknown index kind: ${change}`);
    }
  }

  public get_focused_index(): number | null {
    return this.focused_index;
  }

  public set_focus(
    idx: number | null | undefined,
    options?: {
      set_dom_focus?: boolean | null;
      scroll_to_align?: VirtListScrollAlign | null;
      set_selection?: boolean | null;
    } | null,
  ): void {
    let { set_dom_focus, scroll_to_align, set_selection } = options ?? {};
    this.focused_index = this.clamp_index(idx);
    this.should_update_dom_focus = set_dom_focus ?? true;
    this.should_scroll_to_focused = scroll_to_align ?? VirtListScrollAlign.Auto;
    this.setState({ focused_index: this.focused_index });
    if (set_selection ?? this.props.selection_follows_focus) {
      this.select_index(this.focused_index);
    }
  }

  public set_selected_range(start: number, end: number): void {
    end = utils.clamp(end, -1, this.props.item_count - 1);
    start = utils.clamp(start, 0, end);
    if (!this.props.allow_multi_selection && end > start) {
      if (start === this.selection_range_start) {
        start = end;
      } else {
        end = start;
      }
    }
    this.selection_range_start = start;
    this.selection_range_end = end;
    this.setState({
      selected_range_start: this.selection_range_start,
      selected_range_end: this.selection_range_end,
    });
  }

  public unset_selected_range(): void {
    this.set_selected_range(0, -1);
  }

  public select_index(idx: number | null): void {
    idx = this.clamp_index(idx);
    if (idx != null) {
      this.set_selected_range(idx, idx);
    } else {
      this.unset_selected_range();
    }
  }

  public get_selection_size(): number {
    return this.props.item_count > 0
      ? this.selection_range_end - this.selection_range_start + 1
      : 0;
  }

  public get_selected_indices(): number[] {
    let indices: number[] = [];
    for (let i = this.selection_range_start; i <= this.selection_range_end; i++) {
      indices.push(i);
    }
    return indices;
  }

  public extend_selection(prev_index: number | null, curr_index: number | null): void {
    if (!this.props.allow_multi_selection) {
      this.select_index(curr_index);
      return;
    }

    let selection_start = this.selection_range_start;
    let selection_end = this.selection_range_end;
    let selection_exists = selection_start <= selection_end;
    let cursor_at_selection_start = selection_exists && prev_index === selection_start;
    let cursor_at_selection_end = selection_exists && prev_index === selection_end;

    if (curr_index != null) {
      if (cursor_at_selection_end) {
        selection_end = curr_index;
      } else if (cursor_at_selection_start) {
        selection_start = curr_index;
      } else {
        selection_start = curr_index;
        selection_end = curr_index;
      }
      if (selection_start > selection_end) {
        this.set_selected_range(selection_end, selection_start);
      } else {
        this.set_selected_range(selection_start, selection_end);
      }
    } else {
      this.unset_selected_range();
    }
  }

  public update_dom_focus(): boolean {
    if (this.focused_index == null || this.props.item_count === 0) {
      return true;
    }
    let entry = this.get_entry(this.focused_index);
    if (entry == null) {
      return false;
    }
    entry.root_ref.current!.focus({ preventScroll: true });
    return true;
  }

  public activate(idx: number): void {
    let idx2 = this.clamp_index(idx);
    if (idx2 != null) {
      this.set_focus(idx, { set_selection: true });
      this.props.on_item_activated?.([idx], this.props.item_data!);
    }
  }

  private setup_keymap(): void {
    this.keymap_layer.add(KeyCode.Enter, () => {
      if (this.props.item_count === 0) return;
      if (this.get_selection_size() > 1) {
        this.props.on_item_activated?.(this.get_selected_indices(), this.props.item_data!);
      } else if (this.focused_index != null) {
        this.activate(this.focused_index);
      }
    });

    this.keymap_layer.add(KeyCode.Escape, () => {
      if (this.get_selection_size() > 0) {
        if (this.props.selection_follows_focus) {
          this.select_index(this.focused_index);
        } else {
          this.unset_selected_range();
        }
      } else {
        this.root_ref.current!.list_elem?.focus();
        this.set_focus(null);
      }
    });

    const is_input_focused = (event: KeyboardEvent): boolean => {
      let { target } = event;
      return (
        target instanceof Element && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      );
    };
    const is_input_not_focused = (event: KeyboardEvent): boolean => !is_input_focused(event);

    this.keymap_layer.add(KeyMod.Ctrl | KeyCode.KeyA, {
      enabled: (event) => this.props.allow_multi_selection && !is_input_focused(event),
      handler: () => {
        this.set_selected_range(0, this.props.item_count);
      },
    });

    const add_motion_keymap = (
      key: KeyStrokeEncoded,
      index_kind: ListBoxGetIndexKind,
      input_focused_key_mod = KeyMod.None,
    ): void => {
      const normal_motion_handler = (event: KeyboardEvent): void => {
        this.set_focus(this.get_index(index_kind), { set_dom_focus: !is_input_focused(event) });
      };
      const select_motion_handler = (event: KeyboardEvent): void => {
        if (!this.props.allow_multi_selection) {
          normal_motion_handler(event);
          return;
        }
        let prev_focused_index = this.focused_index;
        this.set_focus(this.get_index(index_kind), {
          set_dom_focus: !is_input_focused(event),
          set_selection: false,
        });
        this.extend_selection(prev_focused_index, this.focused_index);
      };

      if (input_focused_key_mod === KeyMod.None) {
        this.keymap_layer.add(key, normal_motion_handler);
        this.keymap_layer.add(KeyMod.Shift | key, select_motion_handler);
      } else {
        this.keymap_layer.add(key, {
          enabled: is_input_not_focused,
          handler: normal_motion_handler,
        });
        this.keymap_layer.add(KeyMod.Shift | key, {
          enabled: is_input_not_focused,
          handler: select_motion_handler,
        });
        this.keymap_layer.add(input_focused_key_mod | key, {
          enabled: is_input_focused,
          handler: normal_motion_handler,
        });
        this.keymap_layer.add(input_focused_key_mod | KeyMod.Shift | key, {
          enabled: is_input_focused,
          handler: select_motion_handler,
        });
      }
    };

    add_motion_keymap(KeyCode.ArrowUp, ListBoxGetIndexKind.Prev);
    add_motion_keymap(KeyCode.ArrowDown, ListBoxGetIndexKind.Next);
    add_motion_keymap(KeyCode.PageUp, ListBoxGetIndexKind.PrevPage);
    add_motion_keymap(KeyCode.PageDown, ListBoxGetIndexKind.NextPage);
    add_motion_keymap(KeyCode.Home, ListBoxGetIndexKind.First, KeyMod.Cmd);
    add_motion_keymap(KeyCode.End, ListBoxGetIndexKind.Last, KeyMod.Cmd);
  }

  private on_key_down_capture = (event: React.KeyboardEvent): void => {
    let { keymap } = this.context;
    keymap.add_layer_to_event(event.nativeEvent, this.keymap_layer);
    if (this.props.extra_keymap_layer != null) {
      keymap.add_layer_to_event(event.nativeEvent, this.props.extra_keymap_layer);
    }
  };

  private on_item_click = (item_gui: ListBoxItemGui, event: React.MouseEvent): void => {
    event.preventDefault();
    let prev_focused_index = this.focused_index;
    let item_index = item_gui.props.index;
    if (event.shiftKey && this.props.allow_multi_selection) {
      this.set_focus(item_index, { set_selection: false });
      this.extend_selection(prev_focused_index, this.focused_index);
    } else {
      this.activate(item_index);
    }
  };

  public override componentDidMount(): void {
    this.setup_keymap();
    this.update_dom_focus_if_needed();
  }

  public override componentDidUpdate(): void {
    this.update_dom_focus_if_needed();
  }

  public update_dom_focus_if_needed(): void {
    if (this.should_scroll_to_focused) {
      let align: VirtListScrollAlign = this.should_scroll_to_focused;
      if (this.focused_index != null) {
        this.root_ref.current!.scroll_to_item(this.focused_index, align);
      }
      this.should_scroll_to_focused = null;
    }

    if (this.should_update_dom_focus) {
      let ok = this.update_dom_focus();
      if (ok) {
        this.should_update_dom_focus = false;
      }
    }
  }

  private on_items_rendered = (): void => {
    this.update_dom_focus_if_needed();
    this.props.on_items_rendered?.();
  };

  public override render(): React.ReactNode {
    return (
      <VirtualizedListGui
        ref={this.root_ref}
        item_count={this.props.item_count}
        render_items={this.render_list_items}
        item_size={DEFAULT_LIST_ITEM_SIZE}
        fixed_size_items
        on_items_rendered={this.on_items_rendered}
      />
    );
  }

  public render_list_items = (props: VirtListRenderFnProps): React.ReactNode => {
    let { slice_start, slice_end } = props;
    slice_end = utils.clamp(slice_end, 0, this.props.item_count);
    slice_start = utils.clamp(slice_start, 0, slice_end);

    let items: React.ReactNode[] = [];
    for (let idx = slice_start; idx < slice_end; idx++) {
      let key = this.props.item_key(idx, this.props.item_data!);
      let item = this.props.render_item(idx, this.props.item_data!);
      items.push(
        <ListBoxItemGui
          key={key}
          list={props.list}
          map={this.entries_map}
          item_key={key}
          index={idx}
          focused={idx === this.state.focused_index}
          selected={this.state.selected_range_start <= idx && idx <= this.state.selected_range_end}
          item={item}
          on_click={this.on_item_click}
        />,
      );
    }

    return (
      <VirtListContainerGui
        ref={props.ref}
        onScroll={props.on_scroll}
        className={cc(this.props.className, 'ListBox', {
          'ListBox-always-highlight': this.props.always_highlight,
        })}
        style={this.props.style}
        offset_start={props.offset_start}
        offset_end={props.offset_end}
        onKeyDownCapture={this.on_key_down_capture}
        tabIndex={this.state.focused_index != null ? -1 : 0}
        children={items}
      />
    );
  };
}

export interface ListBoxItemGuiProps {
  list?: VirtualizedListGui;
  map?: Map<React.Key, ListBoxItemGui>;
  item_key: React.Key;
  index: number;
  focused?: boolean;
  selected?: boolean;
  item: ListBoxItem;
  on_click?: (item: ListBoxItemGui, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export class ListBoxItemGui extends React.Component<ListBoxItemGuiProps, unknown> {
  public root_ref = React.createRef<HTMLButtonElement>();

  public override componentDidMount(): void {
    this.props.list?.on_item_mounted(this.props.index, this.root_ref.current!);
    this.props.map?.set(this.props.item_key, this);
  }

  public override componentDidUpdate(prev_props: ListBoxItemGuiProps): void {
    this.props.list?.on_item_updated(prev_props.index, this.props.index, this.root_ref.current!);
    prev_props.map?.delete(prev_props.item_key);
    this.props.map?.set(this.props.item_key, this);
  }

  public override componentWillUnmount(): void {
    this.props.list?.on_item_unmounted(this.props.index, this.root_ref.current!);
    this.props.map?.delete(this.props.item_key);
  }

  private on_click = (event: React.MouseEvent<HTMLButtonElement>): void => {
    this.props.on_click?.(this, event);
  };

  public override render(): React.ReactNode {
    let { selected, focused, item } = this.props;
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc(item.className, 'block', 'ListBoxItem', {
          selected,
          focused,
        })}
        style={item.style}
        tabIndex={focused ? 0 : -1}
        title={item.tooltip}
        onClick={this.on_click}>
        {
          // Note that a container element is necessary for enabling ellipsis,
          // otherwise the list item shrinks when the enclosing list begins
          // overflowing.
        }
        <LabelGui block ellipsis>
          {item.icon != null ? <IconGui icon={item.icon} /> : null} {item.label}
        </LabelGui>
      </button>
    );
  }
}
