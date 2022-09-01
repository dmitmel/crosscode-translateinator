// This file is responsible for annotating every lang label in the game with
// its own JSON path and the path to its file. Thanks to the wonders of the
// autopatcher technology, this can be done entirely at runtime. See
// `prestart.js` for an explanation as for why this is needed.

import * as utils from './utils.js';

// An empty regex matches any string by the way. Exactly what I need.
ccmod.resources.jsonPatches.add(new RegExp(), (obj, _dependencies, context) => {
  recursivelyPatchLangLabels(obj, context.requestedAsset);
});

function recursivelyPatchLangLabels(obj, filePath, jsonPathStack = []) {
  // Can't descend further, our job is done in this subtree.
  if (!utils.isObject(obj)) return;

  // A wild lang label has appeared! Let's inject our additional metadata.
  if (utils.hasKey(obj, 'en_US') && typeof obj.en_US === 'string') {
    obj[utils.LANG_LABEL_FILE_PATH_SYM] = filePath;
    obj[utils.LANG_LABEL_JSON_PATH_SYM] = jsonPathStack.join('/');
    return;
  }

  // Scan any other subtrees for the presence of lang labels.
  for (let key in obj) {
    if (utils.hasKey(obj, key)) {
      jsonPathStack.push(key);
      recursivelyPatchLangLabels(obj[key], filePath, jsonPathStack);
      jsonPathStack.pop();
    }
  }
}
