import './Editor.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { OpenedFile, OpenedFileType, TAB_QUEUE_INDEX, TAB_SEARCH_INDEX } from '../app';
import { Fragment, Translation } from '../backend';
import * as gui from '../gui';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, BoxItemFillerGui, WrapperGui } from './Box';
import { IconButtonGui } from './Button';
import { FancyTextGui } from './FancyText';
import { IconGui, IconlikeTextGui } from './Icon';
import { LabelGui } from './Label';
import { TextAreaGui } from './TextInput';

export interface EditorGuiProps {
  className?: string;
}

export interface EditorGuiState {
  final_filler_height: number;
}

export class EditorGui extends Inferno.Component<EditorGuiProps, EditorGuiState> {
  public context!: AppMainGuiCtx;
  public state: EditorGuiState = {
    final_filler_height: 0,
  };

  private fragment_list_ref = Inferno.createRef<HTMLDivElement>();
  // TODO: Map<number, FragmentGui> ???
  private fragment_guis_map = new WeakMap<Fragment, FragmentGui>();
  private fragment_observer: IntersectionObserver | null = null;
  private fragment_observer_map: WeakMap<Element, FragmentGui> | null = null;
  private visible_fragments = new Set<FragmentGui>();

  public componentDidMount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.on(this.on_fragment_list_update);
    app.event_current_fragment_change.on(this.on_current_fragment_change);

    utils.assert(this.fragment_observer == null);
    utils.assert(this.fragment_observer_map == null);
    this.fragment_observer = new IntersectionObserver(this.on_fragment_intersection_change, {
      root: this.fragment_list_ref.current!,
    });
    this.fragment_observer_map = new WeakMap();

    window.addEventListener('resize', this.on_window_resize);
    this.on_window_resize();
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.off(this.on_fragment_list_update);
    app.event_current_fragment_change.off(this.on_current_fragment_change);

    utils.assert(this.fragment_observer != null);
    utils.assert(this.fragment_observer_map != null);
    this.fragment_observer.disconnect();
    this.fragment_observer = null;
    this.fragment_observer_map = null;

    window.removeEventListener('resize', this.on_window_resize);
  }

  private on_window_resize = (): void => {
    let { app } = this.context;
    let last_fragment = app.current_fragment_list[app.current_fragment_list.length - 1];
    let final_filler_height = 0;
    if (last_fragment != null) {
      let last_fragment_gui = this.fragment_guis_map.get(last_fragment);
      utils.assert(last_fragment_gui != null);
      // Different height properties are not a typo here.
      final_filler_height =
        this.fragment_list_ref.current!.clientHeight -
        last_fragment_gui.root_ref.current!.offsetHeight;
    }
    if (this.state.final_filler_height !== final_filler_height) {
      this.setState({ final_filler_height });
    }
  };

  private on_fragment_intersection_change = (entries: IntersectionObserverEntry[]): void => {
    utils.assert(this.fragment_observer != null);
    utils.assert(this.fragment_observer_map != null);
    for (let entry of entries) {
      let fragment_gui = this.fragment_observer_map.get(entry.target);
      utils.assert(fragment_gui != null);
      if (entry.isIntersecting) {
        this.visible_fragments.add(fragment_gui);
      } else {
        this.visible_fragments.delete(fragment_gui);
      }
    }

    let top_pos: number | null = null;
    for (let fragment_gui of this.visible_fragments) {
      let { pos } = fragment_gui.props;
      if (top_pos == null || pos < top_pos) {
        top_pos = pos;
      }
    }

    let { app } = this.context;
    app.set_current_fragment_pos(top_pos ?? 1, /* jump */ false);
  };

  private on_fragment_list_update = (): void => {
    this.forceUpdate(() => {
      this.on_window_resize();
    });
  };

  private on_current_fragment_change = (jump: boolean): void => {
    if (!jump) return;
    let { app } = this.context;
    let jump_pos = app.current_fragment_pos;

    let target_fragment = app.current_fragment_list[jump_pos - 1];
    utils.assert(target_fragment != null);
    let target_fragment_gui = this.fragment_guis_map.get(target_fragment);
    utils.assert(target_fragment_gui != null);
    target_fragment_gui.root_ref.current!.scrollIntoView();
  };

  public render(): JSX.Element {
    let { app } = this.context;

    let fragment_list_contents: JSX.Element[] = [];
    for (let [index, fragment] of app.current_fragment_list.entries()) {
      if (index > 0) {
        fragment_list_contents.push(
          <hr key={`${fragment.id}-sep`} className="FragmentList-Separator" />,
        );
      }
      fragment_list_contents.push(
        <FragmentGui
          key={fragment.id}
          pos={index + 1}
          fragment={fragment}
          map={this.fragment_guis_map}
          intersection_observer={this.fragment_observer}
          intersection_observer_map={this.fragment_observer_map}
        />,
      );
    }

    return (
      <BoxGui orientation="vertical" className={cc(this.props.className, 'Editor')}>
        <EditorTabListGui />
        <FragmentListPinnedGui />
        <WrapperGui
          inner_ref={this.fragment_list_ref}
          scroll
          className="BoxItem-expand FragmentList">
          {fragment_list_contents}
          <div style={{ height: `${this.state.final_filler_height}px` }} />
        </WrapperGui>
      </BoxGui>
    );
  }
}

