import './Editor.scss';
import * as Inferno from 'inferno';
import { BoxGui } from './Box';
import { IconGui } from './Icon';
import cc from 'classcat';

export interface EditorGuiProps extends Inferno.Props<typeof EditorGui> {}

export function EditorGui(props: EditorGuiProps): JSX.Element {
  return (
    <BoxGui
      orientation="vertical"
      className={cc({
        Editor: true,
        [String(props.className)]: props.className != null,
      })}>
      <EditorTabListGui />
      <div className="FragmentList BoxItem-expand">Hi!</div>
    </BoxGui>
  );
}

export interface EditorTabListGuiProps extends Inferno.Props<typeof EditorTabListGui> {}

export function EditorTabListGui(props: EditorTabListGuiProps): JSX.Element {
  return (
    <BoxGui
      orientation="horizontal"
      scroll
      className={cc({
        EditorTabList: true,
        [String(props.className)]: props.className != null,
      })}>
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

export interface EditorTabGuiProps extends Inferno.Props<typeof EditorTabGui> {
  type: EditorTabType;
  name: string;
  active: boolean;
}

export function EditorTabGui(props: EditorTabGuiProps): JSX.Element {
  return (
    <div
      className={cc({
        EditorTab: true,
        'EditorTab-active': props.active,
      })}
      tabIndex={0}>
      <IconGui name={EDITOR_TAB_ICONS.get(props.type)!} /> {props.name} <IconGui name="x" />
    </div>
  );
}
