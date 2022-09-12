import './Box.scss';

import cc from 'clsx';
import * as React from 'react';

export interface BoxGuiProps extends React.HTMLAttributes<HTMLDivElement> {
  inline?: boolean;
  reverse_children?: boolean;
  scroll?: boolean;
  allow_overflow?: boolean;
  allow_wrapping?: boolean;
  align_items?: 'auto' | 'start' | 'end' | 'center' | 'baseline' | 'stretch';
}

function BoxGui(
  layout_name: string,
  {
    inline,
    reverse_children,
    scroll,
    allow_overflow,
    allow_wrapping,
    align_items,
    className,
    children,
    ...rest
  }: BoxGuiProps,
  ref: React.Ref<HTMLDivElement>,
): React.ReactElement {
  return (
    <div
      ref={ref}
      className={cc(
        className,
        'Box',
        layout_name,
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

export const VBoxGui = React.forwardRef(function VBoxGui(
  props: BoxGuiProps,
  ref: React.Ref<HTMLDivElement>,
): React.ReactElement {
  return BoxGui('VBox', props, ref);
});

export const HBoxGui = React.forwardRef(function HBoxGui(
  props: BoxGuiProps,
  ref: React.Ref<HTMLDivElement>,
): React.ReactElement {
  return BoxGui('HBox', props, ref);
});

export interface BoxItemFillerGuiProps extends React.HTMLAttributes<HTMLDivElement> {}

export const BoxItemFillerGui = React.forwardRef(function BoxItemFillerGui(
  { className, children, ...rest }: BoxItemFillerGuiProps,
  ref: React.Ref<HTMLDivElement>,
): React.ReactElement {
  return (
    <div ref={ref} className={cc(className, 'BoxItem-expand')} {...rest}>
      {children}
    </div>
  );
});

export interface WrapperGuiProps extends React.HTMLAttributes<HTMLDivElement> {
  scroll?: boolean;
  allow_overflow?: boolean;
  expand?: boolean;
}

export const WrapperGui = React.forwardRef(function WrapperGui(
  { scroll, allow_overflow, expand, className, children, ...rest }: WrapperGuiProps,
  ref: React.Ref<HTMLDivElement>,
): React.ReactElement {
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
