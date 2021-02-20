import * as utils from '../utils';
import './Icon.scss';
import cc from 'classcat';

let icons_require_context = require.context('bootstrap-icons/icons/', /* deep */ true, /\.svg$/);

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
  let icon_xml = '';
  if (icon_file_path != null) {
    try {
      icon_xml = icons_require_context<string>(icon_file_path);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }

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
