import './Editor.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { Fragment, Translation } from '../backend';
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

const FRAGMENT_LIST_LOAD_DISTANCE = 0;
const FRAGMENT_LIST_SLICE_MAX_LENGTH = 40;
const FRAGMENT_LIST_LOAD_CHUNK_SIZE = 20;

export class EditorGui extends Inferno.Component<EditorGuiProps, unknown> {
  public override context!: AppMainGuiCtx;

  private fragment_list_ref = Inferno.createRef<HTMLDivElement>();
  private fragment_guis_map = new WeakMap<Fragment, FragmentGui>();
  private fragment_observer: IntersectionObserver | null = null;
  private fragment_observer_map: WeakMap<Element, FragmentGui> | null = null;
  private visible_fragments = new Set<FragmentGui>();

  public get_fragment_gui_by_index(index: number): FragmentGui | undefined {
    return this.fragment_guis_map.get(this.context.app.current_fragment_list[index]);
  }

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.on(this.on_fragment_list_update);
    app.event_current_fragment_change.on(this.on_current_fragment_change);

    utils.assert(this.fragment_observer == null);
    utils.assert(this.fragment_observer_map == null);
    this.fragment_observer = new IntersectionObserver(this.on_fragment_intersection_change, {
      root: this.fragment_list_ref.current!,
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
    this.forceUpdate();
  };

  private previous_fragment_index = 0;
  private on_current_fragment_change = (jump: boolean): void => {
    let { app } = this.context;

    let previous_fragment_gui = this.get_fragment_gui_by_index(this.previous_fragment_index);
    previous_fragment_gui?.forceUpdate();
    this.previous_fragment_index = app.current_fragment_index;
    let current_fragment_gui = this.get_fragment_gui_by_index(app.current_fragment_index);
    current_fragment_gui?.forceUpdate();

    if (jump) {
      current_fragment_gui?.root_ref.current!.scrollIntoView();
    }
  };

  public override render(): JSX.Element {
    let { app } = this.context;

    let fragment_list_contents: JSX.Element[] = [];

    if (app.current_fragment_list.length > 0) {
      let start = app.fragment_list_slice_start;
      let end = app.fragment_list_slice_end;
      for (let i = start; i < end; i++) {
        let fragment = app.current_fragment_list[i];
        if (fragment == null) continue;
        if (i > start) {
          fragment_list_contents.push(
            <hr key={`${fragment.id}-sep`} className="FragmentList-Separator" />,
          );
        }
        fragment_list_contents.push(
          <FragmentGui
            key={fragment.id}
            index={i}
            fragment={fragment}
            map={this.fragment_guis_map}
            intersection_observer={this.fragment_observer}
            intersection_observer_map={this.fragment_observer_map}
          />,
        );
      }
    }

    return (
      <BoxGui orientation="vertical" className={cc(this.props.className, 'Editor')}>
        <EditorTabListGui />
        <FragmentListToolbarGui />
        <WrapperGui
          inner_ref={this.fragment_list_ref}
          scroll
          className="BoxItem-expand FragmentList">
          {fragment_list_contents}
        </WrapperGui>
      </BoxGui>
    );
  }
}

export interface FragmentListToolbarGuiProps {
  className?: string;
}

export interface FragmentListToolbarGuiState {
  jump_pos_value: string;
  filter_value: string;
}

export class FragmentListToolbarGui extends Inferno.Component<
  FragmentListToolbarGuiProps,
  FragmentListToolbarGuiState
> {
  public override context!: AppMainGuiCtx;
  public override state: FragmentListToolbarGuiState = {
    jump_pos_value: '0',
    filter_value: '',
  };

  public static readonly FRAGMENT_PAGINATION_JUMP = 10;

  private jump_pos_input_ref = Inferno.createRef<HTMLInputElement>();
  private filter_input_ref = Inferno.createRef<HTMLInputElement>();

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_current_fragment_change.on(this.on_current_fragment_change);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_current_fragment_change.off(this.on_current_fragment_change);
  }

  private on_current_fragment_change = (): void => {
    this.jump_pos_input_ref.current!.blur();
    let { app } = this.context;
    this.setState({ jump_pos_value: (app.current_fragment_index + 1).toString() });
  };

  private on_jump_pos_input = (event: Inferno.FormEvent<HTMLInputElement>): void => {
    this.setState({ jump_pos_value: event.currentTarget.value });
  };

  private on_jump_pos_submit = (event: Inferno.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let { app } = this.context;
    let jump_pos = parseInt(this.state.jump_pos_value, 10);
    if (!Number.isSafeInteger(jump_pos)) return;
    app.set_current_fragment_index(jump_pos - 1, /* jump */ true);
  };

  private on_jump_pos_unfocus = (_event: Inferno.FocusEvent<HTMLInputElement>): void => {
    let { app } = this.context;
    this.setState({ jump_pos_value: app.current_fragment_index.toString() });
  };

