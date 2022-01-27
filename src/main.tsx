import './uncaught_exception';
import './main.scss';
import './inferno-compat';

import * as Inferno from 'inferno';

import { AppMainGui } from './gui/AppMain';

document.title = `${document.title} v${process.env.npm_package_version}`;

Inferno.render(<AppMainGui />, document.getElementById('app_root_element'));
