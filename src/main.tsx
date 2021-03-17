import './uncaught_exception';
import './main.scss';

// Import the core stylesheets, they must appear as early as possible in the
// generated SCSS so that they can be overridden.
import './gui/Label.scss';
import './gui/Button.scss';

import * as Inferno from 'inferno';
import { AppMainGui } from './gui/AppMain';

Inferno.render(<AppMainGui />, document.getElementById('app_root_element'));
