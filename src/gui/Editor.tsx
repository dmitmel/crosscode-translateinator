import './Editor.scss';

import cc from 'clsx';
import * as preact from 'preact';

import { FragmentRoData, TranslationRoData } from '../app';
import * as gui from '../gui';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, BoxItemFillerGui, WrapperGui } from './Box';
import { IconButtonGui } from './Button';
import { EditorTabListGui } from './EditorTabs';
import { FancyTextGui } from './FancyText';
import { IconGui, IconlikeTextGui } from './Icon';
import { LabelGui } from './Label';
import { TextAreaGui } from './TextInput';

export interface EditorGuiProps {
  className?: string;
}

export function EditorGui(props: EditorGuiProps): preact.VNode {
  return (
    <BoxGui orientation="vertical" className={cc(props.className, 'Editor')}>
      <EditorTabListGui />
      <FragmentListToolbarGui />
      <FragmentListGui />
    </BoxGui>
  );
}

export interface FragmentListGuiProps {
  className?: string;
}

export interface FragmentListGuiState {
  list: readonly FragmentRoData[];
  slice_start: number;
  slice_end: number;
  current_index: number;
}

export const FRAGMENT_LIST_LOAD_DISTANCE = 0;
export const FRAGMENT_LIST_SLICE_MAX_LENGTH = 40;
export const FRAGMENT_LIST_LOAD_CHUNK_SIZE = 20;

