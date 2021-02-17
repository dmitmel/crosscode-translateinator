import * as Inferno from 'inferno';
import './Box.scss';

export interface BoxProps extends Inferno.Props<typeof BoxGui> {
  orientation: 'vertical' | 'horizontal';
  reverse_children?: boolean;
  scroll?: boolean;
}

export function BoxGui(props: BoxProps): JSX.Element {
  let clazz = `Box Box-orientation-${props.orientation}`;
  if (props.reverse_children) clazz += ' Box-reverse_children';
  if (props.scroll) clazz += ' Box-scroll';
  if (props.className != null) clazz += ` ${props.className}`;
  return <div className={clazz}>{props.children}</div>;
}
