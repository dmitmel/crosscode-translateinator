import './uncaught_exception';
import './main.scss';

import * as Inferno from 'inferno';

import { AppMainGui } from './gui/AppMain';

Inferno.render(<AppMainGui />, document.getElementById('app_root_element'));
