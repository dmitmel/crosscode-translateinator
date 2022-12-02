import './QuickActions.scss';
import './List.scss';

import cc from 'clsx';
import { Fzf, FzfResultItem } from 'fzf';
import * as React from 'react';

import { FileType } from '../app';
import * as utils from '../utils';
import { AppMainCtx } from './AppMainCtx';
import { WrapperGui } from './Box';
import { KeyCode, KeymapActionsLayer, KeyMod, KeyStrokeEncoded } from './keymap';
import { LabelGui } from './Label';
import { TextInputGui } from './TextInput';
import { VirtListItemFnProps, VirtListScrollAlign, VirtualizedListGui } from './VirtualizedList';

export interface QuickActionsEntry {
  readonly id: number;
  readonly label: string;
  readonly on_selected: () => void;
}

export type QuickListMatchedEntry = FzfResultItem<QuickActionsEntry>;

export interface QuickActionsGuiProps {
  className?: string;
}

export interface QuickActionsGuiState {
  is_visible: boolean;
  filter_value: string;
  entries: Fzf<readonly QuickActionsEntry[]>;
  matched_entries: readonly QuickListMatchedEntry[];
  list_max_height: number;
  selected_index: number;
}

export class QuickActionsGui extends React.Component<QuickActionsGuiProps, QuickActionsGuiState> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<QuickActionsGuiState> = {
    is_visible: false,
    filter_value: '',
    entries: this.create_fzf([]),
    matched_entries: [],
    list_max_height: 0,
    selected_index: 0,
  };

  public root_ref = React.createRef<HTMLDivElement>();
  public keymap_layer = new KeymapActionsLayer();
  public list_ref = React.createRef<VirtualizedListGui>();
  public input_ref = React.createRef<HTMLInputElement>();
  public entries_map = new WeakMap<QuickListMatchedEntry, QuickActionsEntryGui>();

  public get_entry(index: number): QuickActionsEntryGui | undefined {
    return this.entries_map.get(this.state.matched_entries[index]);
  }

  public override componentDidMount(): void {
    this.setup_keymap();
    window.addEventListener('resize', this.on_window_resized);

    let { app } = this.context;
    app.event_project_opened.on(this.on_entries_updated);
    app.event_project_closed.on(this.on_entries_updated);
    app.event_quick_actions_pick.on(this.on_picker_requested);

    this.update_list_max_height();
  }

  public override componentWillUnmount(): void {
    window.removeEventListener('resize', this.on_window_resized);

    let { app } = this.context;
    app.event_project_opened.off(this.on_entries_updated);
    app.event_project_closed.off(this.on_entries_updated);
    app.event_quick_actions_pick.off(this.on_picker_requested);
  }

  private on_entries_updated = (): void => {
    let { app } = this.context;
    let entries: QuickActionsEntry[] = [];
    let file_tree = app.project_game_files_tree;
    for (let file of file_tree.files.values()) {
      if (file !== file_tree.root_dir && !file.is_dir) {
        let { path } = file;
        entries.push({
          id: file.obj_id,
          label: path,
          on_selected: () => app.open_file(FileType.GameFile, path),
        });
      }
    }
    this.setState({ entries: this.create_fzf(entries) });
    this.match_entries();
  };

  private on_picker_requested = (): void => {
    this.show();
  };

  private create_fzf(entries: readonly QuickActionsEntry[]): Fzf<readonly QuickActionsEntry[]> {
    return new Fzf(entries, {
      selector: (entry) => entry.label,
      // Backward matching is intended for use with file paths. We will need a
      // hint system for switching this on or off.
      forward: false,
      casing: 'smart-case',
    });
  }

  private on_filter_input = (event: React.FormEvent<HTMLInputElement>): void => {
    this.setState({ filter_value: event.currentTarget.value });
    this.match_entries();
  };

  private match_entries(): void {
    // TODO: perform the filtering asynchronously
    this.setState((state) => ({ matched_entries: state.entries.find(state.filter_value) }));
    this.select(() => 0);
  }

  private on_list_items_rendered = (_list: VirtualizedListGui): void => {
    this.update_list_max_height();
  };

  private on_window_resized = (_event: UIEvent): void => {
    this.update_list_max_height();
  };

  private update_list_max_height(): void {
    const LIST_HEIGHT_PERCENT = 0.4;
    const LIST_MIN_ITEMS = 14;
    let list_max_height = 0;
    if (this.root_ref.current != null) {
      list_max_height = this.root_ref.current.parentElement!.offsetHeight * LIST_HEIGHT_PERCENT;
    }
    if (this.list_ref.current != null) {
      let item_size = this.list_ref.current.state.average_item_size;
      list_max_height =
        Math.max(Math.floor(list_max_height / item_size), LIST_MIN_ITEMS) * item_size;
    }
    if (list_max_height !== this.state.list_max_height) {
      this.setState({ list_max_height });
    }
  }

  private on_entry_click = (
    entry: QuickListMatchedEntry,
    event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
    entry.item.on_selected();
  };

  public show(callback?: (() => void) | null): void {
    this.setState({ is_visible: true, filter_value: '', selected_index: 0 }, () => {
      this.input_ref.current!.focus();
      callback?.();
    });
    this.match_entries();
  }

  public hide(callback?: (() => void) | null): void {
    this.setState({ is_visible: false, filter_value: '', matched_entries: [] }, () => {
      callback?.();
    });
  }

  public select(
    get_index: (prev_index: number, list_length: number) => number,
    callback?: (() => void) | null,
  ): void {
    this.setState(
      (state) => {
        let len = state.matched_entries.length;
        let idx = utils.clamp(get_index(state.selected_index, len), 0, len - 1);
        return { selected_index: idx };
      },
      () => {
        let list = this.list_ref.current!;
        list.scroll_to_item(this.state.selected_index, VirtListScrollAlign.Auto, () => {
          callback?.();
        });
      },
    );
  }

  private setup_keymap(): void {
    this.keymap_layer.add(KeyCode.Escape, () => {
      this.hide();
    });

    this.keymap_layer.add(KeyCode.Enter, () => {
      this.setState((state) => {
        if (state.matched_entries.length > 0) {
          let entry = state.matched_entries[state.selected_index];
          entry.item.on_selected();
        }
        return null;
      });
      this.hide();
    });

    const is_input_focused = (event: KeyboardEvent): boolean => {
      let input = this.input_ref.current;
      return input != null && event.target === input;
    };

    const focus_current_item = (): void => {
      this.get_entry(this.state.selected_index)?.root_ref.current!.focus();
    };

    const add_motion_keymap = (
      key: KeyStrokeEncoded,
      get_index: (prev_index: number, list_length: number) => number,
      input_focused_key_mod: KeyMod = KeyMod.None,
    ): void => {
      if (input_focused_key_mod === KeyMod.None) {
        this.keymap_layer.add(key, (event) => {
          if (!is_input_focused(event)) {
            this.select(get_index, focus_current_item);
          } else {
            this.select(get_index);
          }
        });
      } else {
        this.keymap_layer.add(key, {
          enabled: (event) => !is_input_focused(event),
          handler: () => this.select(get_index, focus_current_item),
        });
        this.keymap_layer.add(input_focused_key_mod | key, {
          enabled: (event) => is_input_focused(event),
          handler: () => this.select(get_index),
        });
      }
    };

    add_motion_keymap(KeyCode.ArrowUp, (i, len) => (i - 1 > 0 ? i - 1 : len - 1));
    add_motion_keymap(KeyCode.ArrowDown, (i, len) => (i + 1 < len ? i + 1 : 0));
    add_motion_keymap(KeyCode.PageUp, (i) => {
      let list = this.list_ref.current!;
      let start = list.state.visible_slice_start;
      let end = list.state.visible_slice_end;
      return i !== start ? start : i - (end - start);
    });
    add_motion_keymap(KeyCode.PageDown, (i) => {
      let list = this.list_ref.current!;
      let start = list.state.visible_slice_start;
      let end = list.state.visible_slice_end;
      return i !== end - 1 ? end - 1 : i + (end - start);
    });
    add_motion_keymap(KeyCode.Home, (_i) => 0, KeyMod.Cmd);
    add_motion_keymap(KeyCode.End, (_i, len) => len - 1, KeyMod.Cmd);
  }

  private on_key_down_capture = (event: React.KeyboardEvent): void => {
    let { keymap } = this.context;
    keymap.add_layer_to_event(event.nativeEvent, this.keymap_layer);
  };

  public override render(): React.ReactNode {
    return (
      <WrapperGui
        ref={this.root_ref}
        className={cc(this.props.className, 'QuickActions')}
        style={{ display: this.state.is_visible ? null! : 'none' }}
        onKeyDownCapture={this.on_key_down_capture}>
        <WrapperGui className="QuickActions-Header">
          <TextInputGui
            ref={this.input_ref}
            type="search"
            name="filter"
            className="QuickActions-Filter"
            onInput={this.on_filter_input}
            value={this.state.filter_value}
            title="Search quick actions"
            placeholder="Search quick actions"
          />
        </WrapperGui>
        <VirtualizedListGui
          ref={this.list_ref}
          className={cc('BoxItem-expand', 'QuickActions-List', 'List')}
          style={{ maxHeight: this.state.list_max_height }}
          item_count={this.state.matched_entries.length}
          render_item={this.render_list_item}
          item_size={30}
          fixed_size_items
          on_items_rendered={this.on_list_items_rendered}
        />
      </WrapperGui>
    );
  }

  public render_list_item = ({ index, list }: VirtListItemFnProps): React.ReactNode => {
    let match = this.state.matched_entries[index];
    return (
      <QuickActionsEntryGui
        key={match.item.id}
        list={list}
        index={index}
        selected={index === this.state.selected_index}
        match={match}
        map={this.entries_map}
        on_click={this.on_entry_click}
      />
    );
  };
}

