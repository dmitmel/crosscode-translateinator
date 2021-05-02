import './Box.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

export interface BoxGuiProps extends HTMLAttributes<HTMLDivElement> {
  inner_ref?: Inferno.Ref<HTMLDivElement> | Inferno.Refs<HTMLDivElement>;
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
}: BoxGuiProps): JSX.Element {
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

export interface BoxItemFillerGuiProps extends HTMLAttributes<HTMLDivElement> {
  inner_ref?: Inferno.Ref<HTMLDivElement> | Inferno.Refs<HTMLDivElement>;
}

export function BoxItemFillerGui({
  inner_ref,
  className,
  class: _class,
  children,
  ...rest
}: BoxItemFillerGuiProps): JSX.Element {
  return (
    <div ref={inner_ref} className={cc(className, 'BoxItem-expand')} {...rest}>
      {children}
    </div>
  );
}

export interface WrapperGuiProps extends HTMLAttributes<HTMLDivElement> {
  inner_ref?: Inferno.Ref<HTMLDivElement> | Inferno.Refs<HTMLDivElement>;
  scroll?: boolean;
  allow_overflow?: boolean;
}

export function WrapperGui({
  inner_ref,
  scroll,
  allow_overflow,
  className,
  class: _class,
  children,
  ...rest
}: WrapperGuiProps): JSX.Element {
  return (
    <div
      ref={inner_ref}
      className={cc(className, 'Wrapper', {
        'Wrapper-scroll': scroll,
        'Wrapper-allow-overflow': allow_overflow,
      })}
      {...rest}>
      {children}
    </div>
  );
}
