import './StatusBar.scss';

import cc from 'clsx';
import * as React from 'react';

export interface StatusBarGuiProps {
  className?: string;
}

export function StatusBarGui(props: StatusBarGuiProps): React.ReactElement {
  return <div className={cc(props.className, 'StatusBar')}>Hi!</div>;
}