export class FragmentListGui extends preact.Component<FragmentListGuiProps, FragmentListGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: Readonly<FragmentListGuiState> = {
    list: [],
    slice_start: 0,
    slice_end: 0,
    current_index: 0,
    ...this.copy_state_from_app(),
  };

  private copy_state_from_app(): Partial<FragmentListGuiState> {
    let { app } = this.context;
    let start = app.fragment_list_slice_start;
    let end = app.fragment_list_slice_end;
    return {
      slice_start: start,
      slice_end: end,
      list: app.current_fragment_list.map((f) => f.get_render_data()),
      current_index: app.current_fragment_index,
    };
  }

  private root_ref = preact.createRef<HTMLDivElement>();
  private fragment_guis_map = new WeakMap<FragmentRoData, FragmentGui>();
  private fragment_observer: IntersectionObserver | null = null;
  private fragment_observer_map: WeakMap<Element, FragmentGui> | null = null;
  private visible_fragments = new Set<FragmentGui>();

  public get_fragment_gui_by_index(index: number): FragmentGui | undefined {
    return this.fragment_guis_map.get(this.state.list[index]);
  }

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.on(this.on_fragment_list_update);
    app.event_current_fragment_change.on(this.on_current_fragment_change);

    utils.assert(this.fragment_observer == null);
    utils.assert(this.fragment_observer_map == null);
    this.fragment_observer = new IntersectionObserver(this.on_fragment_intersection_change, {
      root: this.root_ref.current!,
    });
    this.fragment_observer_map = new WeakMap();
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.off(this.on_fragment_list_update);
    app.event_current_fragment_change.off(this.on_current_fragment_change);

    utils.assert(this.fragment_observer != null);
    utils.assert(this.fragment_observer_map != null);
    this.fragment_observer.disconnect();
    this.fragment_observer = null;
    this.fragment_observer_map = null;
  }

  // TODO: current fragment should be not the first visible one, but the first
  // fully visible one.
  private on_fragment_intersection_change = (entries: IntersectionObserverEntry[]): void => {
    utils.assert(this.fragment_observer != null);
    utils.assert(this.fragment_observer_map != null);
    let { app } = this.context;

    let affected_fragments: FragmentGui[] = [];
    for (let entry of entries) {
      let fragment_gui = this.fragment_observer_map.get(entry.target);
      utils.assert(fragment_gui != null);
      fragment_gui.is_visible = entry.isIntersecting;
      if (fragment_gui.is_visible) {
        this.visible_fragments.add(fragment_gui);
      } else {
        this.visible_fragments.delete(fragment_gui);
      }
      affected_fragments.push(fragment_gui);
    }

    let new_slice_start = app.fragment_list_slice_start;
    let new_slice_end = app.fragment_list_slice_end;
    let list_length = app.current_fragment_list.length;
    // The following must be done in a second loop because we rely on the
    // `is_visible` flags, and they must be filled in correctly on all affected
    // fragments.
    for (let fragment_gui of affected_fragments) {
      // I don't care about fragments which became invisible, however they will
      // be eventually unloaded when an edge of the list slice is reached.
      if (!fragment_gui.is_visible) continue;
      let fragment_index = fragment_gui.props.index;

      // Check if the very first fragment in the slice is visible.
      if (fragment_index - FRAGMENT_LIST_LOAD_DISTANCE <= new_slice_start) {
        new_slice_start = Math.max(new_slice_start - FRAGMENT_LIST_LOAD_CHUNK_SIZE, 0);
      }
      // Check if the very last fragment in the slice is visible.
      if (fragment_index + FRAGMENT_LIST_LOAD_DISTANCE >= new_slice_end - 1) {
        new_slice_end = Math.min(new_slice_end + FRAGMENT_LIST_LOAD_CHUNK_SIZE, list_length);
      }
    }

    // Sanity-check the validity of the new range after extending.
    utils.sanity_check_slice(new_slice_start, new_slice_end, list_length);

    let slice_grew_at_start = new_slice_start < app.fragment_list_slice_start;
    let slice_grew_at_end = new_slice_end > app.fragment_list_slice_end;
    if (!slice_grew_at_start && !slice_grew_at_end) {
      // ok. my work here is done
      //
    } else if (slice_grew_at_start && !slice_grew_at_end) {
      // The list grew only at the beginning, shrink the end as far as possible.

      while (new_slice_end - new_slice_start > FRAGMENT_LIST_SLICE_MAX_LENGTH) {
        let other_fragment_gui = this.get_fragment_gui_by_index(new_slice_end - 1);
        utils.assert(other_fragment_gui != null);
        if (!other_fragment_gui.is_visible) {
          new_slice_end--;
        } else {
          // No more invisible (out of range) fragments to unload.
          break;
        }
      }

      //
    } else if (!slice_grew_at_start && slice_grew_at_end) {
      // The list grew only at the end, shrink the beginning as far as possible.

      while (new_slice_end - new_slice_start > FRAGMENT_LIST_SLICE_MAX_LENGTH) {
        let other_fragment_gui = this.get_fragment_gui_by_index(new_slice_start);
        utils.assert(other_fragment_gui != null);
        if (!other_fragment_gui.is_visible) {
          new_slice_start++;
        } else {
          // No more invisible (out of range) fragments to unload.
          break;
        }
      }

      //
    } else if (slice_grew_at_start && slice_grew_at_end) {
      // The list grew at both edges, most likely because the screen is larger
      // than the list chunk size. Try to shrink as far as possible?
      throw new Error('TODO');

      //
    } else {
      // wut?
      throw new Error('Unreachable');
    }

    // Sanity-check again after shrinking.
    utils.sanity_check_slice(new_slice_start, new_slice_end, list_length);

    if (
      new_slice_start !== app.fragment_list_slice_start ||
      new_slice_end !== app.fragment_list_slice_end
    ) {
      app.fragment_list_slice_start = new_slice_start;
      app.fragment_list_slice_end = new_slice_end;
      app.event_fragment_list_update.fire();
    }

    // Why doesn't JS have a binary tree Set collection?
    let top_index: number | null = null;
    for (let fragment_gui of this.visible_fragments) {
      let { index } = fragment_gui.props;
      if (top_index == null || index < top_index) {
        top_index = index;
      }
    }

    app.set_current_fragment_index(top_index ?? 0, /* jump */ false);
  };

  private on_fragment_list_update = (): void => {
    this.setState(this.copy_state_from_app());
  };

  private on_current_fragment_change = (jump: boolean): void => {
    let { app } = this.context;
    this.setState({ current_index: app.current_fragment_index }, () => {
      let current_fragment_gui = this.get_fragment_gui_by_index(this.state.current_index);
      if (jump) {
        current_fragment_gui!.root_ref.current!.scrollIntoView();
      }
    });
  };

  public override render(): preact.VNode {
    let contents: preact.VNode[] = [];

    let len = this.state.list.length;
    let start = utils.clamp(this.state.slice_start, 0, len);
    let end = utils.clamp(this.state.slice_end, 0, len);
    for (let i = start; i < end; i++) {
      let fragment = this.state.list[i];
      if (i > start) {
        contents.push(<hr key={`${fragment.id}-sep`} className="FragmentList-Separator" />);
      }
      contents.push(
        <FragmentGui
          key={fragment.id}
          index={i}
          is_current={i === this.state.current_index}
          fragment={fragment}
          map={this.fragment_guis_map}
          intersection_observer={this.fragment_observer}
          intersection_observer_map={this.fragment_observer_map}
        />,
      );
    }

    return (
      <WrapperGui
        ref={this.root_ref}
        scroll
        className={cc(this.props.className, 'BoxItem-expand', 'FragmentList')}>
        {contents}
      </WrapperGui>
    );
  }
}

