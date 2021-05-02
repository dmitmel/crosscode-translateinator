import './Editor.scss';
import './Label.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { ListedFragment, ListedTranslation } from '../backend';
import * as gui from '../gui';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, BoxItemFillerGui, WrapperGui } from './Box';
import { IconButtonGui } from './Button';
import { FancyTextGui } from './FancyText';
import { IconGui } from './Icon';
import { TextAreaGui } from './TextInput';

export const FRAGMENT_PAGINATION_JUMP = 10;

export interface EditorGuiProps {
  className?: string;
}

export interface EditorGuiState {
  fragments: Array<ListedFragment & { file: string }>;
  translation_locale: string;
}

export class EditorGui extends Inferno.Component<EditorGuiProps, EditorGuiState> {
  public context!: AppMainGuiCtx;
  public state: EditorGuiState = {
    fragments: [],
    translation_locale: '',
  };

  private page_input_id: string = utils.new_html_id();

  // TODO: Map<number, FragmentGui> ???
  private fragment_guis_map = new WeakMap<ListedFragment & { file: string }, FragmentGui>();
  private fragment_observer: IntersectionObserver | null = null;
  private fragment_observer_map: WeakMap<Element, FragmentGui> | null = null;
  private visible_fragments = new Set<FragmentGui>();
  private current_fragment_pos = 0;

  private jump_pos_input_ref = Inferno.createRef<HTMLInputElement>();
  private fragment_list_ref = Inferno.createRef<HTMLDivElement>();

  public componentDidMount(): void {
    let { app } = this.context;
    app.events.project_opened.on(this.on_project_opened);
    app.events.project_closed.on(this.on_project_closed);

    let fragment_list_gui = this.fragment_list_ref.current;
    utils.assert(fragment_list_gui != null);
    utils.assert(this.fragment_observer == null);
    utils.assert(this.fragment_observer_map == null);
    this.fragment_observer = new IntersectionObserver(this.on_fragment_intersection_change, {
      root: fragment_list_gui,
    });
    this.fragment_observer_map = new WeakMap();
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.events.project_opened.off(this.on_project_opened);
    app.events.project_closed.off(this.on_project_closed);

    utils.assert(this.fragment_observer != null);
    utils.assert(this.fragment_observer_map != null);
    this.fragment_observer.disconnect();
    this.fragment_observer = null;
    this.fragment_observer_map = null;
  }

  private on_fragment_intersection_change = (entries: IntersectionObserverEntry[]): void => {
    utils.assert(this.fragment_observer != null);
    utils.assert(this.fragment_observer_map != null);
    for (let entry of entries) {
      let fragment_gui = this.fragment_observer_map.get(entry.target);
      utils.assert(fragment_gui != null);
      console.log(entry);
      if (entry.isIntersecting) {
        this.visible_fragments.add(fragment_gui);
      } else {
        this.visible_fragments.delete(fragment_gui);
      }
    }

    console.log(
      Array.from(this.visible_fragments)
        .sort((a, b) => a.props.pos - b.props.pos)
        .map((fg) => fg.root_ref.current),
    );

    let top_pos: number | null = null;
    for (let fragment_gui of this.visible_fragments) {
      let { pos } = fragment_gui.props;
      if (top_pos == null || pos < top_pos) {
        top_pos = pos;
      }
    }
    this.current_fragment_pos = top_pos ?? 1;

    let jump_pos_input = this.jump_pos_input_ref.current;
    utils.assert(jump_pos_input != null);
    jump_pos_input.value = this.current_fragment_pos.toString();
  };

  private on_project_opened = async (): Promise<void> => {
    let { app } = this.context;
    this.setState({ translation_locale: app.current_project_meta!.translation_locale });

    let file_path = 'data/maps/hideout/entrance.json';
    let response = await app.backend.send_request({
      type: 'VirtualGameFile/list_fragments',
      project_id: app.current_project_id!,
      file_path,
    });
    this.setState({ fragments: response.fragments.map((f) => ({ ...f, file: file_path })) });
  };

  private on_project_closed = (): void => {
    this.setState({ fragments: [] });
  };

