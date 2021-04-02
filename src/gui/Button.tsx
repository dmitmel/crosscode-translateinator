import * as utils from '../utils';
import { IconGui, IconGuiProps } from './Icon';
import cc from 'classcat';
import './Button.scss';

interface IconButtonGuiProps extends HTMLAttributes<HTMLButtonElement> {
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
  ...element_props
}: utils.ComponentProps<IconButtonGuiProps>): JSX.Element {
  return (
    <button type="button" tabIndex={0} className={cc([className, 'IconButton'])} {...element_props}>
      <IconGui icon={icon} size={size} {...icon_props} />
    </button>
  );
}
