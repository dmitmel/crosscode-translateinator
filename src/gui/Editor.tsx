import './Editor.scss';
import * as Inferno from 'inferno';
import { BoxGui } from './Box';
import { IconGui } from './Icon';

export interface EditorGuiProps extends Inferno.Props<typeof EditorGui> {}

export function EditorGui(props: EditorGuiProps): JSX.Element {
  let clazz = 'Editor';
  if (props.className != null) clazz += ` ${props.className}`;
  return (
    <BoxGui orientation="vertical" className={clazz}>
      <EditorTabListGui />
      <div className="FragmentList BoxItem-expand">Hi!</div>
    </BoxGui>
  );
}

export interface EditorTabListGuiProps extends Inferno.Props<typeof EditorTabListGui> {}

export function EditorTabListGui(props: EditorTabListGuiProps): JSX.Element {
  let clazz = 'EditorTabList';
  if (props.className != null) clazz += props.className;
  return (
    <BoxGui orientation="horizontal" scroll className={clazz}>
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
  let clazz = 'EditorTab';
  if (props.active) clazz += ' EditorTab-active';
  let icon = EDITOR_TAB_ICONS.get(props.type)!;
  return (
    <div className={clazz}>
      <IconGui name={icon} /> {props.name} <IconGui name="x" />
    </div>
  );
}
