import './Icon.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import icons_obj from '../icons_list.json';
import * as utils from '../utils';

let icons_map = new Map<string, string>();
for (let k in icons_obj) {
  if (utils.has_key(icons_obj, k)) {
    icons_map.set(k, icons_obj[k]);
  }
}

export interface IconGuiProps extends SVGAttributes<SVGSVGElement> {
  inner_ref?: Inferno.Ref<SVGSVGElement>;
  icon: string | null | undefined;
  size?: number | string;
  title?: string;
}

export function IconGui({
  inner_ref,
  icon,
  size,
  title,
  className,
  class: _class,
  ...rest
}: IconGuiProps): JSX.Element {
  let icon_xml = '';
  if (title != null) {
    icon_xml += `<title>${utils.escape_html(title)}</title>`;
  }
  if (icon != null) {
    icon_xml += icons_map.get(icon) ?? '';
  }

  size ??= '1em';
  return (
    <svg
      ref={inner_ref}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 16 16"
      className={cc(className, 'Icon', icon != null ? `Icon-${icon}` : null)}
      {...rest}
      dangerouslySetInnerHTML={{ __html: icon_xml }}
    />
  );
}

export interface IconlikeTextGuiProps extends HTMLAttributes<HTMLSpanElement> {
  inner_ref?: Inferno.Ref<HTMLSpanElement>;
  icon: string;
}

export function IconlikeTextGui({
  inner_ref,
  icon,
  className,
  class: _class,
  ...rest
}: IconlikeTextGuiProps): JSX.Element {
  return (
    <span ref={inner_ref} className={cc(className, 'IconlikeText')} {...rest}>
      {icon}
    </span>
  );
}
