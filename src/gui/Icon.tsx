import './Icon.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';

import cc from 'clsx';
import * as preact from 'preact';
import * as preact_compat from 'preact/compat';

export interface IconGuiProps extends Omit<preact.JSX.HTMLAttributes<HTMLSpanElement>, 'icon'> {
  icon: string | null;
}

export const IconGui = preact_compat.forwardRef(function IconGui(
  { icon, className, class: _class, ...rest }: IconGuiProps,
  ref: preact.Ref<HTMLSpanElement>,
): preact.VNode {
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

export interface IconlikeTextGuiProps
  extends Omit<preact.JSX.HTMLAttributes<HTMLSpanElement>, 'icon'> {
  icon: string;
}

export const IconlikeTextGui = preact_compat.forwardRef(function IconlikeTextGui(
  { icon, className, class: _class, ...rest }: IconlikeTextGuiProps,
  ref: preact.Ref<HTMLSpanElement>,
): preact.VNode {
  return (
    <span ref={ref} role="img" className={cc(className, 'IconlikeText')} {...rest}>
      {icon}
    </span>
  );
});
