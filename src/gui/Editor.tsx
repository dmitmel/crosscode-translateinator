import './Editor.scss';
import './Label.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { ListedFragment, ListedTranslation } from '../backend';
import * as gui from '../gui';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, WrapperGui } from './Box';
import { IconButtonGui } from './Button';
import { FancyTextGui } from './FancyText';
import { IconGui } from './Icon';
import { TextAreaGui } from './TextInput';

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

  public componentDidMount(): void {
    let { app } = this.context;
    app.events.project_opened.on(this.on_project_opened);
    app.events.project_closed.on(this.on_project_closed);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.events.project_opened.off(this.on_project_opened);
    app.events.project_closed.off(this.on_project_closed);
  }

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

  public render(): JSX.Element {
    return (
      <BoxGui orientation="vertical" className={cc(this.props.className, 'Editor')}>
        <EditorTabListGui />
        <WrapperGui scroll className="BoxItem-expand FragmentList">
          {this.state.fragments.map((f) => (
            <FragmentGui key={f.id} fragment={f} />
          ))}
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

export interface FragmentListGuiProps {
  className?: string;
  fragments: Array<ListedFragment & { file: string }>;
}

export interface FragmentGuiProps {
  className?: string;
  fragment: ListedFragment & { file: string };
}

export class FragmentGui extends Inferno.Component<FragmentGuiProps, unknown> {
  private on_file_path_component_click = (component_path: string): void => {
    console.log('search', component_path);
  };

  private on_json_path_component_click = (component_path: string): void => {
    console.log('search', this.props.fragment.file, component_path);
  };

  private on_copy_original_text = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.fragment.orig);
  };

  public render(): JSX.Element {
    let { fragment } = this.props;
    let lang_uid = fragment.luid ?? 0;
    let description = fragment.desc ?? [];
    let translations = fragment.tr ?? [];

    return (
      <WrapperGui allow_overflow className={cc(this.props.className, 'Fragment')}>
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

        <div className="Fragment-Description Fragment-TextBlock Label-selectable">
          {description.join('\n')}
        </div>

        <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
          <WrapperGui allow_overflow className="Fragment-Original BoxItem-expand">
            <div className="Fragment-TextBlock Label-selectable">
              <FancyTextGui highlight_crosscode_markup highlight_newlines>
                {fragment.orig}
              </FancyTextGui>
            </div>
            <BoxGui orientation="horizontal" className="Fragment-Buttons">
              <div className="BoxItem-expand" />
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
            {this.props.translation.text}
          </FancyTextGui>
        </div>
        <BoxGui orientation="horizontal" className="Fragment-Buttons">
          <span className="Label Label-ellipsis Label-selectable">{translation.author}</span>
          <span className="Label Label-ellipsis Label-selectable">
            at {format_timestamp(new Date(translation.ctime * 1000))}
          </span>
          <div className="BoxItem-expand" />
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

  private on_input = (event: Inferno.FormEvent<HTMLTextAreaElement>): void => {
    this.setState({ text: event.currentTarget.value });
  };

  public render(): JSX.Element {
    return (
      <WrapperGui allow_overflow className="Fragment-NewTranslation">
        <TextAreaGui
          value={this.state.text}
          onInput={this.on_input}
          placeholder="Add new translation..."
          autoComplete="off"
          spellCheck={false}
          rows={2}
        />
        <BoxGui orientation="horizontal" className="Fragment-Buttons">
          <div className="BoxItem-expand" />
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
