import './Button.scss';

import cc from 'clsx';

import * as gui from '../gui';
import { IconGui, IconGuiProps } from './Icon';

interface IconButtonGuiProps extends HTMLAttributes<HTMLButtonElement> {
  icon: string | null;
  icon_props?: IconGuiProps;
}

export function IconButtonGui({
  icon,
  icon_props,
  className,
  class: _class,
  ...element_props
}: gui.ComponentProps<IconButtonGuiProps>): JSX.Element {
  return (
    <button type="button" tabIndex={0} className={cc(className, 'IconButton')} {...element_props}>
      <IconGui icon={icon} {...icon_props} />
    </button>
  );
}
