// This file is responsible for annotating every lang label in the game with
// its own JSON path and the path to its file. Thanks to the wonders of the
// autopatcher technology, this can be done entirely at runtime. See
// `prestart.js` for an explanation as for why this is needed.

import * as symbols from './symbols.js';

// An empty regex matches any string by the way. Exactly what I need.
ccmod.resources.jsonPatches.add(new RegExp(), (obj, _dependencies, context) => {
  recursivelyPatchLangLabels(obj, context.requestedAsset);
});

function recursivelyPatchLangLabels(obj, filePath, jsonPathStack = []) {
  // Can't descend further, our job is done in this subtree.
  if (!isObject(obj)) return;

  // A wild lang label has appeared! Let's inject our additional metadata.
  if (hasKey(obj, 'en_US') && typeof obj.en_US === 'string') {
    obj[symbols.LangLabel_filePath] = filePath;
    obj[symbols.LangLabel_jsonPath] = jsonPathStack.join('/');
    return;
  }

  // Scan any other subtrees for the presence of lang labels.
  for (let key in obj) {
    if (hasKey(obj, key)) {
      jsonPathStack.push(key);
      recursivelyPatchLangLabels(obj[key], filePath, jsonPathStack);
      jsonPathStack.pop();
    }
  }
}

// Checks if a value is a real JS object, which, translated to human language,
// actually means that it checks for dictionaries and arrays. In other words,
// stuff that can be iterated with the for-in loop.
function isObject(value) {
  return typeof value === 'object' && value !== null;
}

// We are parsing untrusted JSON objects (yes, this is a thing), so we better
// play safe. This function wraps hasOwnProperty in such a way that an object
// like e.g. `{ "hasOwnProperty: true }` doesn't crash the entire system.
function hasKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