export interface EditorTabListGuiProps {
  className?: string;
}

export class EditorTabListGui extends Inferno.Component<EditorTabListGuiProps, unknown> {
  public context!: AppMainGuiCtx;

  public componentDidMount(): void {
    let { app } = this.context;
    app.event_file_opened.on(this.on_opened_files_list_change);
    app.event_file_closed.on(this.on_opened_files_list_change);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.event_file_opened.off(this.on_opened_files_list_change);
    app.event_file_closed.off(this.on_opened_files_list_change);
  }

  private on_opened_files_list_change = (): void => {
    this.forceUpdate();
  };

  public render(): JSX.Element {
    let { app } = this.context;
    return (
      <BoxGui orientation="horizontal" scroll className={cc(this.props.className, 'EditorTabList')}>
        <EditorTabGui icon="search" name="Search" index={TAB_SEARCH_INDEX} />
        <EditorTabGui icon="journal-bookmark-fill" name="Queue" index={TAB_QUEUE_INDEX} />

        {app.opened_files.map(
          (opened_file: OpenedFile, index: number): JSX.Element => {
            let icon = null;
            let full_path = opened_file.path;
            let description = full_path;
            if (opened_file.type === OpenedFileType.GameFile) {
              icon = 'file-earmark-zip-fill';
              description = `GameFile ${opened_file.path}`;
            } else if (opened_file.type === OpenedFileType.TrFile) {
              icon = 'file-earmark-text-fill';
              description = `TrFile ${opened_file.path}`;
            }

            let shorter_path = utils.strip_prefix(full_path, 'data/');
            let display_path = '';
            let component_start = 0;
            while (component_start < shorter_path.length) {
              let separator_index = shorter_path.indexOf('/', component_start);
              let is_last_component = separator_index < 0;
              let component_end = is_last_component ? shorter_path.length : separator_index;
              let component = shorter_path.slice(component_start, component_end);
              if (is_last_component) {
                display_path += component;
              } else {
                display_path += component.charAt(0);
                display_path += '/';
              }
              component_start = component_end + 1;
            }

            return (
              <EditorTabGui
                key={opened_file.gui_id}
                icon={icon}
                name={display_path}
                description={description}
                index={index}
                closeable
              />
            );
          },
        )}
      </BoxGui>
    );
  }
}

export interface EditorTabGuiProps {
  icon: string | null;
  name: string;
  description?: string;
  index: number;
  closeable?: boolean;
}

export class EditorTabGui extends Inferno.Component<EditorTabGuiProps, unknown> {
  public context!: AppMainGuiCtx;

  public root_ref = Inferno.createRef<HTMLButtonElement>();

  public componentDidMount(): void {
    let { app } = this.context;
    // TODO: rewrite with a WeakMap or something
    app.event_current_tab_change.on(this.on_current_tab_change);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.event_current_tab_change.off(this.on_current_tab_change);
  }

  private on_current_tab_change = (): void => {
    this.forceUpdate();
    let { app } = this.context;
    if (app.current_tab_index === this.props.index) {
      this.root_ref.current!.scrollIntoView({ block: 'center', inline: 'center' });
    }
  };

  public on_click = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    app.set_current_tab_index(this.props.index);
  };

  public on_close_click = (event: Inferno.InfernoMouseEvent<SVGSVGElement>): void => {
    event.stopPropagation();
    let { app } = this.context;
    if (this.props.closeable) {
      app.close_game_file(this.props.index);
    }
  };

  public render(): JSX.Element {
    let { app } = this.context;
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc('EditorTab', {
          'EditorTab-active': this.props.index === app.current_tab_index,
          'EditorTab-closeable': this.props.closeable,
        })}
        onClick={this.on_click}
        title={this.props.description ?? this.props.name}>
        <IconGui icon={this.props.icon} className="EditorTab-Icon" />
        {` ${this.props.name} `}
        <IconGui
          icon="x"
          className="EditorTab-Close"
          title={this.props.closeable ? 'Close this tab' : "This tab can't be closed!"}
          onClick={this.on_close_click}
        />
      </button>
    );
  }
}

