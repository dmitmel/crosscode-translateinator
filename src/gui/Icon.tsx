import './Icon.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';

import cc from 'clsx';
import * as preact from 'preact';

export interface IconGuiProps extends Omit<preact.JSX.HTMLAttributes<HTMLSpanElement>, 'icon'> {
  inner_ref?: preact.Ref<HTMLSpanElement>;
  icon: string | null;
}

export function IconGui({
  inner_ref,
  icon,
  className,
  class: _class,
  ...rest
}: IconGuiProps): preact.VNode {
  let valid_icon = icon != null && /^[a-z0-9-]+$/.test(icon);
  return (
    <span
      ref={inner_ref}
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
}

export interface IconlikeTextGuiProps
  extends Omit<preact.JSX.HTMLAttributes<HTMLSpanElement>, 'icon'> {
  inner_ref?: preact.Ref<HTMLSpanElement>;
  icon: string;
}

export function IconlikeTextGui({
  inner_ref,
  icon,
  className,
  class: _class,
  ...rest
}: IconlikeTextGuiProps): preact.VNode {
  return (
    <span ref={inner_ref} role="img" className={cc(className, 'IconlikeText')} {...rest}>
      {icon}
    </span>
  );
}
