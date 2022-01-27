import 'inferno-compat';

import * as Inferno from 'inferno';
import { VNodeFlags } from 'inferno-vnode-flags';

// Patch the inferno-compat layer to fix the conversion of React `styles`,
// avoiding changing custom CSS properties. TODO: contribute this to the
// upstream. Most of the code here was copied from either Inferno or React, in
// the name of perfect compatibility.
Inferno.options.reactStyles = false;
let orig_create_vnode = Inferno.options.createVNode;
Inferno.options.createVNode = (vnode: Inferno.VNode): void => {
  orig_create_vnode?.(vnode);

  // <https://github.com/infernojs/inferno/blob/v7.4.11/packages/inferno-compat/src/index.ts#L156>
  // <https://github.com/facebook/react/blob/v16.14.0/packages/react-dom/src/shared/CSSPropertyOperations.js#L24>
  if ((vnode.flags & VNodeFlags.Element) !== 0) {
    let styles = vnode.props?.style;
    if (styles != null && typeof styles !== 'string') {
      let new_styles: Record<string, unknown> = {};

      for (let name in styles) {
        let value = styles[name];
        let is_custom_property = name.startsWith('--');
        if (!is_custom_property) {
          name = hyphenate_style_name(name);
        }
        new_styles[name] = normalize_style_value(name, value, is_custom_property);
      }

      vnode.props.style = new_styles;
    }
  }
};

const UPPERCASE_PATTERN = /[A-Z]/g;
const MS_PATTERN = /^ms-/;
// <https://github.com/facebook/react/blob/v16.14.0/packages/react-dom/src/shared/hyphenateStyleName.js#L26>
// <https://github.com/infernojs/inferno/blob/v7.4.11/packages/inferno-compat/src/reactstyles.ts#L45>
function hyphenate_style_name(name: string): string {
  return name.replace(UPPERCASE_PATTERN, '-$&').toLowerCase().replace(MS_PATTERN, '-ms-');
}

// <https://github.com/facebook/react/blob/v16.14.0/packages/react-dom/src/shared/CSSProperty.js#L11>
export const UNITLESS_NUMBER_PROPERTIES = new Set([
  'animation-iteration-count',
  'border-image-outset',
  'border-image-slice',
  'border-image-width',
  'box-flex',
  'box-flex-group',
  'box-ordinal-group',
  'column-count',
  'columns',
  'flex',
  'flex-grow',
  'flex-positive',
  'flex-shrink',
  'flex-negative',
  'flex-order',
  'grid-area',
  'grid-row',
  'grid-row-end',
  'grid-row-span',
  'grid-row-start',
  'grid-column',
  'grid-column-end',
  'grid-column-span',
  'grid-column-start',
  'font-weight',
  'line-clamp',
  'line-height',
  'opacity',
  'order',
  'orphans',
  'tab-size',
  'widows',
  'z-index',
  'zoom',
  'fill-opacity',
  'flood-opacity',
  'stop-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
]);

// <https://github.com/facebook/react/blob/v16.14.0/packages/react-dom/src/shared/dangerousStyleValue.js#L19>
// <https://github.com/infernojs/inferno/blob/v7.4.11/packages/inferno-compat/src/reactstyles.ts#L1>
function normalize_style_value(name: string, value: unknown, is_custom_property: boolean): string {
  const is_empty = value == null || typeof value === 'boolean' || value === '';
  if (is_empty) {
    return '';
  }

  if (
    !is_custom_property &&
    typeof value === 'number' &&
    value !== 0 &&
    !UNITLESS_NUMBER_PROPERTIES.has(name)
  ) {
    return `${value}px`;
  }

  return String(value).trim();
}
