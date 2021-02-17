import { createElement } from 'inferno-create-element';
import { Fragment } from 'inferno';

export default { createElement, Fragment };

declare global {
  // `const` is used here instead of a `namespace` so that our "namespace"
  // doesn't get added on the `Window` object where it clearly doesn't belong
  // due to being simply an automatically imported value and not a real global
  // variable.
  const jsx: {
    createElement: typeof createElement;
    Fragment: typeof Fragment;
  };
}
