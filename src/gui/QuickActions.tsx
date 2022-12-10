import './QuickActions.scss';

import cc from 'clsx';
import * as React from 'react';

import { FileType } from '../app';
import { FuzzyMatcher, FzfResultItem } from '../fuzzy_matcher';
import { AppMainCtx } from './AppMainCtx';
import { WrapperGui } from './Box';
import { KeyCode, KeymapActionsLayer } from './keymap';
import { ListBoxGetIndexKind, ListBoxGui, ListBoxItem } from './ListBox';
import { TextInputGui } from './TextInput';
import { VirtualizedListGui } from './VirtualizedList';

export interface QuickActionsEntry {
  readonly id: number;
  readonly label: string;
  readonly on_selected: () => void;
}

export type QuickActionsMatchedEntry = FzfResultItem<QuickActionsEntry>;

export interface QuickActionsGuiProps {
  className?: string;
}

export interface QuickActionsGuiState {
  is_visible: boolean;
  filter_value: string;
  entries: FuzzyMatcher<QuickActionsEntry>;
  matched_entries: readonly QuickActionsMatchedEntry[];
  list_max_height: number;
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
  };

  public root_ref = React.createRef<HTMLDivElement>();
  public keymap_layer = new KeymapActionsLayer();
  public list_ref = React.createRef<ListBoxGui>();
  public list_extra_keymap_layer = new KeymapActionsLayer();
  public input_ref = React.createRef<HTMLInputElement>();

  public get virt_list_ref(): VirtualizedListGui | null | undefined {
    return this.list_ref.current?.root_ref.current;
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
      if (!file.is_dir()) {
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

  private create_fzf(entries: readonly QuickActionsEntry[]): FuzzyMatcher<QuickActionsEntry> {
    return new FuzzyMatcher(entries, {
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
    let list = this.list_ref.current!;
    list.set_focus(list.get_index(ListBoxGetIndexKind.First), { set_dom_focus: false });
  }

  private on_list_items_rendered = (): void => {
    this.update_list_max_height();
  };

  private on_list_item_activated = (indices: number[]): void => {
    for (let index of indices) {
      let entry = this.state.matched_entries[index];
      entry.item.on_selected();
    }
    this.hide();
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
    let list = this.virt_list_ref;
    if (list != null) {
      let item_size = list.state.average_item_size;
      list_max_height =
        Math.max(Math.floor(list_max_height / item_size), LIST_MIN_ITEMS) * item_size;
    }
    if (list_max_height !== this.state.list_max_height) {
      this.setState({ list_max_height });
    }
  }

  public show(callback?: (() => void) | null): void {
    this.setState({ is_visible: true, filter_value: '' }, () => {
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

  private setup_keymap(): void {
    this.keymap_layer.add(KeyCode.Escape, () => this.hide());
    this.list_extra_keymap_layer.add(KeyCode.Escape, () => this.hide());
  }

  private on_key_down_capture = (event: React.KeyboardEvent): void => {
    let { keymap } = this.context;
    keymap.add_layer_to_event(event.nativeEvent, this.list_ref.current!.keymap_layer);
    keymap.add_layer_to_event(event.nativeEvent, this.keymap_layer);
  };

  // A more advanced implementation of focus tracking:
  // <https://github.com/microsoft/vscode/blob/1.73.1/src/vs/base/browser/dom.ts#L857-L919>
  private on_child_blur = (event: React.FocusEvent): void => {
    let root_elem = event.currentTarget;
    // <https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/relatedTarget>
    let next_focused_elem = event.relatedTarget;
    if (!root_elem.contains(next_focused_elem)) {
      this.hide();
    }
  };

  public override render(): React.ReactNode {
    return (
      <WrapperGui
        ref={this.root_ref}
        className={cc(this.props.className, 'QuickActions')}
        style={{ display: this.state.is_visible ? null! : 'none' }}
        onKeyDownCapture={this.on_key_down_capture}
        onBlur={this.on_child_blur}>
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
        <ListBoxGui
          ref={this.list_ref}
          className={cc('BoxItem-expand', 'QuickActions-List')}
          style={{ maxHeight: this.state.list_max_height }}
          item_count={this.state.matched_entries.length}
          item_key={this.get_list_item_key}
          render_item={this.render_list_item}
          on_items_rendered={this.on_list_items_rendered}
          selection_follows_focus
          always_highlight
          on_item_activated={this.on_list_item_activated}
          extra_keymap_layer={this.list_extra_keymap_layer}
        />
      </WrapperGui>
    );
  }

  private get_list_item_key = (index: number): React.Key => {
    let match = this.state.matched_entries[index];
    return match.item.id;
  };

  private render_list_item = (index: number): ListBoxItem => {
    let match = this.state.matched_entries[index];
    return {
      icon: 'file-earmark',
      label: <QuickActionsEntryLabelGui match={match} />,
    };
  };
}

export interface QuickActionsEntryLabelGuiProps {
  match: QuickActionsMatchedEntry;
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

  return <>{elements.length > 0 ? elements : '\u00A0'}</>;
});
