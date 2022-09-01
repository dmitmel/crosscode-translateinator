// Symbols are identifiers so unique that you can't access a property hidden
// behind the symbol even if you create another identically named symbol. That
// is, if you don't have access to the original symbol instance used to create
// the key in question. In my case, I use symbols to prevent any accidental
// conflicts with Localize Me or similar.
// P.S. Additionally they are invisble to the for-in loop.
// See also <https://developer.mozilla.org/en-US/docs/Glossary/Symbol>.
export const LANG_LABEL_FILE_PATH_SYM = Symbol('LangLabel.filePath');
export const LANG_LABEL_JSON_PATH_SYM = Symbol('LangLabel.jsonPath');

// We are parsing untrusted JSON objects (yes, this is a thing), so we better
// play safe. This function wraps hasOwnProperty in such a way that an object
// like e.g. `{ "hasOwnProperty: true }` doesn't crash the entire system.
export function hasKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Checks if a value is a real JS object, which, translated to human language,
// actually means that it checks for dictionaries and arrays. In other words,
// stuff that can be iterated with the for-in loop.
export function isObject(value) {
  // eslint-disable-next-line eqeqeq
  return typeof value === 'object' && value !== null;
}
