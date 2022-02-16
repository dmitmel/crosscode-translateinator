import './Icon.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';

import cc from 'clsx';
import * as React from 'react';

export interface IconGuiProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon: string | null;
}

export const IconGui = React.forwardRef(function IconGui(
  { icon, className, ...rest }: IconGuiProps,
  ref: React.Ref<HTMLSpanElement>,
): React.ReactElement {
  let valid_icon = icon != null && /^[a-z0-9-]+$/.test(icon);
  return (
    <span
      ref={ref}
      role="img"
      className={cc(
        className,
        'Icon',
        'bi',
        valid_icon ? `Icon-${icon}` : 'IconBlank',
        valid_icon ? `bi-${icon}` : null,
      )}
      {...rest}
    />
  );
});

export interface IconlikeTextGuiProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon: string;
}

export const IconlikeTextGui = React.forwardRef(function IconlikeTextGui(
  { icon, className, ...rest }: IconlikeTextGuiProps,
  ref: React.Ref<HTMLSpanElement>,
): React.ReactElement {
  return (
    <span ref={ref} role="img" className={cc(className, 'IconlikeText')} {...rest}>
      {icon}
    </span>
  );
});