export interface QuickActionsEntryGuiProps {
  list: VirtualizedListGui;
  index: number;
  selected: boolean;
  match: QuickListMatchedEntry;
  map?: WeakMap<QuickListMatchedEntry, QuickActionsEntryGui>;
  on_click?: (match: QuickListMatchedEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export class QuickActionsEntryGui extends React.Component<QuickActionsEntryGuiProps, unknown> {
  public root_ref = React.createRef<HTMLButtonElement>();

  public override componentDidMount(): void {
    this.props.list?.on_item_mounted(this.props.index, this.root_ref.current!);
    this.props.map?.set(this.props.match, this);
  }

  public override componentDidUpdate(prev_props: QuickActionsEntryGuiProps): void {
    this.props.list?.on_item_updated(prev_props.index, this.props.index, this.root_ref.current!);
    prev_props.map?.delete(prev_props.match);
    this.props.map?.set(this.props.match, this);
  }

  public override componentWillUnmount(): void {
    this.props.list?.on_item_unmounted(this.props.index, this.root_ref.current!);
    this.props.map?.delete(this.props.match);
  }

  private on_click = (event: React.MouseEvent<HTMLButtonElement>): void => {
    this.props.on_click?.(this.props.match, event);
  };

  public override render(): React.ReactNode {
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc('block', 'QuickActionsEntry', 'ListItem', {
          selected: this.props.selected,
          focused: this.props.selected,
        })}
        tabIndex={this.props.selected ? 0 : -1}
        onClick={this.on_click}>
        <QuickActionsEntryLabelGui match={this.props.match} />
      </button>
    );
  }
}