export interface FragmentListPinnedGuiProps {
  className?: string;
}

export interface FragmentListPinnedGuiState {
  jump_pos_value: string;
}

export class FragmentListPinnedGui extends Inferno.Component<
  FragmentListPinnedGuiProps,
  FragmentListPinnedGuiState
> {
  public context!: AppMainGuiCtx;
  public state: FragmentListPinnedGuiState = {
    jump_pos_value: '0',
  };

  public static FRAGMENT_PAGINATION_JUMP = 10;

  private jump_pos_input_id: string = utils.new_html_id();
  private jump_pos_input_ref = Inferno.createRef<HTMLInputElement>();

  public componentDidMount(): void {
    let { app } = this.context;
    app.event_current_fragment_change.on(this.on_current_fragment_change);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.event_current_fragment_change.off(this.on_current_fragment_change);
  }

  private on_current_fragment_change = (): void => {
    this.jump_pos_input_ref.current!.blur();
    let { app } = this.context;
    this.setState({ jump_pos_value: app.current_fragment_pos.toString() });
  };

  private on_jump_pos_input = (event: Inferno.FormEvent<HTMLInputElement>): void => {
    this.setState({ jump_pos_value: event.currentTarget.value });
  };

  private on_jump_pos_submit = (event: Inferno.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let { app } = this.context;
    let jump_pos = parseInt(this.state.jump_pos_value, 10);
    if (!Number.isSafeInteger(jump_pos)) return;
    app.set_current_fragment_pos(jump_pos, /* jump */ true);
  };

  private on_jump_pos_unfocus = (_event: Inferno.FocusEvent<HTMLInputElement>): void => {
    let { app } = this.context;
    this.setState({ jump_pos_value: app.current_fragment_pos.toString() });
  };

  private on_jump_button_click(
    jump_type: 'first' | 'back_many' | 'back_one' | 'fwd_one' | 'fwd_many' | 'last',
    _event: Inferno.InfernoMouseEvent<HTMLButtonElement>,
  ): void {
    let { app } = this.context;
    let jump_pos = app.current_fragment_pos;
    let long_jump = FragmentListPinnedGui.FRAGMENT_PAGINATION_JUMP;
    let fragment_count = app.current_fragment_list.length;
    // prettier-ignore
    switch (jump_type) {
      case 'first':     { jump_pos  = 1;              break; }
      case 'back_many': { jump_pos -= long_jump;      break; }
      case 'back_one':  { jump_pos -= 1;              break; }
      case 'fwd_one':   { jump_pos += 1;              break; }
      case 'fwd_many':  { jump_pos += long_jump;      break; }
      case 'last':      { jump_pos  = fragment_count; break; }
    }
    app.set_current_fragment_pos(jump_pos, /* jump */ true);
  }

  private on_jump_first_btn_click = this.on_jump_button_click.bind(this, 'first');
  private on_jump_back_many_btn_click = this.on_jump_button_click.bind(this, 'back_many');
  private on_jump_back_one_btn_click = this.on_jump_button_click.bind(this, 'back_one');
  private on_jump_fwd_one_btn_click = this.on_jump_button_click.bind(this, 'fwd_one');
  private on_jump_fwd_many_btn_click = this.on_jump_button_click.bind(this, 'fwd_many');
  private on_jump_last_btn_click = this.on_jump_button_click.bind(this, 'last');

  public render(): JSX.Element {
    let { app } = this.context;
    let fragment_count = app.current_fragment_list.length;
    let long_jump = FragmentListPinnedGui.FRAGMENT_PAGINATION_JUMP;
    return (
      <WrapperGui className={cc('FragmentListPinned', this.props.className)}>
        <BoxGui
          orientation="horizontal"
          align_items="center"
          className="FragmentListPinned-Pagination">
          <IconButtonGui
            icon="chevron-bar-left"
            title="First"
            onClick={this.on_jump_first_btn_click}
          />
          <IconButtonGui
            icon="chevron-double-left"
            title={`Back by ${long_jump}`}
            onClick={this.on_jump_back_many_btn_click}
          />
          <IconButtonGui
            icon="chevron-left"
            title="Previous"
            onClick={this.on_jump_back_one_btn_click}
          />
          <form onSubmit={this.on_jump_pos_submit}>
            <input
              ref={this.jump_pos_input_ref}
              type="number"
              id={this.jump_pos_input_id}
              name={this.jump_pos_input_id}
              className="FragmentListPinned-JumpInput"
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
          <LabelGui selectable>{fragment_count}</LabelGui>
          <IconButtonGui
            icon="chevron-right"
            title="Next"
            onClick={this.on_jump_fwd_one_btn_click}
          />
          <IconButtonGui
            icon="chevron-double-right"
            title={`Forward by ${long_jump}`}
            onClick={this.on_jump_fwd_many_btn_click}
          />
          <IconButtonGui
            icon="chevron-bar-right"
            title="Last"
            onClick={this.on_jump_last_btn_click}
          />
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface FragmentGuiProps {
  className?: string;
  pos: number;
  fragment: Fragment;
  map: WeakMap<Fragment, FragmentGui>;
  intersection_observer: IntersectionObserver | null;
  intersection_observer_map: WeakMap<Element, FragmentGui> | null;
}

export class FragmentGui extends Inferno.Component<FragmentGuiProps, unknown> {
  public root_ref = Inferno.createRef<HTMLDivElement>();

  private on_file_path_component_click = (component_path: string): void => {
    console.log('search', component_path);
  };

  private on_json_path_component_click = (component_path: string): void => {
    console.log('search', this.props.fragment.file_path, component_path);
  };

  private on_copy_original_text = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.fragment.original_text);
  };

  public componentDidMount(): void {
    this.props.map.set(this.props.fragment, this);

    let { intersection_observer, intersection_observer_map } = this.props;
    utils.assert(intersection_observer != null);
    utils.assert(intersection_observer_map != null);
    intersection_observer.observe(this.root_ref.current!);
    intersection_observer_map.set(this.root_ref.current!, this);
  }

  public componentWillUnmount(): void {
    this.props.map.delete(this.props.fragment);

    let { intersection_observer, intersection_observer_map } = this.props;
    utils.assert(intersection_observer != null);
    utils.assert(intersection_observer_map != null);
    intersection_observer.unobserve(this.root_ref.current!);
    intersection_observer_map.delete(this.root_ref.current!);
  }

  public render(): JSX.Element {
    let { fragment } = this.props;
    return (
      <WrapperGui
        inner_ref={this.root_ref}
        allow_overflow
        className={cc(this.props.className, 'Fragment')}>
        <BoxGui
          orientation="horizontal"
          allow_wrapping
          allow_overflow
          className="Fragment-Location">
          <span title="File path">
            <IconGui icon="file-earmark-text" />{' '}
            <FragmentPathGui
              path={fragment.file_path}
              on_click={this.on_file_path_component_click}
            />
          </span>
          <span title="JSON path">
            <IconGui icon="code" />{' '}
            <FragmentPathGui
              path={fragment.json_path}
              on_click={this.on_json_path_component_click}
            />
          </span>
          {fragment.has_lang_uid() ? (
            <span title="Lang UID">
              <IconlikeTextGui icon="#" /> <LabelGui selectable>{fragment.lang_uid}</LabelGui>
            </span>
          ) : null}
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
  public context!: AppMainGuiCtx;
  public state: FragmentPathGuiState = {
    clickable: false,
  };
  private is_mouse_over = false;
  private is_ctrl_pressed = false;

  public componentDidMount(): void {
    let { app } = this.context;
    app.event_global_key_modifiers_change.on(this.on_keymod_event);
  }

  public componentWillUnmount(): void {
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

  private on_link_click = (event: Inferno.InfernoMouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    let component_path = event.currentTarget.dataset.path;
    utils.assert(component_path != null);
    this.props.on_click?.(component_path);
  };

  public render(): JSX.Element {
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
          <a key={component_path} href="" data-path={component_path} onClick={this.on_link_click}>
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

  public render(): JSX.Element {
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
            at {format_timestamp(translation.creation_timestamp)}
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
}

export class NewTranslationGui extends Inferno.Component<
  NewTranslationGuiProps,
  NewTranslationGuiState
> {
  public state: NewTranslationGuiState = {
    text: '',
  };

  private textarea_id: string = utils.new_html_id();

  private on_input = (event: Inferno.FormEvent<HTMLTextAreaElement>): void => {
    this.setState({ text: event.currentTarget.value });
  };

  public render(): JSX.Element {
    return (
      <WrapperGui allow_overflow className="Fragment-NewTranslation">
        <TextAreaGui
          id={this.textarea_id}
          name={this.textarea_id}
          value={this.state.text}
          onInput={this.on_input}
          placeholder="Add new translation..."
          autoComplete="off"
          spellCheck={false}
          rows={2}
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
