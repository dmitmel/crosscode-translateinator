import './Button.scss';

import cc from 'clsx';
import * as preact from 'preact';

import { IconGui, IconGuiProps } from './Icon';

interface IconButtonGuiProps extends Omit<preact.JSX.HTMLAttributes<HTMLButtonElement>, 'icon'> {
  icon: string | null;
  icon_props?: IconGuiProps;
}

export function IconButtonGui({
  icon,
  icon_props,
  className,
  class: _class,
  ...element_props
}: IconButtonGuiProps): preact.VNode {
  return (
    <button type="button" tabIndex={0} className={cc(className, 'IconButton')} {...element_props}>
      <IconGui icon={icon} {...icon_props} />
    </button>
  );
}
