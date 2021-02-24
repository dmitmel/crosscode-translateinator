import * as utils from '../utils';
import { IconGui, IconGuiProps } from './Icon';
import cc from 'classcat';
import './Button.scss';

interface IconButtonGuiProps extends HTMLAttributes<HTMLDivElement> {
  icon: string | null | undefined;
  size?: number | string;
  icon_props?: IconGuiProps;
}

export function IconButtonGui({
  icon,
  size,
  icon_props,
  className,
  class: _class,
  ...div_props
}: utils.ComponentProps<IconButtonGuiProps>): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cc([
        className,
        {
          IconButton: true,
        },
      ])}
      {...div_props}>
      <IconGui icon={icon} size={size} {...icon_props} />
    </div>
  );
}
