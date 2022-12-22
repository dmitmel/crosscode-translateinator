import './QuickActions.scss';

import cc from 'clsx';
import * as React from 'react';

import { BaseAppObject, BaseRenderData, FileType } from '../app';
import { FuzzyItem, FuzzyItemRoData, FuzzyMatcher, FuzzyMatcherCasing } from '../fuzzy_matcher';
import * as utils from '../utils';
import { AppMainCtx } from './AppMainCtx';
import { WrapperGui } from './Box';
import { KeyCode, KeymapActionsLayer } from './keymap';
import { ListBoxGetIndexKind, ListBoxGui, ListBoxItem } from './ListBox';
import { TextInputGui } from './TextInput';
import { VirtualizedListGui } from './VirtualizedList';

export class QuickActionsEntryRoData extends BaseRenderData {
  public constructor(public override readonly ref: QuickActionsEntry) {
    super(ref);
  }
  public readonly label: string = this.ref.label;
  public readonly label_fuzzy_match: FuzzyItemRoData = this.ref.label_fuzzy_match.get_render_data();
}

export class QuickActionsEntry extends BaseAppObject<QuickActionsEntryRoData> {
  public label_fuzzy_match = new FuzzyItem<QuickActionsEntry>(this.label, this);

  public constructor(public readonly label: string, public readonly on_selected: () => void) {
    super();
  }

  protected override get_render_data_impl(): QuickActionsEntryRoData {
    return new QuickActionsEntryRoData(this);
  }
}

export interface QuickActionsGuiProps {
  className?: string;
}

export interface QuickActionsGuiState {
  is_visible: boolean;
  filter_value: string;
  entries: ReadonlyArray<QuickActionsEntryRoData | null>;
  list_max_height: number;
}

export class QuickActionsGui extends React.Component<QuickActionsGuiProps, QuickActionsGuiState> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<QuickActionsGuiState> = {
    is_visible: false,
    filter_value: '',
    entries: [],
    list_max_height: 0,
  };

  public root_ref = React.createRef<HTMLDivElement>();
  public keymap_layer = new KeymapActionsLayer();
  public list_ref = React.createRef<ListBoxGui>();
  public list_extra_keymap_layer = new KeymapActionsLayer();
  public input_ref = React.createRef<HTMLInputElement>();

  private entries: QuickActionsEntry[] = [];
  private matcher = new FuzzyMatcher<QuickActionsEntry>();

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

    this.matcher.event_completed.on(this.on_matcher_done);

    this.update_list_max_height();
  }

  public override componentWillUnmount(): void {
    window.removeEventListener('resize', this.on_window_resized);

    let { app } = this.context;
    app.event_project_opened.off(this.on_entries_updated);
    app.event_project_closed.off(this.on_entries_updated);
    app.event_quick_actions_pick.off(this.on_picker_requested);

    this.matcher.event_completed.off(this.on_matcher_done);
  }

  private on_entries_updated = (): void => {
    let { app } = this.context;
    this.entries.length = 0;
    let file_tree = app.project_game_files_tree;
    for (let file of file_tree.files.values()) {
      if (!file.is_dir()) {
        let { path } = file;
        this.entries.push(
          new QuickActionsEntry(path, () => app.open_file(FileType.GameFile, path)),
        );
      }
    }
  };

  private on_picker_requested = (): void => {
    this.show();
  };

  private on_filter_input = (event: React.FormEvent<HTMLInputElement>): void => {
    this.setState({ filter_value: event.currentTarget.value }, () => {
      this.match_entries();
    });
  };

  private match_entries(): void {
    this.matcher.reset_state();
    for (let item of this.entries) {
      this.matcher.enqueue_item(item.label_fuzzy_match);
    }
    void this.matcher.start_task(this.state.filter_value, {
      // Backward matching is intended for use with file paths.
      // TODO: We will need a hint system for switching this on or off.
      forward_matching: false,
      case_sensitivity: FuzzyMatcherCasing.Smart,
    });
  }

  private on_matcher_done = (): void => {
    let entries = this.matcher.get_sorted_items_list().map((item) => {
      item.data.mark_changed();
      return item.data.get_render_data();
    });
    this.setState({ entries }, () => {
      let list = this.list_ref.current!;
      list.set_focus(list.get_index(ListBoxGetIndexKind.First), { set_dom_focus: false });
    });
  };

  private on_list_items_rendered = (): void => {
    this.update_list_max_height();
  };

  private on_list_item_activated = (indices: number[]): void => {
    for (let index of indices) {
      let entry = this.state.entries[index];
      entry?.ref.on_selected();
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
    this.matcher.stop_task();
    this.setState({ is_visible: false, filter_value: '', entries: [] }, () => {
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
          item_count={this.state.entries.length}
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
    let match = this.state.entries[index];
    return match != null ? `id:${match.ref.obj_id}` : `idx:${index}`;
  };

  private render_list_item = (index: number): ListBoxItem => {
    let entry = this.state.entries[index];
    if (entry == null) {
      return {
        label: utils.CHAR_NBSP,
      };
    }
    return {
      icon: 'file-earmark',
      label: <QuickActionsEntryLabelGui fuzzy_match={entry.label_fuzzy_match} />,
    };
  };
}

export interface QuickActionsEntryLabelGuiProps {
  fuzzy_match: FuzzyItemRoData;
}

export const QuickActionsEntryLabelGui = React.memo(function QuickActionsEntryLabelGui(
  props: QuickActionsEntryLabelGuiProps,
): React.ReactElement {
  let { text, match_start, match_end, match_positions } = props.fuzzy_match;
  let elements: React.ReactNode[] = [];

  let slice_start_idx = 0;
  let flush_slice = (slice_end_idx: number, highlight: boolean): void => {
    if (slice_end_idx <= slice_start_idx) return;
    let text_slice = text.slice(slice_start_idx, slice_end_idx);
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

  flush_slice(match_start, false);
  let prev_state = true;
  for (let i = match_start; i < match_end; i++) {
    let curr_state = match_positions.has(i);
    if (prev_state !== curr_state) {
      flush_slice(i, prev_state);
    }
    prev_state = curr_state;
  }
  flush_slice(match_end, prev_state);
  flush_slice(text.length, false);

  return <>{elements.length > 0 ? elements : utils.CHAR_NBSP}</>;
});
