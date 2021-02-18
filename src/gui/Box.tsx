import './Box.scss';
import cc from 'classcat';

export interface BoxGuiProps extends HTMLAttributes<HTMLDivElement> {
  orientation: 'vertical' | 'horizontal';
  reverse_children?: boolean;
  scroll?: boolean;
}

export function BoxGui({
  orientation,
  reverse_children,
  scroll,
  className,
  class: _class,
  children,
  ...rest
}: BoxGuiProps): JSX.Element {
  return (
    <div
      className={cc({
        Box: true,
        [`Box-orientation-${orientation}`]: true,
        'Box-reverse_children': reverse_children,
        'Box-scroll': scroll,
        [String(className)]: className != null,
      })}
      {...rest}>
      {children}
    </div>
  );
}
