import './Box.scss';

import cc from 'clsx';
import * as preact from 'preact';

export interface BoxGuiProps extends preact.JSX.HTMLAttributes<HTMLDivElement> {
  inner_ref?: preact.Ref<HTMLDivElement>;
  orientation: 'vertical' | 'horizontal';
  inline?: boolean;
  reverse_children?: boolean;
  scroll?: boolean;
  allow_overflow?: boolean;
  allow_wrapping?: boolean;
  align_items?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
}

export function BoxGui({
  inner_ref,
  orientation,
  inline,
  reverse_children,
  scroll,
  allow_overflow,
  allow_wrapping,
  align_items,
  className,
  class: _class,
  children,
  ...rest
}: BoxGuiProps): preact.VNode {
  return (
    <div
      ref={inner_ref}
      className={cc(
        className,
        'Box',
        `Box-orientation-${orientation}`,
        align_items != null ? `Box-align-items-${align_items}` : null,
        {
          'Box-inline': inline,
          'Box-reverse-children': reverse_children,
          'Box-scroll': scroll,
          'Box-allow-overflow': allow_overflow,
          'Box-allow-wrapping': allow_wrapping,
        },
      )}
      {...rest}>
      {children}
    </div>
  );
}

export interface BoxItemFillerGuiProps extends preact.JSX.HTMLAttributes<HTMLDivElement> {
  inner_ref?: preact.Ref<HTMLDivElement>;
}

export function BoxItemFillerGui({
  inner_ref,
  className,
  class: _class,
  children,
  ...rest
}: BoxItemFillerGuiProps): preact.VNode {
  return (
    <div ref={inner_ref} className={cc(className, 'BoxItem-expand')} {...rest}>
      {children}
    </div>
  );
}

export interface WrapperGuiProps extends preact.JSX.HTMLAttributes<HTMLDivElement> {
  inner_ref?: preact.Ref<HTMLDivElement>;
  scroll?: boolean;
  allow_overflow?: boolean;
  expand?: boolean;
}

export function WrapperGui({
  inner_ref,
  scroll,
  allow_overflow,
  expand,
  className,
  class: _class,
  children,
  ...rest
}: WrapperGuiProps): preact.VNode {
  return (
    <div
      ref={inner_ref}
      className={cc(className, 'Wrapper', {
        'Wrapper-scroll': scroll,
        'Wrapper-allow-overflow': allow_overflow,
        'Wrapper-expand': expand,
      })}
      {...rest}>
      {children}
    </div>
  );
}
