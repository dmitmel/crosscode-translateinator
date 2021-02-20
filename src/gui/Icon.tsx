import * as utils from '../utils';
import './Icon.scss';
import cc from 'classcat';

let icons_require_context = require.context('bootstrap-icons/icons/', /* deep */ true, /\.svg$/);
let icon_names = new Set(icons_require_context.keys());

interface IconGuiProps extends SVGAttributes<SVGSVGElement> {
  icon: string | null | undefined;
  size?: number | string;
}

export const IconGui = utils.infernoForwardRef<IconGuiProps, SVGSVGElement>(function IconGui(
  { icon, size, className, class: _class, ...rest },
  ref,
) {
  size ??= '1em';

  let icon_file_path = icon != null ? `./${icon}.svg` : null;
  let icon_xml =
    icon_file_path != null && icon_names.has(icon_file_path)
      ? icons_require_context<string>(icon_file_path)
      : '';

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={size}
      height={size}
      fill="currentColor"
      className={cc({
        Icon: true,
        [`Icon-${icon}`]: icon != null,
        [String(className)]: className != null,
      })}
      {...rest}
      dangerouslySetInnerHTML={{ __html: icon_xml }}
    />
  );
});
