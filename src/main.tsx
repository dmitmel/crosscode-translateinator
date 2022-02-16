import './uncaught_exception';
import './main.scss';

import * as ReactDOM from 'react-dom';

import { AppMainGui } from './gui/AppMain';

document.title = `${document.title} v${process.env.npm_package_version}`;

ReactDOM.render(<AppMainGui />, document.getElementById('app_root_element'));
