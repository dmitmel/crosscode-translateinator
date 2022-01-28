import './uncaught_exception';
import './main.scss';

import * as preact from 'preact';

import { AppMainGui } from './gui/AppMain';

document.title = `${document.title} v${process.env.npm_package_version}`;

preact.render(<AppMainGui />, document.getElementById('app_root_element')!);
