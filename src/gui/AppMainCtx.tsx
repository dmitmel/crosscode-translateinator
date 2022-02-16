// This file exists to break a circular dependency between `AppMain.tsx` and
// the modules with components it directly requires.
import React from 'react';

import { AppMain } from '../app';

export interface AppMainCtx {
  readonly app: AppMain;
}

export const AppMainCtx = React.createContext<AppMainCtx>(null!);