export interface QuickActionsEntryLabelGuiProps {
  match: QuickListMatchedEntry;
}

export const QuickActionsEntryLabelGui = React.memo(function QuickActionsEntryLabelGui(
  props: QuickActionsEntryLabelGuiProps,
): React.ReactElement {
  let { match } = props;
  let { label } = match.item;
  let elements: React.ReactNode[] = [];

  let slice_start_idx = 0;
  let flush_slice = (slice_end_idx: number, highlight: boolean): void => {
    if (slice_end_idx <= slice_start_idx) return;
    let text_slice = label.slice(slice_start_idx, slice_end_idx);
    if (highlight) {
      elements.push(
        <span key={`highlight;${slice_start_idx};${slice_end_idx}`} className="highlight">
          {text_slice}
        </span>,
      );
    } else {
      elements.push(text_slice);
    }
    slice_start_idx = slice_end_idx;
  };

  flush_slice(match.start, false);
  let prev_state = true;
  for (let i = match.start; i < match.end; i++) {
    let curr_state = match.positions.has(i);
    if (prev_state !== curr_state) {
      flush_slice(i, prev_state);
    }
    prev_state = curr_state;
  }
  flush_slice(match.end, prev_state);
  flush_slice(label.length, false);

  return (
    <LabelGui block ellipsis className="QuickActionsEntryLabel">
      {elements.length > 0 ? elements : '\u00A0'}
    </LabelGui>
  );
});
