import './Editor.scss';
import { BoxGui } from './Box';
import { IconGui } from './Icon';
import cc from 'classcat';
import * as utils from '../utils';
import { FancyTextGui } from './FancyText';
import { IconButtonGui } from './Button';

export interface EditorGuiProps {
  className?: string;
}

export function EditorGui(props: utils.ComponentProps<EditorGuiProps>): JSX.Element {
  return (
    <BoxGui
      orientation="vertical"
      className={cc([
        props.className,
        {
          Editor: true,
        },
      ])}>
      <EditorTabListGui />
      <BoxGui orientation="vertical" scroll className="BoxItem-expand">
        <FragmentListGui />
      </BoxGui>
    </BoxGui>
  );
}

export interface EditorTabListGuiProps {
  className?: string;
}

export function EditorTabListGui(props: utils.ComponentProps<EditorTabListGuiProps>): JSX.Element {
  return (
    <BoxGui
      orientation="horizontal"
      scroll
      className={cc([
        props.className,
        {
          EditorTabList: true,
        },
      ])}>
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

export function EditorTabGui(props: utils.ComponentProps<EditorTabGuiProps>): JSX.Element {
  return (
    <div
      className={cc({
        EditorTab: true,
        'EditorTab-active': props.active,
      })}
      tabIndex={0}>
      <IconGui icon={EDITOR_TAB_ICONS.get(props.type)} /> {props.name} <IconGui icon="x" />
    </div>
  );
}

export interface FragmentListGuiProps {
  className?: string;
}

export function FragmentListGui(props: utils.ComponentProps<FragmentListGuiProps>): JSX.Element {
  return (
    <div
      className={cc([
        props.className,
        {
          FragmentList: true,
        },
      ])}>
      <FragmentGui
        fragment_data={{
          file_path: 'data/maps/hideout/entrance.json',
          json_path: 'entities/20/settings/event/6/text',
          lang_uid: 49,
          description_lines: ['EventTrigger intro', 'SHOW_CENTER_MSG'],
          original_text: [
            '\n',
            '\\s[1]CrossCode is designed with \\c[3]challenge\\c[0] in mind for both \\c[3]combat\\c[0] and \\c[3]puzzles\\c[0], and we encourage every player to try the game with its intended difficulty.\n',
            '\n',
            'However, if those challenges end up making the game less enjoyable or even inaccessible for you, we provide options to tweak the difficulty through the \\c[3]assists\\c[0] tab in the \\c[3]options\\c[0] menu.',
          ].join(''),
          translations: [
            {
              author: 'Packy',
              timestamp: new Date(1614005617 * 1000),
              text: [
                '\n',
                '\\s[1]CrossCode разрабатывался с учётом \\c[3]вызова для игрока\\c[0], как в \\c[3]сражениях\\c[0], так и в \\c[3]головоломках\\c[0], и мы призываем всех игроков попробовать игру на предустановленной сложности. \n',
                '\n',
                '\n',
                '\n',
                '\n',
                '\n',
                '\n',
                'Однако, если это делает игру слишком сложной или даже непроходимой для вас, в меню \\c[3]настроек\\c[0] имеется \\c[3]вкладка\\c[0] c детальными настройками сложности.',
              ].join(''),
            },
          ],
        }}
      />
    </div>
  );
}

export interface FragmentGuiProps {
  className?: string;
  fragment_data: {
    file_path: string;
    json_path: string;
    lang_uid: number;
    description_lines: string[];
    original_text: string;
    translations: Array<{
      author: string;
      timestamp: Date;
      text: string;
    }>;
  };
}

export function FragmentGui(props: utils.ComponentProps<FragmentGuiProps>): JSX.Element {
  let { fragment_data } = props;
  return (
    <BoxGui
      orientation="vertical"
      allow_overflow
      className={cc([
        props.className,
        {
          Fragment: true,
        },
      ])}>
      <BoxGui orientation="horizontal" allow_wrapping allow_overflow className="Fragment-Location">
        <div title="File path">
          <IconGui icon="file-earmark-text" />{' '}
          <a href="#" tabIndex={0} onClick={(e) => e.preventDefault()}>
            <span className="Label-selectable">{fragment_data.file_path}</span>
          </a>
        </div>
        <div title="JSON path">
          <IconGui icon="code" />{' '}
          <span className="Label-selectable">{fragment_data.json_path}</span>
        </div>
        {fragment_data.lang_uid !== 0 ? (
          <div title="Lang UID">
            <span className="IconlikeText">#</span>{' '}
            <span className="Label-selectable">{fragment_data.lang_uid}</span>
          </div>
        ) : null}
      </BoxGui>

      <div className="Fragment-Description Fragment-TextBlock">
        {fragment_data.description_lines.join('\n')}
      </div>

      <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
        <BoxGui orientation="vertical" allow_overflow className="Fragment-Original BoxItem-expand">
          <div className="Fragment-TextBlock">
            <FancyTextGui
              highlight_crosscode_markup
              highlight_newlines
              className="Label-selectable">
              {fragment_data.original_text}
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
          {fragment_data.translations.flatMap((translation_data) => (
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
                  at {format_timestamp(translation_data.timestamp)}
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
