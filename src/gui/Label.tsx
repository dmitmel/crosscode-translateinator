import './Label.scss';

import cc from 'clsx';
import * as preact from 'preact';
import * as preact_compat from 'preact/compat';

export interface LabelGuiProps extends preact.JSX.HTMLAttributes<HTMLSpanElement> {
  block?: boolean;
  ellipsis?: boolean;
  selectable?: boolean;
  preserve_whitespace?: boolean;
}

export const LabelGui = preact_compat.forwardRef(function LabelGui(
  {
    block,
    ellipsis,
    selectable,
    preserve_whitespace,
    className,
    class: _class,
    children,
    ...rest
  }: LabelGuiProps,
  ref: preact.Ref<HTMLSpanElement>,
): preact.VNode {
  return (
    <span
      ref={ref}
      className={cc(className, {
        'Label-block': block,
        'Label-ellipsis': ellipsis,
        'Label-selectable': selectable,
        'Label-preserve-whitespace': preserve_whitespace,
      })}
      {...rest}>
      {children}
    </span>
  );
});
