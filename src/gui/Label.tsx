import './Label.scss';

import cc from 'clsx';
import * as React from 'react';

export interface LabelGuiProps extends React.HTMLAttributes<HTMLSpanElement> {
  block?: boolean;
  ellipsis?: boolean;
  selectable?: boolean;
  preserve_whitespace?: boolean;
}

export const LabelGui = React.forwardRef(function LabelGui(
  { block, ellipsis, selectable, preserve_whitespace, className, children, ...rest }: LabelGuiProps,
  ref: React.Ref<HTMLSpanElement>,
): React.ReactElement {
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
