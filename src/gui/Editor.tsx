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
        <BoxGui orientation="vertical" scroll className="BoxItem-expand">
          {<FragmentListGui fragments={this.state.fragments} />}
        </BoxGui>
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

export function FragmentListGui(props: gui.ComponentProps<FragmentListGuiProps>): JSX.Element {
  return (
    <WrapperGui className={cc([props.className, 'FragmentList'])} scroll>
      {props.fragments.map((f) => (
        <FragmentGui key={f.id} fragment={f} />
      ))}
    </WrapperGui>
  );
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
    <BoxGui orientation="vertical" allow_overflow className={cc([props.className, 'Fragment'])}>
      <BoxGui orientation="horizontal" allow_wrapping allow_overflow className="Fragment-Location">
        <div title="File path">
          <IconGui icon="file-earmark-text" />{' '}
          <a href="#" tabIndex={0} onClick={(e) => e.preventDefault()}>
            <span className="Label-selectable">{fragment.file}</span>
          </a>
        </div>
        <div
          title="JSON path"
          $ChildFlag={ChildFlags.UnknownChildren} // for some reason the parser can't figure this node out
        >
          <IconGui icon="code" /> <span className="Label-selectable">{fragment.json}</span>
        </div>
        {lang_uid !== 0 ? (
          <div title="Lang UID">
            <span className="IconlikeText">#</span>{' '}
            <span className="Label-selectable">{lang_uid}</span>
          </div>
        ) : null}
      </BoxGui>

      <div className="Fragment-Description Fragment-TextBlock">{description.join('\n')}</div>

      <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
        <BoxGui orientation="vertical" allow_overflow className="Fragment-Original BoxItem-expand">
          <div className="Fragment-TextBlock">
            <FancyTextGui
              highlight_crosscode_markup
              highlight_newlines
              className="Label-selectable">
              {fragment.orig}
            </FancyTextGui>
          </div>
          <BoxGui orientation="horizontal" className="Fragment-Buttons">
            <div className="BoxItem-expand" />
            <IconButtonGui icon="clipboard" title="Copy the original text" />
            <IconButtonGui icon="search" title="Search other fragments with this original text" />
          </BoxGui>
        </BoxGui>

        <BoxGui
          orientation="vertical"
          allow_overflow
          className="BoxItem-expand Fragment-Translations">
          {translations.flatMap((translation_data) => (
            <BoxGui orientation="vertical" allow_overflow className="Fragment-Translation">
              <div className="Fragment-TextBlock">
                <FancyTextGui
                  highlight_crosscode_markup
                  highlight_newlines
                  className="Label-selectable">
                  {translation_data.text}
                </FancyTextGui>
              </div>
              <BoxGui orientation="horizontal" className="Fragment-Buttons">
                <div className="Label Label-ellipsis Label-selectable">
                  {translation_data.author}
                </div>
                <div className="Label Label-ellipsis Label-selectable">
                  at {format_timestamp(new Date(translation_data.ctime * 1000))}
                </div>
                <div className="BoxItem-expand" />
                <IconButtonGui icon="clipboard" title="Copy the translation text" />
                <IconButtonGui icon="pencil-square" title="Edit this translation" />
                <IconButtonGui
                  icon="chat-left-quote"
                  title="Add a comment about this translation"
                />
                <IconButtonGui icon="trash-fill" title="Delete this translation" />
              </BoxGui>
            </BoxGui>
          ))}
        </BoxGui>
      </BoxGui>
    </BoxGui>
  );
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
