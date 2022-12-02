import * as React from 'react';

export const IS_FIREFOX = navigator.userAgent.includes('Firefox');

export const IS_MAC =
  typeof process !== 'undefined'
    ? process.platform === 'darwin'
    : navigator.userAgent.includes('Macintosh');

// <https://github.com/facebook/react/blob/v17.0.2/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L818-L861>
export function set_react_ref<T>(ref: React.Ref<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as { current: T | null }).current = value;
  }
}
