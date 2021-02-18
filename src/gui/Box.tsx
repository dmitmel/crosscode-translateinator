import './Box.scss';

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
  let clazz = `Box Box-orientation-${orientation}`;
  if (reverse_children) clazz += ' Box-reverse_children';
  if (scroll) clazz += ' Box-scroll';
  if (className != null) clazz += ` ${className}`;
  return (
    <div className={clazz} {...rest}>
      {children}
    </div>
  );
}
