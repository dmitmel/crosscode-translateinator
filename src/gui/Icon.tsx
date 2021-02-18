import * as utils from '../utils';
import iconsAtlasUrl from 'bootstrap-icons/bootstrap-icons.svg';
import './Icon.scss';
import cc from 'classcat';

interface IconGuiProps extends SVGAttributes<SVGSVGElement> {
  name: string;
  color?: string;
  size?: number | string;
}

export const IconGui = utils.infernoForwardRef<IconGuiProps, SVGSVGElement>(function IconGui(
  { name, color, size, className, class: _class, ...rest },
  ref,
) {
  color ??= 'currentColor';
  size ??= '1em';
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={size}
      height={size}
      fill={color}
      className={cc({
        Icon: true,
        [String(className)]: className != null,
      })}
      {...rest}>
      <use xlinkHref={`${iconsAtlasUrl}#${encodeURIComponent(name)}`} />
    </svg>
  );
});
