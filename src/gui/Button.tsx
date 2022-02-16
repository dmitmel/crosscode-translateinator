import './Button.scss';

import cc from 'clsx';
import * as React from 'react';

import { IconGui, IconGuiProps } from './Icon';

interface IconButtonGuiProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon: string | null;
  icon_props?: IconGuiProps;
}

export const IconButtonGui = React.forwardRef(function IconButtonGui(
  { icon, icon_props, className, ...element_props }: IconButtonGuiProps,
  ref: React.Ref<HTMLButtonElement>,
): React.ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={0}
      className={cc(className, 'IconButton')}
      {...element_props}>
      <IconGui icon={icon} {...icon_props} />
    </button>
  );
});
