/* globals __non_webpack_require__ */
import * as paths from 'path';
import addonUrl from 'crosscode-localization-engine/build/Release/crosslocale.node';
let addonAbsPath = paths.join(process.cwd(), new URL(addonUrl, document.baseURI).pathname);
let addon = __non_webpack_require__(addonAbsPath);

export const { FFI_BRIDGE_VERSION, VERSION, PROTOCOL_VERSION, init_logging, Backend } = addon;
