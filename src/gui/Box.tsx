import './Box.scss';

import cc from 'clsx';
import * as preact from 'preact';
import * as preact_compat from 'preact/compat';

export interface BoxGuiProps extends preact.JSX.HTMLAttributes<HTMLDivElement> {
  orientation: 'vertical' | 'horizontal';
  inline?: boolean;
  reverse_children?: boolean;
  scroll?: boolean;
  allow_overflow?: boolean;
  allow_wrapping?: boolean;
  align_items?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
}

export const BoxGui = preact_compat.forwardRef(function BoxGui(
  {
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
  }: BoxGuiProps,
  ref: preact.Ref<HTMLDivElement>,
): preact.VNode {
  return (
    <div
      ref={ref}
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
});

export interface BoxItemFillerGuiProps extends preact.JSX.HTMLAttributes<HTMLDivElement> {}

export const BoxItemFillerGui = preact_compat.forwardRef(function BoxItemFillerGui(
  { className, class: _class, children, ...rest }: BoxItemFillerGuiProps,
  ref: preact.Ref<HTMLDivElement>,
): preact.VNode {
  return (
    <div ref={ref} className={cc(className, 'BoxItem-expand')} {...rest}>
      {children}
    </div>
  );
});

export interface WrapperGuiProps extends preact.JSX.HTMLAttributes<HTMLDivElement> {
  scroll?: boolean;
  allow_overflow?: boolean;
  expand?: boolean;
}

export const WrapperGui = preact_compat.forwardRef(function WrapperGui(
  { scroll, allow_overflow, expand, className, class: _class, children, ...rest }: WrapperGuiProps,
  ref: preact.Ref<HTMLDivElement>,
): preact.VNode {
  return (
    <div
      ref={ref}
      className={cc(className, 'Wrapper', {
        'Wrapper-scroll': scroll,
        'Wrapper-allow-overflow': allow_overflow,
        'Wrapper-expand': expand,
      })}
      {...rest}>
      {children}
    </div>
  );
});