  private on_jump_button_click = (
    jump_type: 'first' | 'back_many' | 'back_one' | 'fwd_one' | 'fwd_many' | 'last',
    _event: Inferno.InfernoMouseEvent<HTMLButtonElement>,
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

  private on_filter_submit = (_event: Inferno.FormEvent<HTMLFormElement>): void => {};

  private on_filter_input = (event: Inferno.FormEvent<HTMLInputElement>): void => {
    this.setState({ filter_value: event.currentTarget.value });
  };

  public override render(): JSX.Element {
    let { app } = this.context;
    let fragment_count = app.current_fragment_list.length;
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
            onClick={Inferno.linkEvent('first', this.on_jump_button_click)}
          />
          <IconButtonGui
            icon="chevron-double-left"
            title={`Back by ${long_jump}`}
            onClick={Inferno.linkEvent('back_many', this.on_jump_button_click)}
          />
          <IconButtonGui
            icon="chevron-left"
            title="Previous"
            onClick={Inferno.linkEvent('back_one', this.on_jump_button_click)}
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
              min={Math.min(1, fragment_count)}
              max={fragment_count}
              disabled={fragment_count === 0}
              title="Jump to..."
              autoComplete="off"
            />
          </form>
          <IconlikeTextGui icon="/" />
          <LabelGui selectable title="Total fragments">
            {fragment_count}
          </LabelGui>
          <IconButtonGui
            icon="chevron-right"
            title="Next"
            onClick={Inferno.linkEvent('fwd_one', this.on_jump_button_click)}
          />
          <IconButtonGui
            icon="chevron-double-right"
            title={`Forward by ${long_jump}`}
            onClick={Inferno.linkEvent('fwd_many', this.on_jump_button_click)}
          />
          <IconButtonGui
            icon="chevron-bar-right"
            title="Last"
            onClick={Inferno.linkEvent('last', this.on_jump_button_click)}
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
  fragment: Fragment;
  map: WeakMap<Fragment, FragmentGui>;
  intersection_observer: IntersectionObserver | null;
  intersection_observer_map: WeakMap<Element, FragmentGui> | null;
}

export class FragmentGui extends Inferno.Component<FragmentGuiProps, unknown> {
  public override context!: AppMainGuiCtx;
  public root_ref = Inferno.createRef<HTMLDivElement>();
  public is_visible = false;

  private on_file_path_component_click = (component_path: string): void => {
    console.log('search', component_path);
  };

  private on_json_path_component_click = (component_path: string): void => {
    console.log('search', this.props.fragment.game_file_path, component_path);
  };

  private on_copy_original_text = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
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

  public override render(): JSX.Element {
    let { app } = this.context;
    let { fragment } = this.props;
    return (
      <WrapperGui
        inner_ref={this.root_ref}
        allow_overflow
        className={cc(this.props.className, 'Fragment', {
          'Fragment-current': this.props.index === app.current_fragment_index,
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

export class FragmentPathGui extends Inferno.Component<FragmentPathGuiProps, FragmentPathGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: FragmentPathGuiState = {
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

  private on_mouse_hover = (_event: Inferno.InfernoMouseEvent<HTMLElement>): void => {
    this.is_mouse_over = true;
    this.update_clickable_state();
  };

  private on_mouse_hover_end = (_event: Inferno.InfernoMouseEvent<HTMLElement>): void => {
    this.is_mouse_over = false;
    this.update_clickable_state();
  };

  private on_keymod_event = (state: gui.KeyMod): void => {
    this.is_ctrl_pressed = state === gui.KeyMod.Ctrl;
    this.update_clickable_state();
  };

  private update_clickable_state(): void {
    let clickable = this.is_mouse_over && this.is_ctrl_pressed;
    if (this.state.clickable !== clickable) {
      this.setState({ clickable });
    }
  }

  private on_link_click = (
    component_path: string,
    event: Inferno.InfernoMouseEvent<HTMLAnchorElement>,
  ): void => {
    event.preventDefault();
    this.props.on_click?.(component_path);
  };

  public override render(): JSX.Element {
    let full_path = this.props.path;
    let children: Inferno.InfernoNode = full_path;

    if (this.state.clickable) {
      let links: JSX.Element[] = [];

      let component_start_index = 0;
      while (component_start_index < full_path.length) {
        let separator_index = full_path.indexOf('/', component_start_index);
        let component_end_index = separator_index < 0 ? full_path.length : separator_index + 1;
        let component = full_path.slice(component_start_index, component_end_index);
        let component_path = full_path.slice(0, component_end_index);
        links.push(
          // An empty href is required for focus to work on the links.
          <a
            key={component_path}
            href=""
            onClick={Inferno.linkEvent(component_path, this.on_link_click)}>
            {component}
          </a>,
        );
        component_start_index = component_end_index;
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
  translation: Translation;
}

export class TranslationGui extends Inferno.Component<TranslationGuiProps, unknown> {
  private on_copy_text = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.translation.text);
  };

  public override render(): JSX.Element {
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
  fragment: Fragment;
}

export interface NewTranslationGuiState {
  text: string;
  text_area_height: number;
}

export class NewTranslationGui extends Inferno.Component<
  NewTranslationGuiProps,
  NewTranslationGuiState
> {
  public override state: NewTranslationGuiState = {
    text: '',
    text_area_height: -1,
  };

  private textarea_id: string = utils.new_html_id();

  private on_input = (event: Inferno.FormEvent<HTMLTextAreaElement>): void => {
    let text = event.currentTarget.value;
    let height = -1;
    if (text.length > 0) {
      height = TextAreaGui.compute_text_area_height(event.currentTarget);
    }
    this.setState({ text, text_area_height: height });
  };

  public override render(): JSX.Element {
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
