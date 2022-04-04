/* globals __non_webpack_require__ */
import addon_url from 'crosscode-localization-engine/build/Release/crosslocale.node';
import * as paths from 'path';
let addon_abs_path = paths.join(process.cwd(), new URL(addon_url, document.baseURI).pathname);
let addon = __non_webpack_require__(addon_abs_path);
export const { FFI_BRIDGE_VERSION, VERSION, PROTOCOL_VERSION, Backend } = addon;
