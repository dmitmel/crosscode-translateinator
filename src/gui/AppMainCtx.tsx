// This file exists to break a circular dependency between `AppMain.tsx` and
// the modules with components it directly requires.
import React from 'react';

import { AppMain } from '../app';
import { KeymapHelper } from './keymap';

export interface AppMainCtx {
  readonly app: AppMain;
  readonly keymap: KeymapHelper;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const AppMainCtx = React.createContext<AppMainCtx>(null!);
