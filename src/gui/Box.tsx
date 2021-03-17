import './Box.scss';
import cc from 'classcat';

export interface BoxGuiProps extends HTMLAttributes<HTMLDivElement> {
  orientation: 'vertical' | 'horizontal';
  inline?: boolean;
  reverse_children?: boolean;
  scroll?: boolean;
  allow_overflow?: boolean;
  allow_wrapping?: boolean;
}

export function BoxGui({
  orientation,
  inline,
  reverse_children,
  scroll,
  allow_overflow,
  allow_wrapping,
  className,
  class: _class,
  children,
  ...rest
}: BoxGuiProps): JSX.Element {
  return (
    <div
      className={cc([
        className,
        'Box',
        `Box-orientation-${orientation}`,
        {
          'Box-inline': inline,
          'Box-reverse-children': reverse_children,
          'Box-scroll': scroll,
          'Box-allow-overflow': allow_overflow,
          'Box-allow-wrapping': allow_wrapping,
        },
      ])}
      {...rest}>
      {children}
    </div>
  );
}

export interface WrapperGuiProps extends HTMLAttributes<HTMLDivElement> {
  scroll?: boolean;
  allow_overflow?: boolean;
}

export function WrapperGui({
  scroll,
  allow_overflow,
  className,
  class: _class,
  children,
  ...rest
}: WrapperGuiProps): JSX.Element {
  return (
    <div
      className={cc([
        className,
        'Wrapper',
        {
          'Wrapper-scroll': scroll,
          'Wrapper-allow-overflow': allow_overflow,
        },
      ])}
      {...rest}>
      {children}
    </div>
  );
}
