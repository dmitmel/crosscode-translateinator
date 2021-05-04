import './Label.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

export interface LabelGuiProps extends HTMLAttributes<HTMLSpanElement> {
  inner_ref?: Inferno.Ref<HTMLSpanElement>;
  block?: boolean;
  ellipsis?: boolean;
  selectable?: boolean;
  preserve_whitespace?: boolean;
}

export function LabelGui({
  inner_ref,
  block,
  ellipsis,
  selectable,
  preserve_whitespace,
  className,
  class: _class,
  children,
  ...rest
}: LabelGuiProps): JSX.Element {
  return (
    <span
      ref={inner_ref}
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
}