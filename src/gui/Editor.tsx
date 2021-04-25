import * as Inferno from 'inferno';
import { ChildFlags } from 'inferno-vnode-flags';
import './Editor.scss';
import { BoxGui, WrapperGui } from './Box';
import { IconGui } from './Icon';
import cc from 'classcat';
import * as gui from '../gui';
import { FancyTextGui } from './FancyText';
import { IconButtonGui } from './Button';
import { ListedFragment, ListedTranslation } from '../backend';
import { AppMainGuiCtx } from './AppMain';
import './Label.scss';
import './TextArea.scss';
import autosize from 'autosize';

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
      <BoxGui orientation="vertical" className={cc([this.props.className, 'Editor'])}>
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
    <BoxGui orientation="horizontal" scroll className={cc([props.className, 'EditorTabList'])}>
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
      className={cc(['EditorTab', { 'EditorTab-active': props.active }])}
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

export function FragmentGui(props: gui.ComponentProps<FragmentGuiProps>): JSX.Element {
  let { fragment } = props;
  let lang_uid = fragment.luid ?? 0;
  let description = fragment.desc ?? [];
  let translations = fragment.tr ?? [];

  return (
    <WrapperGui allow_overflow className={cc([props.className, 'Fragment'])}>
      <BoxGui orientation="horizontal" allow_wrapping allow_overflow className="Fragment-Location">
        <span title="File path">
          <IconGui icon="file-earmark-text" />{' '}
          <a
            href="#"
            tabIndex={0}
            onClick={(e) => e.preventDefault()}
            className={'Label-selectable'}>
            {fragment.file}
          </a>
        </span>
        <span
          title="JSON path"
          $ChildFlag={ChildFlags.UnknownChildren} // for some reason the parser can't figure this node out
        >
          <IconGui icon="code" /> <span className="Label-selectable">{fragment.json}</span>
        </span>
        {lang_uid !== 0 ? (
          <span title="Lang UID">
            <span className="IconlikeText">#</span>{' '}
            <span className="Label-selectable">{lang_uid}</span>
          </span>
        ) : null}
      </BoxGui>

      <div className="Fragment-Description Fragment-TextBlock">{description.join('\n')}</div>

      <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
        <WrapperGui allow_overflow className="Fragment-Original BoxItem-expand">
          <div className="Fragment-TextBlock Label-selectable">
            <FancyTextGui highlight_crosscode_markup highlight_newlines>
              {fragment.orig}
            </FancyTextGui>
          </div>
          <BoxGui orientation="horizontal" className="Fragment-Buttons">
            <div className="BoxItem-expand" />
            <IconButtonGui icon="clipboard" title="Copy the original text" />
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

interface TranslationGuiProps {
  fragment: ListedFragment & { file: string };
  translation: ListedTranslation;
}

export function TranslationGui(props: TranslationGuiProps): JSX.Element {
  return (
    <WrapperGui allow_overflow className="Fragment-Translation">
      <div className="Fragment-TextBlock Label-selectable">
        <FancyTextGui highlight_crosscode_markup highlight_newlines>
          {props.translation.text}
        </FancyTextGui>
      </div>
      <BoxGui orientation="horizontal" className="Fragment-Buttons">
        <span className="Label Label-ellipsis Label-selectable">{props.translation.author}</span>
        <span className="Label Label-ellipsis Label-selectable">
          at {format_timestamp(new Date(props.translation.ctime * 1000))}
        </span>
        <div className="BoxItem-expand" />
        <IconButtonGui icon="clipboard" title="Copy the translation text" />
        <IconButtonGui icon="pencil-square" title="Edit this translation" />
        <IconButtonGui icon="chat-left-quote" title="Add a comment about this translation" />
        <IconButtonGui icon="trash-fill" title="Delete this translation" />
      </BoxGui>
    </WrapperGui>
  );
}

export interface NewTranslationGuiProps {
  fragment: ListedFragment & { file: string };
}

export interface NewTranslationGuiState {
  text: string;
}

// Autosized textarea implementation is based on
// <https://github.com/buildo/react-autosize-textarea/blob/56225f8d8d2f1e5b3163442a0e2bccb2a7530931/src/TextareaAutosize.tsx>
export class NewTranslationGui extends Inferno.Component<
  NewTranslationGuiProps,
  NewTranslationGuiState
> {
  public state: NewTranslationGuiState = {
    text: '',
  };

  public textarea: HTMLTextAreaElement | null = null;

  private onInput = (event: Inferno.FormEvent<HTMLTextAreaElement>): void => {
    let textArea = event.currentTarget;
    // textArea.style.height = 'auto';
    // textArea.style.height = `${textArea.scrollHeight}px`;
    this.setState({ text: textArea.value });
  };

  public componentDidMount(): void {
    if (!(this.textarea != null)) {
      throw new Error('Assertion failed: this.textarea != null');
    }
    autosize(this.textarea);
  }

  public componentWillUnmount(): void {
    if (!(this.textarea != null)) {
      throw new Error('Assertion failed: this.textarea != null');
    }
    autosize.destroy(this.textarea);
  }

  public componentDidUpdate(): void {
    if (!(this.textarea != null)) {
      throw new Error('Assertion failed: this.textarea != null');
    }
    // autosize.update(this.textarea);
  }

  public render(): JSX.Element {
    let textareaRef = (textarea: HTMLTextAreaElement): void => {
      this.textarea = textarea;
    };
    return (
      <WrapperGui allow_overflow className="Fragment-NewTranslation">
        <textarea
          ref={textareaRef}
          value={this.state.text}
          onInput={this.onInput}
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
