import './Icon.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';

import cc from 'clsx';
import * as Inferno from 'inferno';

export interface IconGuiProps extends HTMLAttributes<HTMLSpanElement> {
  inner_ref?: Inferno.Ref<HTMLSpanElement>;
  icon: string | null;
}

export function IconGui({
  inner_ref,
  icon,
  className,
  class: _class,
  ...rest
}: IconGuiProps): JSX.Element {
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

export interface IconlikeTextGuiProps extends HTMLAttributes<HTMLSpanElement> {
  inner_ref?: Inferno.Ref<HTMLSpanElement>;
  icon: string;
}

export function IconlikeTextGui({
  inner_ref,
  icon,
  className,
  class: _class,
  ...rest
}: IconlikeTextGuiProps): JSX.Element {
  return (
    <span ref={inner_ref} role="img" className={cc(className, 'IconlikeText')} {...rest}>
      {icon}
    </span>
  );
}
