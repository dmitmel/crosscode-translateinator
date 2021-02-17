import './Editor.scss';
import * as Inferno from 'inferno';
import { BoxGui } from './Box';

export function EditorGui(): JSX.Element {
  return (
    <BoxGui orientation="vertical" className="Editor">
      <EditorTabListGui />
      <div className="FragmentList BoxItem-expand">Hi!</div>
    </BoxGui>
  );
}

export interface EditorTabListProps extends Inferno.Props<typeof EditorTabListGui> {}

export function EditorTabListGui(props: EditorTabListProps): JSX.Element {
  let clazz = 'EditorTabList';
  if (props.className != null) clazz += props.className;
  return (
    <BoxGui orientation="horizontal" className={clazz}>
      <EditorTabGui active={false} special={true} name={'Search'} />
      <EditorTabGui active={false} special={true} name={'Queue'} />
      <EditorTabGui active={true} special={false} name={'database.json'} />
      <EditorTabGui active={false} special={false} name={'bergen.json'} />
      <EditorTabGui active={false} special={false} name={'gui.en_US.json'} />
    </BoxGui>
  );
}

export interface EditorTabProps extends Inferno.Props<typeof EditorTabGui> {
  special: boolean;
  name: string;
  active: boolean;
}

export function EditorTabGui(props: EditorTabProps): JSX.Element {
  let clazz = 'EditorTab';
  if (props.special) clazz += ' EditorTab-special';
  if (props.active) clazz += ' EditorTab-active';
  return <div className={clazz}>{props.name} [x]</div>;
}
