import * as utils from '../utils';
import iconsAtlasUrl from 'bootstrap-icons/bootstrap-icons.svg';
import './Icon.scss';
import cc from 'classcat';

interface IconGuiProps extends SVGAttributes<SVGSVGElement> {
  icon: string | null | undefined;
  size?: number | string;
}

export const IconGui = utils.infernoForwardRef<IconGuiProps, SVGSVGElement>(function IconGui(
  { icon, fill, size, className, class: _class, ...rest },
  ref,
) {
  fill ??= 'currentColor';
  size ??= '1em';
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={size}
      height={size}
      fill={fill}
      className={cc({
        Icon: true,
        [`Icon-${icon}`]: icon != null,
        [String(className)]: className != null,
      })}
      {...rest}>
      {icon != null ? <use xlinkHref={`${iconsAtlasUrl}#${encodeURIComponent(icon)}`} /> : null}
    </svg>
  );
});