export interface FragmentListToolbarGuiProps {
  className?: string;
}

export interface FragmentListToolbarGuiState {
  jump_pos_value: string;
  filter_value: string;
  fragment_count: number;
}

export class FragmentListToolbarGui extends preact.Component<
  FragmentListToolbarGuiProps,
  FragmentListToolbarGuiState
> {
  public override context!: AppMainGuiCtx;
  public override state: Readonly<FragmentListToolbarGuiState> = {
    jump_pos_value: '0',
    filter_value: '',
    fragment_count: this.context.app.current_fragment_list.length,
  };

  public static readonly FRAGMENT_PAGINATION_JUMP = 10;

  private jump_pos_input_ref = preact.createRef<HTMLInputElement>();
  private filter_input_ref = preact.createRef<HTMLInputElement>();

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.on(this.on_fragment_list_update);
    app.event_current_fragment_change.on(this.on_current_fragment_change);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.off(this.on_fragment_list_update);
    app.event_current_fragment_change.off(this.on_current_fragment_change);
  }

  private on_current_fragment_change = (): void => {
    this.jump_pos_input_ref.current!.blur();
    let { app } = this.context;
    this.setState({ jump_pos_value: (app.current_fragment_index + 1).toString() });
  };

  private on_fragment_list_update = (): void => {
    let { app } = this.context;
    this.setState({ fragment_count: app.current_fragment_list.length });
  };

  private on_jump_pos_input = (event: preact.JSX.TargetedEvent<HTMLInputElement>): void => {
    this.setState({ jump_pos_value: event.currentTarget.value });
  };

  private on_jump_pos_submit = (event: preact.JSX.TargetedEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let { app } = this.context;
    let jump_pos = parseInt(this.state.jump_pos_value, 10);
    if (!Number.isSafeInteger(jump_pos)) return;
    app.set_current_fragment_index(jump_pos - 1, /* jump */ true);
  };

  private on_jump_pos_unfocus = (_event: preact.JSX.TargetedFocusEvent<HTMLInputElement>): void => {
    let { app } = this.context;
    this.setState({ jump_pos_value: app.current_fragment_index.toString() });
  };

  private on_jump_button_click = (
    jump_type: 'first' | 'back_many' | 'back_one' | 'fwd_one' | 'fwd_many' | 'last',
    _event: preact.JSX.TargetedMouseEvent<HTMLButtonElement>,
  ): void => {
    let { app } = this.context;
    let jump_pos = app.current_fragment_index;
    let long_jump = FragmentListToolbarGui.FRAGMENT_PAGINATION_JUMP;
    let fragment_count = app.current_fragment_list.length;
    // prettier-ignore
    switch (jump_type) {
      case 'first':     { jump_pos  = 0;                break; }
      case 'back_many': { jump_pos -= long_jump;        break; }
      case 'back_one':  { jump_pos -= 1;                break; }
      case 'fwd_one':   { jump_pos += 1;                break; }
      case 'fwd_many':  { jump_pos += long_jump;        break; }
      case 'last':      { jump_pos  = fragment_count-1; break; }
    }
    app.set_current_fragment_index(jump_pos, /* jump */ true);
  };

  private on_filter_submit = (_event: preact.JSX.TargetedEvent<HTMLFormElement>): void => {};

  private on_filter_input = (event: preact.JSX.TargetedEvent<HTMLInputElement>): void => {
    this.setState({ filter_value: event.currentTarget.value });
  };

  public override render(): preact.VNode {
    let long_jump = FragmentListToolbarGui.FRAGMENT_PAGINATION_JUMP;
    return (
      <WrapperGui className={cc('FragmentListToolbar', this.props.className)}>
        <BoxGui
          orientation="horizontal"
          align_items="center"
          className="FragmentListToolbar-Pagination">
          <IconButtonGui
            icon="chevron-bar-left"
            title="First"
            onClick={(event) => this.on_jump_button_click('first', event)}
          />
          <IconButtonGui
            icon="chevron-double-left"
            title={`Back by ${long_jump}`}
            onClick={(event) => this.on_jump_button_click('back_many', event)}
          />
          <IconButtonGui
            icon="chevron-left"
            title="Previous"
            onClick={(event) => this.on_jump_button_click('back_one', event)}
          />
          <form onSubmit={this.on_jump_pos_submit}>
            <input
              ref={this.jump_pos_input_ref}
              type="number"
              name="jump_pos"
              className="FragmentListToolbar-JumpInput"
              onInput={this.on_jump_pos_input}
              onBlur={this.on_jump_pos_unfocus}
              value={this.state.jump_pos_value}
              min={Math.min(1, this.state.fragment_count)}
              max={this.state.fragment_count}
              disabled={this.state.fragment_count === 0}
              title="Jump to..."
              autoComplete="off"
            />
          </form>
          <IconlikeTextGui icon="/" />
          <LabelGui selectable title="Total fragments">
            {this.state.fragment_count}
          </LabelGui>
          <IconButtonGui
            icon="chevron-right"
            title="Next"
            onClick={(event) => this.on_jump_button_click('fwd_one', event)}
          />
          <IconButtonGui
            icon="chevron-double-right"
            title={`Forward by ${long_jump}`}
            onClick={(event) => this.on_jump_button_click('fwd_many', event)}
          />
          <IconButtonGui
            icon="chevron-bar-right"
            title="Last"
            onClick={(event) => this.on_jump_button_click('last', event)}
          />
          <BoxItemFillerGui />
          <form onSubmit={this.on_filter_submit}>
            <input
              ref={this.filter_input_ref}
              type="filter"
              name="filter"
              className="FragmentListToolbar-Filter"
              onInput={this.on_filter_input}
              value={this.state.filter_value}
              title="Quick search"
              placeholder="Quick search..."
              autoComplete="off"
            />
          </form>
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface FragmentGuiProps {
  className?: string;
  index: number;
  is_current: boolean;
  fragment: FragmentRoData;
  map: WeakMap<FragmentRoData, FragmentGui>;
  intersection_observer: IntersectionObserver | null;
  intersection_observer_map: WeakMap<Element, FragmentGui> | null;
}

export class FragmentGui extends preact.Component<FragmentGuiProps, unknown> {
  public override context!: AppMainGuiCtx;
  public root_ref = preact.createRef<HTMLDivElement>();
  public is_visible = false;

  private on_file_path_component_click = (component_path: string): void => {
    console.log('search', component_path);
  };

  private on_json_path_component_click = (component_path: string): void => {
    console.log('search', this.props.fragment.game_file_path, component_path);
  };

  private on_copy_original_text = (
    _event: preact.JSX.TargetedMouseEvent<HTMLButtonElement>,
  ): void => {
    nw.Clipboard.get().set(this.props.fragment.original_text);
  };

  public override componentDidMount(): void {
    this.register_into_container(this.props);

    let { intersection_observer, intersection_observer_map } = this.props;
    utils.assert(intersection_observer != null);
    utils.assert(intersection_observer_map != null);
    intersection_observer.observe(this.root_ref.current!);
    intersection_observer_map.set(this.root_ref.current!, this);
  }

  public override componentDidUpdate(prev_props: FragmentGuiProps): void {
    this.unregister_from_container(prev_props);
    this.register_into_container(this.props);
  }

  public override componentWillUnmount(): void {
    this.unregister_from_container(this.props);

    let { intersection_observer, intersection_observer_map } = this.props;
    utils.assert(intersection_observer != null);
    utils.assert(intersection_observer_map != null);
    intersection_observer.unobserve(this.root_ref.current!);
    intersection_observer_map.delete(this.root_ref.current!);
  }

  public register_into_container(props: FragmentGuiProps): void {
    props.map.set(props.fragment, this);
  }

  public unregister_from_container(props: FragmentGuiProps): void {
    props.map.delete(props.fragment);
  }

  public override render(): preact.VNode {
    let { fragment } = this.props;
    return (
      <WrapperGui
        ref={this.root_ref}
        allow_overflow
        className={cc(this.props.className, 'Fragment', {
          'Fragment-current': this.props.is_current,
        })}>
        <BoxGui
          orientation="horizontal"
          allow_wrapping
          allow_overflow
          className="Fragment-Location">
          <span title="File path" className="Fragment-FilePath">
            <IconGui icon="file-earmark-text" />{' '}
            <FragmentPathGui
              path={fragment.game_file_path}
              on_click={this.on_file_path_component_click}
            />
          </span>
          <span title="JSON path" className="Fragment-JsonPath">
            <IconGui icon="code" />{' '}
            <FragmentPathGui
              path={fragment.json_path}
              on_click={this.on_json_path_component_click}
            />
          </span>
          <span title="Position in the list" className="Fragment-Index">
            <IconlikeTextGui icon="#" /> <LabelGui selectable>{this.props.index + 1}</LabelGui>
          </span>
        </BoxGui>

        {fragment.description.length > 0 ? (
          <LabelGui block selectable className="Fragment-Description Fragment-TextBlock">
            {fragment.description.join('\n')}
          </LabelGui>
        ) : null}

        <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
          <WrapperGui allow_overflow className="Fragment-Original BoxItem-expand">
            <LabelGui block selectable className="Fragment-TextBlock">
              <FancyTextGui highlight_crosscode_markup highlight_newlines>
                {fragment.original_text}
              </FancyTextGui>
            </LabelGui>
            <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
              <BoxItemFillerGui />
              <IconButtonGui
                icon="clipboard"
                title="Copy the original text"
                onClick={this.on_copy_original_text}
              />
              <IconButtonGui icon="search" title="Search other fragments with this original text" />
            </BoxGui>
          </WrapperGui>

          <WrapperGui allow_overflow className="BoxItem-expand Fragment-Translations">
            {fragment.translations.map((translation) => (
              <TranslationGui key={translation.id} translation={translation} />
            ))}
            <NewTranslationGui fragment={fragment} />
          </WrapperGui>
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface FragmentPathGuiProps {
  path: string;
  on_click?: (component_path: string) => void;
}

export interface FragmentPathGuiState {
  clickable: boolean;
}

export class FragmentPathGui extends preact.Component<FragmentPathGuiProps, FragmentPathGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: Readonly<FragmentPathGuiState> = {
    clickable: false,
  };
  private is_mouse_over = false;
  private is_ctrl_pressed = false;

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_global_key_modifiers_change.on(this.on_keymod_event);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_global_key_modifiers_change.off(this.on_keymod_event);
  }

  private on_mouse_hover = (_event: preact.JSX.TargetedMouseEvent<HTMLElement>): void => {
    this.is_mouse_over = true;
    this.update_clickable_state();
  };

  private on_mouse_hover_end = (_event: preact.JSX.TargetedMouseEvent<HTMLElement>): void => {
    this.is_mouse_over = false;
    this.update_clickable_state();
  };

  private on_keymod_event = (state: gui.KeyMod): void => {
    this.is_ctrl_pressed = state === gui.KeyMod.Ctrl;
    this.update_clickable_state();
  };

  private update_clickable_state(): void {
    let clickable = this.is_mouse_over && this.is_ctrl_pressed;
    this.setState((state) => (state.clickable !== clickable ? { clickable } : null));
  }

  private on_link_click = (
    component_path: string,
    event: preact.JSX.TargetedMouseEvent<HTMLAnchorElement>,
  ): void => {
    event.preventDefault();
    this.props.on_click?.(component_path);
  };

  public override render(): preact.VNode {
    let full_path = this.props.path;
    let children: preact.ComponentChildren = full_path;

    if (this.state.clickable) {
      let links: preact.VNode[] = [];
      for (let component of utils.split_iter(full_path, '/')) {
        let component_full_path = full_path.slice(0, component.end + 1);
        let component_path = full_path.slice(component.start, component.end + 1);
        links.push(
          // An empty href is required for focus to work on the links.
          <a
            key={component_full_path}
            href=""
            onClick={(event) => this.on_link_click(component_full_path, event)}>
            {component_path}
          </a>,
        );
      }
      children = links;
    }

    // Without a wrapper element, when moving the cursor between path component
    // links, hovering is lost for a moment, so a common element to catch all
    // mouse events is needed.
    return (
      <LabelGui
        selectable
        onMouseEnter={this.on_mouse_hover}
        onMouseMove={this.on_mouse_hover}
        onMouseLeave={this.on_mouse_hover_end}>
        {children}
      </LabelGui>
    );
  }
}

export interface TranslationGuiProps {
  translation: TranslationRoData;
}

export class TranslationGui extends preact.Component<TranslationGuiProps, unknown> {
  private on_copy_text = (_event: preact.JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.translation.text);
  };

  public override render(): preact.VNode {
    let { translation } = this.props;

    return (
      <WrapperGui allow_overflow className="Fragment-Translation">
        <LabelGui block selectable className="Fragment-TextBlock">
          <FancyTextGui highlight_crosscode_markup highlight_newlines>
            {translation.text}
          </FancyTextGui>
        </LabelGui>
        <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
          <LabelGui ellipsis selectable>
            {translation.author_username}
          </LabelGui>
          <LabelGui ellipsis selectable>
            at {format_timestamp(translation.modification_timestamp)}
          </LabelGui>
          <BoxItemFillerGui />
          <IconButtonGui
            icon="clipboard"
            title="Copy the translation text"
            onClick={this.on_copy_text}
          />
          <IconButtonGui icon="pencil-square" title="Edit this translation" />
          <IconButtonGui icon="chat-left-quote" title="Add a comment about this translation" />
          <IconButtonGui icon="trash-fill" title="Delete this translation" />
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface NewTranslationGuiProps {
  fragment: FragmentRoData;
}

export interface NewTranslationGuiState {
  text: string;
  text_area_height: number;
}

export class NewTranslationGui extends preact.Component<
  NewTranslationGuiProps,
  NewTranslationGuiState
> {
  public override state: Readonly<NewTranslationGuiState> = {
    text: '',
    text_area_height: -1,
  };

  private textarea_id: string = utils.new_html_id();

  private on_input = (event: preact.JSX.TargetedEvent<HTMLTextAreaElement>): void => {
    let text = event.currentTarget.value;
    let height = -1;
    if (text.length > 0) {
      height = TextAreaGui.compute_text_area_height(event.currentTarget);
    }
    this.setState({ text, text_area_height: height });
  };

  public override render(): preact.VNode {
    return (
      <WrapperGui allow_overflow className="Fragment-NewTranslation">
        <textarea
          id={this.textarea_id}
          name={this.textarea_id}
          value={this.state.text}
          onInput={this.on_input}
          placeholder="Add new translation..."
          autoComplete="off"
          spellCheck={false}
          rows={2}
          // `ref` must be implemented as an anonymous function here (i.e. not
          // as a bound method) so that it always gets invoked on each render.
          ref={(element: HTMLTextAreaElement | null): void => {
            if (element == null) return;
            let height = this.state.text_area_height;
            if (height > 0) {
              element.style.setProperty('height', `${height}px`, 'important');
              element.style.setProperty('overflow', 'hidden', 'important');
            } else {
              element.style.removeProperty('height');
              element.style.removeProperty('overflow');
            }
          }}
        />
        <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
          <BoxItemFillerGui />
          <IconButtonGui icon="check2" title="Submit" />
        </BoxGui>
      </WrapperGui>
    );
  }
}

export function format_timestamp(timestamp: Date): string {
  let str = '';
  str += timestamp.getFullYear().toString(10).padStart(4, '0');
  str += '-';
  str += timestamp.getMonth().toString(10).padStart(2, '0');
  str += '-';
  str += timestamp.getDate().toString(10).padStart(2, '0');
  str += ' ';
  str += timestamp.getHours().toString(10).padStart(2, '0');
  str += ':';
  str += timestamp.getMinutes().toString(10).padStart(2, '0');
  str += ':';
  str += timestamp.getSeconds().toString(10).padStart(2, '0');
  return str;
}