  private on_jump_pos_submit = (event: Inferno.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let jump_pos_input = this.jump_pos_input_ref.current;
    utils.assert(jump_pos_input != null);

    let jump_pos = parseInt(jump_pos_input.value, 10);
    if (Number.isNaN(jump_pos)) return;
    jump_pos = utils.clamp(jump_pos, 1, this.state.fragments.length);
    let target_fragment = this.state.fragments[jump_pos - 1];
    if (target_fragment == null) return;
    let target_fragment_gui = this.fragment_guis_map.get(target_fragment);
    if (target_fragment_gui == null) return;
    let target_element = target_fragment_gui.root_ref.current;
    if (target_element == null) return;

    jump_pos_input.blur();
    this.current_fragment_pos = jump_pos;
    jump_pos_input.value = jump_pos.toString();
    target_element.scrollIntoView();
  };

  private on_jump_pos_unfocus = (_event: Inferno.FocusEvent<HTMLInputElement>): void => {
    let jump_pos_input = this.jump_pos_input_ref.current;
    utils.assert(jump_pos_input != null);
    jump_pos_input.value = this.current_fragment_pos.toString();
  };

  public render(): JSX.Element {
    let fragment_list_contents: JSX.Element[] = [];
    for (let [index, fragment] of this.state.fragments.entries()) {
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

        <WrapperGui className="FragmentList-Pinned">
          <BoxGui orientation="horizontal" align_items="center" className="FragmentListPagination">
            <IconButtonGui icon="chevron-bar-left" title="First" />
            <IconButtonGui
              icon="chevron-double-left"
              title={`Back by ${FRAGMENT_PAGINATION_JUMP}`}
            />
            <IconButtonGui icon="chevron-left" title="Previous" />
            <form onSubmit={this.on_jump_pos_submit}>
              <input
                ref={this.jump_pos_input_ref}
                onBlur={this.on_jump_pos_unfocus}
                type="number"
                id={this.page_input_id}
                name={this.page_input_id}
                className="FragmentListPagination-JumpInput"
                defaultValue="1"
                min={1}
                max={this.state.fragments.length}
                disabled={this.state.fragments.length === 0}
                title="Jump to..."
                autoComplete="off"
              />
            </form>
            <span className="Label-whitespace-preserve">/</span>
            <span className="Label-selectable">{this.state.fragments.length}</span>
            <IconButtonGui icon="chevron-right" title="Next" />
            <IconButtonGui
              icon="chevron-double-right"
              title={`Forward by ${FRAGMENT_PAGINATION_JUMP}`}
            />
            <IconButtonGui icon="chevron-bar-right" title="Last" />
          </BoxGui>
        </WrapperGui>

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

export interface EditorTabListGuiProps {
  className?: string;
}

export function EditorTabListGui(props: gui.ComponentProps<EditorTabListGuiProps>): JSX.Element {
  return (
    <BoxGui orientation="horizontal" scroll className={cc(props.className, 'EditorTabList')}>
      <EditorTabGui active={false} type="search" name={'Search'} />
      <EditorTabGui active={false} type="queue" name={'Queue'} />
      <EditorTabGui active={true} type="game_file" name={'database.json'} />
      <EditorTabGui active={false} type="tr_file" name={'bergen.json'} />
      <EditorTabGui active={false} type="game_file" name={'gui.en_US.json'} />
    </BoxGui>
  );
}

type EditorTabType = 'search' | 'queue' | 'tr_file' | 'game_file';

const EDITOR_TAB_ICONS = new Map<EditorTabType, string>([
  ['search', 'search'],
  ['queue', 'journal-bookmark-fill'],
  ['tr_file', 'file-earmark-zip-fill'],
  ['game_file', 'file-earmark-text-fill'],
]);

export interface EditorTabGuiProps {
  type: EditorTabType;
  name: string;
  active: boolean;
}

export function EditorTabGui(props: gui.ComponentProps<EditorTabGuiProps>): JSX.Element {
  return (
    <button
      type="button"
      className={cc('EditorTab', { 'EditorTab-active': props.active })}
      tabIndex={0}
      onClick={() => console.log('open', props.name)}>
      <IconGui icon={EDITOR_TAB_ICONS.get(props.type)} /> {props.name} <IconGui icon="x" />
    </button>
  );
}

export interface FragmentGuiProps {
  className?: string;
  pos: number;
  fragment: ListedFragment & { file: string };
  map: WeakMap<ListedFragment & { file: string }, FragmentGui>;
  intersection_observer: IntersectionObserver | null;
  intersection_observer_map: WeakMap<Element, FragmentGui> | null;
}

export class FragmentGui extends Inferno.Component<FragmentGuiProps, unknown> {
  public root_ref = Inferno.createRef<HTMLDivElement>();

  private on_file_path_component_click = (component_path: string): void => {
    console.log('search', component_path);
  };

  private on_json_path_component_click = (component_path: string): void => {
    console.log('search', this.props.fragment.file, component_path);
  };

  private on_copy_original_text = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.fragment.orig);
  };

  public componentDidMount(): void {
    this.props.map.set(this.props.fragment, this);

    let { intersection_observer, intersection_observer_map } = this.props;
    let root_element = this.root_ref.current;
    utils.assert(root_element != null);
    utils.assert(intersection_observer != null);
    utils.assert(intersection_observer_map != null);
    intersection_observer.observe(root_element);
    intersection_observer_map.set(root_element, this);
  }

  public componentWillUnmount(): void {
    this.props.map.delete(this.props.fragment);

    let { intersection_observer, intersection_observer_map } = this.props;
    let root_element = this.root_ref.current;
    utils.assert(root_element != null);
    utils.assert(intersection_observer != null);
    utils.assert(intersection_observer_map != null);
    intersection_observer.unobserve(root_element);
    intersection_observer_map.delete(root_element);
  }

  public render(): JSX.Element {
    let { fragment } = this.props;
    let lang_uid = fragment.luid ?? 0;
    let description = fragment.desc ?? [];
    let translations = fragment.tr ?? [];

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
            <FragmentPathGui path={fragment.file} on_click={this.on_file_path_component_click} />
          </span>
          <span title="JSON path">
            <IconGui icon="code" />{' '}
            <FragmentPathGui path={fragment.json} on_click={this.on_json_path_component_click} />
          </span>
          {lang_uid !== 0 ? (
            <span title="Lang UID">
              <span className="IconlikeText">#</span>{' '}
              <span className="Label-selectable">{lang_uid}</span>
            </span>
          ) : null}
        </BoxGui>

        {description.length > 0 ? (
          <div className="Fragment-Description Fragment-TextBlock Label-selectable">
            {description.join('\n')}
          </div>
        ) : null}

        <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
          <WrapperGui allow_overflow className="Fragment-Original BoxItem-expand">
            <div className="Fragment-TextBlock Label-selectable">
              <FancyTextGui highlight_crosscode_markup highlight_newlines>
                {fragment.orig}
              </FancyTextGui>
            </div>
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
            {translations.flatMap((translation) => (
              <TranslationGui key={translation.id} translation={translation} fragment={fragment} />
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
    app.events.global_key_modifiers_change.on(this.on_keymod_event);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.events.global_key_modifiers_change.off(this.on_keymod_event);
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
    this.setState({ clickable: this.is_mouse_over && this.is_ctrl_pressed });
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
      // An empty href is required for focus to work on the links.

      let component_start_index = 0;
      while (true) {
        let separator_index = full_path.indexOf('/', component_start_index);
        if (separator_index < 0) break;
        let component = full_path.slice(component_start_index, separator_index + 1);
        let component_path = full_path.slice(0, separator_index + 1);

        links.push(
          <a key={component_path} href="" data-path={component_path} onClick={this.on_link_click}>
            {component}
          </a>,
        );

        component_start_index = separator_index + 1;
      }

      let last_component = full_path.slice(component_start_index);
      links.push(
        <a key={full_path} href="" data-path={full_path} onClick={this.on_link_click}>
          {last_component}
        </a>,
      );
      children = links;
    }

    // Without a wrapper element, when moving the cursor between path component
    // links, hovering is lost for a moment, so a common element to catch all
    // mouse events is needed.
    return (
      <span
        className="Label-selectable"
        onMouseEnter={this.on_mouse_hover}
        onMouseMove={this.on_mouse_hover}
        onMouseLeave={this.on_mouse_hover_end}>
        {children}
      </span>
    );
  }
}

export interface TranslationGuiProps {
  fragment: ListedFragment & { file: string };
  translation: ListedTranslation;
}

export class TranslationGui extends Inferno.Component<TranslationGuiProps, unknown> {
  private on_copy_text = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.translation.text);
  };

  public render(): JSX.Element {
    let { translation } = this.props;

    return (
      <WrapperGui allow_overflow className="Fragment-Translation">
        <div className="Fragment-TextBlock Label-selectable">
          <FancyTextGui highlight_crosscode_markup highlight_newlines>
            {translation.text}
          </FancyTextGui>
        </div>
        <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
          <span className="Label Label-ellipsis Label-selectable">{translation.author}</span>
          <span className="Label Label-ellipsis Label-selectable">
            at {format_timestamp(new Date(translation.ctime * 1000))}
          </span>
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
  fragment: ListedFragment & { file: string };
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
